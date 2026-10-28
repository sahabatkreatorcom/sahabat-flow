import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executeFlow } from "@/lib/flow-engine/engine";
import { matchTrigger } from "@/lib/flow-engine/trigger-matcher";
import { verifyWebhookToken } from "@/lib/repliz-webhook";
import { upsertContactForSender } from "@/lib/inbox-sync";
import { processComment } from "@/lib/comment-processor";
import type { Database } from "@/lib/types/database";
import { messagePreview } from "@/lib/message-preview";

// ── Repliz webhook payload ───────────────────────────────────────────────────
// https://docs.repliz.com/tutorial/webhook.html

interface ReplizWebhookPayload {
  platform?: string;
  type?: "comment" | "chat" | "referral" | "schedule" | "testing" | string;
  accountId?: string;
  data?: ReplizCommentData | ReplizChatData;
}

interface ReplizCommentData {
  _id?: string;
  accountId?: string;
  content?: { id?: string };
  comment?: {
    id?: string;
    text?: string;
    owner?: { id?: string; name?: string; username?: string; picture?: string };
  };
}

interface ReplizChatData {
  chat?: {
    _id?: string;
    accountId?: string;
    senderId?: string;
    senderName?: string;
    senderPicture?: string | null;
    unreadCount?: number;
    updatedAt?: string;
  };
  message?: {
    _id?: string;
    messageId?: string;
    senderId?: string;
    isFromMe?: boolean;
    type?: string;
    text?: string;
    createdAt?: string;
  };
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type Channel = Database["public"]["Tables"]["channels"]["Row"];

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("Repliz webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleWebhook(request: NextRequest) {
  const body = await request.text();

  let payload: ReplizWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Repliz sends this once when the webhook URL is saved.
  if (payload.type === "testing") {
    return NextResponse.json({ ok: true, testing: true });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspace");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspace query parameter in webhook URL" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, webhook_secret")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (
    !verifyWebhookToken(
      workspace.webhook_secret,
      request.headers.get("x-token")
    )
  ) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const eventId = eventIdFor(payload);
  if (!(await claimWebhookEvent(supabase, eventId))) {
    return NextResponse.json({ ok: true, skipped: true, reason: "duplicate_event" });
  }

  if (payload.type === "comment") {
    return handleComment(
      supabase,
      workspaceId,
      payload,
      payload.data as ReplizCommentData
    );
  }

  if (payload.type === "chat") {
    return handleChat(supabase, workspaceId, payload, payload.data as ReplizChatData);
  }

  // referral/schedule events are acknowledged but not used by Sahabat Kreator.
  return NextResponse.json({ ok: true, skipped: true });
}

function eventIdFor(payload: ReplizWebhookPayload): string | null {
  const data = payload.data as ReplizCommentData & ReplizChatData;
  const id =
    payload.type === "chat"
      ? data?.message?.messageId || data?.message?._id
      : payload.type === "comment"
        ? data?._id || data?.comment?.id
        : undefined;
  return id ? `${payload.type}:${id}` : null;
}

/** Claim an event id so Repliz retries/duplicates never re-run a flow. */
async function claimWebhookEvent(
  supabase: ServiceClient,
  eventId: string | null
): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await supabase
    .from("webhook_events")
    .insert({ event_id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("webhook_events claim failed:", error);
  return true;
}

async function findChannel(
  supabase: ServiceClient,
  workspaceId: string,
  accountId: string | undefined
): Promise<Channel | null> {
  if (!accountId) return null;
  const { data } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("repliz_account_id", accountId)
    .eq("is_active", true)
    .single();
  return data ?? null;
}

// ── DM events ───────────────────────────────────────────────────────────────

async function handleChat(
  supabase: ServiceClient,
  workspaceId: string,
  payload: ReplizWebhookPayload,
  data: ReplizChatData
) {
  const chat = data.chat;
  const message = data.message;

  if (!chat?._id || !message) {
    return NextResponse.json({ ok: true, skipped: true, reason: "empty_chat" });
  }

  // Repliz also emits events for messages this account sent.
  if (message.isFromMe) {
    return NextResponse.json({ ok: true, skipped: true, reason: "outbound" });
  }

  const accountId = payload.accountId || chat.accountId;
  const channel = await findChannel(supabase, workspaceId, accountId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const senderId = chat.senderId || message.senderId;
  if (!senderId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_sender" });
  }

  // Ack immediately; Repliz expects a fast 2xx and does not retry by itself.
  after(async () => {
    try {
      await processChatEvent(supabase, channel, chat, message, senderId);
    } catch (err) {
      console.error("Repliz chat processing error:", err);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}

async function processChatEvent(
  supabase: ServiceClient,
  channel: Channel,
  chat: NonNullable<ReplizChatData["chat"]>,
  message: NonNullable<ReplizChatData["message"]>,
  senderId: string
) {
  const senderName = chat.senderName || senderId;

  const contact = await upsertContactForSender({
    supabase,
    channel,
    senderId,
    senderName,
    senderPicture: chat.senderPicture ?? null,
    interactionAt: chat.updatedAt || new Date().toISOString(),
  });

  if (!contact) {
    console.error("Failed to create contact for Repliz chat");
    return;
  }

  const text = message.text || "";

  const { data: conversation } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        contact_id: contact.contactId,
        platform: channel.platform,
        repliz_chat_id: chat._id,
        status: "open",
        last_message_at: message.createdAt || new Date().toISOString(),
        last_message_preview: messagePreview(text || `[${message.type || "message"}]`),
        unread_count: 1,
      },
      { onConflict: "channel_id,contact_id" }
    )
    .select("id, is_automation_paused")
    .single();

  if (!conversation) {
    console.error("Failed to upsert conversation for Repliz chat");
    return;
  }

  // Keep a local copy for the inbox and for AI context; Repliz remains the
  // source of truth when the thread is opened.
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    text: text || null,
    platform_message_id: message.messageId || message._id || null,
    status: "delivered",
  });

  if (contact.existed) {
    await supabase.rpc("increment_unread", {
      conv_id: conversation.id,
      preview: messagePreview(text || `[${message.type || "message"}]`),
    });
  }

  if (conversation.is_automation_paused) return;

  const incomingMessage = {
    text: text || undefined,
    sender: {
      id: senderId,
      name: senderName,
      username: undefined,
    },
  };

  const handled = await handleGlobalKeywords(
    supabase,
    channel.workspace_id,
    contact.contactId,
    text || undefined
  );
  if (handled) return;

  const trigger = await matchTrigger(supabase, {
    channelId: channel.id,
    workspaceId: channel.workspace_id,
    conversationId: conversation.id,
    message: incomingMessage,
    isFirstMessage: !contact.existed,
  });

  if (!trigger) return;

  try {
    await executeFlow(supabase, {
      triggerId: trigger.id,
      flowId: trigger.flow_id,
      channelId: channel.id,
      contactId: contact.contactId,
      conversationId: conversation.id,
      workspaceId: channel.workspace_id,
      incomingMessage,
      replizChatId: chat._id,
      replizAccountId: channel.repliz_account_id,
    });
  } catch (err) {
    console.error("Flow execution error:", err);
  }
}

// ── Comment events ──────────────────────────────────────────────────────────

async function handleComment(
  supabase: ServiceClient,
  workspaceId: string,
  payload: ReplizWebhookPayload,
  data: ReplizCommentData
) {
  const accountId = payload.accountId || data.accountId;
  const channel = await findChannel(supabase, workspaceId, accountId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const commentId = data.comment?.id;
  if (!commentId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_comment_id" });
  }

  after(async () => {
    try {
      await processComment({
        supabase,
        channel,
        comment: {
          id: commentId,
          replizId: data._id,
          postId: data.content?.id || "",
          text: data.comment?.text || "",
          author: data.comment?.owner ?? {},
        },
      });
    } catch (err) {
      console.error("Repliz comment processing error:", err);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}

// ── Global keywords ─────────────────────────────────────────────────────────

async function handleGlobalKeywords(
  supabase: ServiceClient,
  workspaceId: string,
  contactId: string,
  text: string | undefined
): Promise<boolean> {
  if (!text) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("global_keywords")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.global_keywords) return false;

  const keywords = workspace.global_keywords as Array<{
    keyword: string;
    action?: string;
  }>;

  const normalizedText = text.toLowerCase().trim();

  for (const kw of keywords) {
    if (normalizedText !== kw.keyword.toLowerCase()) continue;

    if (kw.action === "unsubscribe") {
      await supabase
        .from("contacts")
        .update({ is_subscribed: false })
        .eq("id", contactId);
      return true;
    }
    if (kw.action === "subscribe") {
      await supabase
        .from("contacts")
        .update({ is_subscribed: true })
        .eq("id", contactId);
      return true;
    }
    return false;
  }

  return false;
}
