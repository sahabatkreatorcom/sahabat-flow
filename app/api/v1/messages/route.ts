import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createReplizClient,
  type ReplizChatMessage,
} from "@/lib/repliz-client";
import { messagePreview } from "@/lib/message-preview";

function attachmentFor(message: ReplizChatMessage) {
  const entries: Array<[string, { url?: string } | undefined]> = [
    ["image", message.image],
    ["video", message.video],
    ["audio", message.audio],
    ["document", message.document],
    ["sticker", message.sticker],
  ];
  const attachments = entries
    .filter(([, value]) => !!value?.url)
    .map(([type, value]) => ({ type, url: value!.url }));
  return attachments.length ? attachments : null;
}

/**
 * GET /api/v1/messages?conversationId=...
 *
 * Fetches messages from the Repliz Chat API (source of truth) instead of a
 * local mirror.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  // Look up the Repliz chat ID and workspace credentials
  const { data: conversation } = await supabase
    .from("conversations")
    .select("repliz_chat_id, workspace_id")
    .eq("id", conversationId)
    .single();

  if (!conversation?.repliz_chat_id) {
    return NextResponse.json(
      { error: "Conversation not found or not linked to a chat" },
      { status: 404 }
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("repliz_access_key_encrypted, repliz_secret_key_encrypted")
    .eq("id", conversation.workspace_id)
    .single();

  if (
    !workspace?.repliz_access_key_encrypted ||
    !workspace.repliz_secret_key_encrypted
  ) {
    return NextResponse.json({ error: "Messaging credentials not configured" }, { status: 400 });
  }

  try {
    const repliz = createReplizClient(
      workspace.repliz_access_key_encrypted,
      workspace.repliz_secret_key_encrypted
    );

    const replizMessages: ReplizChatMessage[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await repliz.chats.messages(conversation.repliz_chat_id, {
        page,
        limit: 100,
      });
      replizMessages.push(...(res.docs ?? []));
      if (!res.hasNextPage || !res.docs?.length) break;
    }

    const messages = replizMessages
      .slice()
      .sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      )
      .map((m) => ({
        id: m._id,
        conversation_id: conversationId,
        direction: m.isFromMe ? "outbound" : "inbound",
        text: m.text ?? null,
        attachments: attachmentFor(m),
        quick_reply_payload: null,
        postback_payload: null,
        callback_data: null,
        platform_message_id: m.messageId ?? m._id ?? null,
        sent_by_flow_id: null,
        sent_by_node_id: null,
        sent_by_user_id: null,
        status: "sent",
        created_at: m.createdAt ?? new Date().toISOString(),
      }));

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Failed to fetch messages from Repliz API:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/messages
 *
 * Sends a message via the Repliz Chat API. No local message storage — Repliz is
 * the source of truth.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, text } = body;

  if (!conversationId || !text) {
    return NextResponse.json(
      { error: "conversationId and text required" },
      { status: 400 }
    );
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!conversation.repliz_chat_id) {
    return NextResponse.json(
      { error: "No chat linked to this conversation" },
      { status: 400 }
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("repliz_access_key_encrypted, repliz_secret_key_encrypted")
    .eq("id", conversation.workspace_id)
    .single();

  if (
    !workspace?.repliz_access_key_encrypted ||
    !workspace.repliz_secret_key_encrypted
  ) {
    return NextResponse.json({ error: "Messaging credentials not configured" }, { status: 400 });
  }

  // Send via Repliz — Repliz stores the message, no local insert needed
  try {
    const repliz = createReplizClient(
      workspace.repliz_access_key_encrypted,
      workspace.repliz_secret_key_encrypted
    );
    const res = await repliz.chats.send(conversation.repliz_chat_id, {
      type: "text",
      text,
    });

    const messageId = res.messageId ?? null;

    // Update conversation's last message info (Sahabat Kreator-specific metadata)
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview(text),
      })
      .eq("id", conversationId);

    // Return a message-shaped response for the UI's optimistic update
    return NextResponse.json(
      {
        id: messageId ?? `sent-${Date.now()}`,
        conversation_id: conversationId,
        direction: "outbound",
        text,
        attachments: null,
        quick_reply_payload: null,
        postback_payload: null,
        callback_data: null,
        platform_message_id: messageId,
        sent_by_flow_id: null,
        sent_by_node_id: null,
        sent_by_user_id: user.id,
        status: "sent",
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to send message via Repliz API:", error);
    return NextResponse.json(
      { error: `Failed to send message: ${error}` },
      { status: 500 }
    );
  }
}
