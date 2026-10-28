import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReplizClient } from "@/lib/repliz-client";
import { syncChannels } from "@/lib/channel-sync";

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) return null;
  return membership.workspaces;
}

async function credentials(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const workspace = await getWorkspace(supabase);
  if (
    !workspace?.repliz_access_key_encrypted ||
    !workspace.repliz_secret_key_encrypted
  ) {
    return null;
  }
  return {
    workspace,
    repliz: createReplizClient(
      workspace.repliz_access_key_encrypted,
      workspace.repliz_secret_key_encrypted
    ),
  };
}

/**
 * GET /api/v1/channels/connect/session?token=...
 *
 * Polls a Telegram QR session. The client shows `qrcode` (base64 PNG) until
 * `isConnected` is true, and asks for a password when `isPasswordRequired`.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await credentials(supabase);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = request.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    const session = await auth.repliz.accounts.getSession("telegram", token);
    return NextResponse.json({
      qrcode: session.qrcode || null,
      isConnected: session.isConnected ?? false,
      isPasswordRequired: session.isPasswordRequired ?? false,
      passwordHint: session.passwordHint || null,
    });
  } catch (error) {
    console.error("Failed to read Telegram session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session not found" },
      { status: 502 }
    );
  }
}

/**
 * POST /api/v1/channels/connect/session
 *
 * - `{ token, password }` submits the Telegram Two-Step Verification password.
 * - `{ token }` finalizes the connection once the QR code was scanned.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await credentials(supabase);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const token = body.token;
  if (!token)
    return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    if (body.password) {
      await auth.repliz.accounts.sendSessionPassword(
        "telegram",
        String(token),
        String(body.password)
      );
      return NextResponse.json({ ok: true });
    }

    const accountId = await auth.repliz.accounts.connect("telegram", {
      token: String(token),
    });

    const synced = await syncChannels({
      supabase,
      repliz: auth.repliz,
      workspaceId: auth.workspace.id,
    });

    return NextResponse.json({ mode: "connected", platform: "telegram", accountId, synced });
  } catch (error) {
    console.error("Failed to complete Telegram connection:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
