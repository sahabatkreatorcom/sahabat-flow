/**
 * Repliz webhook helpers.
 *
 * Repliz delivers one webhook per workspace. There is no API to register it,
 * so the workspace owner pastes the URL and token into Repliz's dashboard
 * (Settings → Webhook). The URL carries the workspace id, which lets us find
 * the workspace and verify the `x-token` header before doing any work.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Generates a random 32-byte token as a 64-char hex string. */
export function generateWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

/** Public webhook URL for a workspace. */
export function replizWebhookUrl(appUrl: string, workspaceId: string): string {
  return `${appUrl.trim().replace(/\/$/, "")}/api/webhooks/repliz?workspace=${encodeURIComponent(
    workspaceId
  )}`;
}

/**
 * Constant-time comparison of the `x-token` header. Returns false when either
 * side is missing so a misconfigured workspace never accepts unsigned events.
 */
export function verifyWebhookToken(
  expected: string | null | undefined,
  provided: string | null | undefined
): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Returns the workspace's webhook token, generating and persisting one the
 * first time it is needed. The `webhook_secret` column is reused from the
 * previous provider so existing workspaces keep a stable value.
 */
export async function getOrCreateWorkspaceWebhookToken(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("webhook_secret")
    .eq("id", workspaceId)
    .single();

  if (workspace?.webhook_secret) return workspace.webhook_secret as string;

  const token = generateWebhookToken();
  const { error } = await supabase
    .from("workspaces")
    .update({ webhook_secret: token })
    .eq("id", workspaceId);

  if (error) {
    throw new Error(`Could not store webhook token: ${error.message}`);
  }

  return token;
}

/** Reads the stored token without creating one (used while verifying events). */
export async function resolveWorkspaceWebhookToken(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("webhook_secret")
    .eq("id", workspaceId)
    .single();
  return (data?.webhook_secret as string | null) ?? null;
}
