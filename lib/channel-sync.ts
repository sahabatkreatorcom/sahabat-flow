/**
 * Shared Repliz account → local channel sync.
 *
 * Used by the Channels "Sync" button, the Settings credential test, and the
 * OAuth callback so all three paths store accounts the same way.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReplizClient } from "./repliz-client";
import { backfillInboxConversations } from "./inbox-sync";
import { isSupportedPlatform } from "./platforms";

export interface ChannelSyncResult {
  created: number;
  updated: number;
  deactivated: number;
  conversationsImported: number;
  skipped: string[];
  failed: string[];
}

export async function syncChannels({
  supabase,
  repliz,
  workspaceId,
  backfill = true,
}: {
  supabase: SupabaseClient;
  repliz: ReplizClient;
  workspaceId: string;
  backfill?: boolean;
}): Promise<ChannelSyncResult> {
  const accounts = await repliz.accounts.list();

  const { data: existingChannels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId);

  const existingByReplizId = new Map(
    (existingChannels ?? []).map((c) => [c.repliz_account_id, c])
  );

  const replizAccountIds = new Set(accounts.map((a) => a._id).filter(Boolean));
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const account of accounts) {
    if (!account._id) continue;
    // A Repliz key also carries accounts Sahabat Kreator cannot drive (Threads,
    // YouTube, LinkedIn, X, Pinterest...). Inserting those would hit the
    // channels platform check constraint.
    if (!isSupportedPlatform(account.type)) {
      if (account.type) skipped.push(account.type);
      continue;
    }
    if (account.isConnected === false) {
      skipped.push(`${account.type}: disconnected`);
      continue;
    }

    const displayName = account.name || account.username || null;
    const username = account.username || null;
    const profilePicture = account.picture || null;

    const existing = existingByReplizId.get(account._id);

    if (existing) {
      if (
        existing.username !== username ||
        existing.display_name !== displayName ||
        existing.profile_picture !== profilePicture
      ) {
        await supabase
          .from("channels")
          .update({
            username,
            display_name: displayName,
            profile_picture: profilePicture,
          })
          .eq("id", existing.id);
        updated++;
      }
    } else {
      const { error: insertErr } = await supabase.from("channels").insert({
        workspace_id: workspaceId,
        platform: account.type,
        repliz_account_id: account._id,
        username,
        display_name: displayName,
        profile_picture: profilePicture,
        is_active: true,
      });
      if (insertErr) {
        console.error("[channel-sync] channel insert failed:", insertErr);
        failed.push(`${account.type}: ${insertErr.message}`);
        continue;
      }
      created++;
    }
  }

  // Deactivate channels whose Repliz accounts no longer exist.
  let deactivated = 0;
  for (const channel of existingChannels ?? []) {
    if (!replizAccountIds.has(channel.repliz_account_id) && channel.is_active) {
      await supabase
        .from("channels")
        .update({ is_active: false })
        .eq("id", channel.id);
      deactivated++;
    }
  }

  let conversationsImported = 0;
  if (backfill) {
    try {
      const { data: activeChannels } = await supabase
        .from("channels")
        .select("id, repliz_account_id, platform")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      const { imported } = await backfillInboxConversations({
        supabase,
        repliz,
        workspaceId,
        channels: activeChannels ?? [],
      });
      conversationsImported = imported;
    } catch (err) {
      console.error("[channel-sync] inbox backfill failed:", err);
    }
  }

  return {
    created,
    updated,
    deactivated,
    conversationsImported,
    skipped: [...new Set(skipped)],
    failed,
  };
}
