import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReplizClient } from "@/lib/repliz-client";
import {
  getOrCreateWorkspaceWebhookToken,
  replizWebhookUrl,
} from "@/lib/repliz-webhook";
import { syncChannels } from "@/lib/channel-sync";

/**
 * POST /api/v1/channels/test-key
 *
 * Validates a Repliz Access Key + Secret Key pair, saves them to the workspace,
 * and auto-syncs channels.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accessKey, secretKey, workspaceId } = body;

  if (!accessKey || typeof accessKey !== "string") {
    return NextResponse.json({ error: "accessKey is required" }, { status: 400 });
  }
  if (!secretKey || typeof secretKey !== "string") {
    return NextResponse.json({ error: "secretKey is required" }, { status: 400 });
  }

  // Validate the credentials by listing accounts
  let accounts;
  try {
    const repliz = createReplizClient(accessKey.trim(), secretKey.trim());
    accounts = await repliz.accounts.list();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid credentials or connection error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let webhook: { url: string; token: string } | null = null;

  // If workspaceId provided, save the credentials and sync channels
  if (workspaceId) {
    const supabase = await createClient();

    const { error: saveErr } = await supabase
      .from("workspaces")
      .update({
        repliz_access_key_encrypted: accessKey.trim(),
        repliz_secret_key_encrypted: secretKey.trim(),
      })
      .eq("id", workspaceId)
      .select("id")
      .single();

    if (saveErr) {
      return NextResponse.json(
        { error: `Credentials valid but failed to save: ${saveErr.message}` },
        { status: 500 }
      );
    }

    // Repliz has no webhook registration API, so make sure the workspace has a
    // token and return the URL the owner must paste into Repliz.
    try {
      const token = await getOrCreateWorkspaceWebhookToken(supabase, workspaceId);
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      webhook = { url: replizWebhookUrl(appUrl, workspaceId), token };
    } catch (err) {
      console.error("[test-key] webhook token setup failed:", err);
    }

    // Auto-sync channels and backfill conversations that predate webhook
    // setup, so a first-time setup fills the Inbox immediately.
    try {
      await syncChannels({
        supabase,
        repliz: createReplizClient(accessKey.trim(), secretKey.trim()),
        workspaceId,
      });
    } catch (err) {
      console.error("[test-key] channel sync failed:", err);
    }
  }

  return NextResponse.json({ accounts, webhook });
}
