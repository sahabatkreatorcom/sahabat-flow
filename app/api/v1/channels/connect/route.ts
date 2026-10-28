import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReplizClient } from "@/lib/repliz-client";
import { PLATFORMS, isSupportedPlatform } from "@/lib/platforms";

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

/**
 * POST /api/v1/channels/connect
 *
 * Starts a Repliz connection. Instagram and TikTok use the OAuth redirect
 * flow; Telegram uses the QR session flow.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (
    !workspace.repliz_access_key_encrypted ||
    !workspace.repliz_secret_key_encrypted
  ) {
    return NextResponse.json(
      { error: "Messaging credentials not configured. Go to Settings first." },
      { status: 400 }
    );
  }

  const { platform } = await request.json();

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json(
      { error: `Unsupported platform. Must be one of: ${PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  const repliz = createReplizClient(
    workspace.repliz_access_key_encrypted,
    workspace.repliz_secret_key_encrypted
  );

  try {
    if (platform === "telegram") {
      const token = await repliz.accounts.createSession("telegram");
      return NextResponse.json({ mode: "qr", platform, token });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const callbackUrl = `${appUrl}/dashboard/channels/callback?platform=${platform}`;
    const authUrl = await repliz.accounts.authorize(platform, callbackUrl);

    return NextResponse.json({ mode: "oauth", platform, authUrl });
  } catch (error) {
    console.error("Failed to start Repliz connection:", error);
    return NextResponse.json(
      { error: `Connection failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
