/**
 * Inbox backfill from Repliz.
 *
 * The local `conversations` table is otherwise populated only by inbound
 * webhooks, so conversations that predate webhook setup never appear in the
 * Inbox. This module pages through Repliz's chats per channel and imports the
 * ones missing locally.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReplizChat, ReplizClient } from "./repliz-client";
import { messagePreview } from "@/lib/message-preview";

/** Cap per channel: 4 pages x 50 conversations. */
const MAX_PAGES_PER_CHANNEL = 4;
const PAGE_SIZE = 50;

export interface BackfillChannel {
  id: string;
  repliz_account_id: string;
  platform: string;
}

/**
 * Finds or creates the contact behind a platform sender: reuses the mapping in
 * `contact_channels` (channel_id, platform_sender_id); otherwise inserts the
 * contact, its channel mapping, and a `contact_created` analytics event.
 * Returns null when the contact insert fails; `existed` tells whether the
 * sender was already known on this channel.
 * With `stampExisting: false` an existing contact's last_interaction_at is
 * left untouched; the caller stamps it once the interaction is confirmed.
 */
export async function upsertContactForSender({
  supabase,
  channel,
  senderId,
  senderName,
  senderPicture,
  senderUsername,
  interactionAt,
  stampExisting = true,
}: {
  supabase: SupabaseClient;
  channel: { id: string; workspace_id: string };
  senderId: string;
  senderName: string;
  senderPicture: string | null;
  senderUsername?: string | null;
  interactionAt: string;
  stampExisting?: boolean;
}): Promise<{ contactId: string; existed: boolean } | null> {
  const { data: existingContactChannel } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .single();

  if (existingContactChannel) {
    if (stampExisting) {
      await supabase
        .from("contacts")
        .update({ last_interaction_at: interactionAt })
        .eq("id", existingContactChannel.contact_id);
    }
    return { contactId: existingContactChannel.contact_id, existed: true };
  }

  const { data: newContact } = await supabase
    .from("contacts")
    .insert({
      workspace_id: channel.workspace_id,
      display_name: senderName,
      avatar_url: senderPicture,
      last_interaction_at: interactionAt,
    })
    .select("id")
    .single();

  if (!newContact) return null;

  await supabase.from("contact_channels").insert({
    contact_id: newContact.id,
    channel_id: channel.id,
    platform_sender_id: senderId,
    platform_username: senderUsername ?? null,
  });

  await supabase.from("analytics_events").insert({
    workspace_id: channel.workspace_id,
    contact_id: newContact.id,
    event_type: "contact_created",
  });

  return { contactId: newContact.id, existed: false };
}

/**
 * Imports Repliz chats missing from the local `conversations` table.
 * Insert-only: conversations already known (by repliz_chat_id) are skipped, and
 * a contact whose (channel_id, contact_id) row already exists under a different
 * repliz_chat_id is left to the webhook, so the webhook-maintained
 * repliz_chat_id / status / last_message_at / unread_count are never clobbered.
 * A failing channel is logged and skipped, not fatal.
 */
export async function backfillInboxConversations({
  supabase,
  repliz,
  workspaceId,
  channels,
}: {
  supabase: SupabaseClient;
  repliz: ReplizClient;
  workspaceId: string;
  channels: BackfillChannel[];
}): Promise<{ imported: number }> {
  let imported = 0;

  for (const channel of channels) {
    try {
      imported += await backfillChannel({
        supabase,
        repliz,
        workspaceId,
        channel,
      });
    } catch (err) {
      console.error(
        `[inbox-sync] backfill failed for channel ${channel.id} (${channel.platform}):`,
        err
      );
    }
  }

  return { imported };
}

async function backfillChannel({
  supabase,
  repliz,
  workspaceId,
  channel,
}: {
  supabase: SupabaseClient;
  repliz: ReplizClient;
  workspaceId: string;
  channel: BackfillChannel;
}): Promise<number> {
  const { data: existingRows } = await supabase
    .from("conversations")
    .select("repliz_chat_id")
    .eq("channel_id", channel.id);

  const known = new Set(
    (existingRows ?? [])
      .map((r: { repliz_chat_id: string | null }) => r.repliz_chat_id)
      .filter(Boolean)
  );

  let imported = 0;
  const seenParticipants = new Set<string>();

  for (let page = 1; page <= MAX_PAGES_PER_CHANNEL; page++) {
    const res = await repliz.chats.list({
      accountId: channel.repliz_account_id,
      page,
      limit: PAGE_SIZE,
    });

    const chats = res.docs ?? [];

    for (const chat of chats) {
      if (!chat._id || !chat.senderId) continue;
      // A participant can have several chats but the local table is unique on
      // (channel_id, contact_id). Repliz sorts newest first, so the first chat
      // per participant is the most recent and later ones are dropped.
      if (seenParticipants.has(chat.senderId)) continue;
      seenParticipants.add(chat.senderId);
      if (known.has(chat._id)) continue;
      if (await importConversation({ supabase, workspaceId, channel, chat })) {
        imported++;
      }
    }

    if (!res.hasNextPage || chats.length === 0) break;
  }

  return imported;
}

async function importConversation({
  supabase,
  workspaceId,
  channel,
  chat,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  channel: BackfillChannel;
  chat: ReplizChat;
}): Promise<boolean> {
  const interactionAt = chat.updatedAt ?? new Date().toISOString();
  const contact = await upsertContactForSender({
    supabase,
    channel: { id: channel.id, workspace_id: workspaceId },
    senderId: chat.senderId,
    senderName: chat.senderName || chat.senderId,
    senderPicture: chat.senderPicture || null,
    interactionAt,
    stampExisting: false,
  });

  if (!contact) {
    console.error(`[inbox-sync] failed to create contact for chat ${chat._id}`);
    return false;
  }

  const lastText =
    chat.lastMessage?.text ||
    (chat.lastMessage?.type ? `[${chat.lastMessage.type}]` : "");

  // ignoreDuplicates: an existing (channel_id, contact_id) row is owned by the
  // webhook (possibly under a different repliz_chat_id) and must stay
  // untouched; the conflict then returns no rows, so it is not counted as
  // imported either.
  const { data: insertedRows, error } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: workspaceId,
        channel_id: channel.id,
        contact_id: contact.contactId,
        platform: channel.platform,
        repliz_chat_id: chat._id,
        status: "open",
        last_message_at: chat.updatedAt ?? null,
        last_message_preview: messagePreview(lastText),
        unread_count: chat.unreadCount ?? 0,
      },
      { onConflict: "channel_id,contact_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error(`[inbox-sync] failed to upsert conversation ${chat._id}:`, error);
    return false;
  }

  const inserted = (insertedRows ?? []).length > 0;

  // Stamp the existing contact only after the conversation row was actually
  // inserted; a webhook-owned duplicate is not a new interaction.
  if (inserted && contact.existed) {
    await supabase
      .from("contacts")
      .update({ last_interaction_at: interactionAt })
      .eq("id", contact.contactId);
  }

  return inserted;
}
