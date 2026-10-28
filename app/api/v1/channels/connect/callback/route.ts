import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReplizClient } from "@/lib/repliz-client";
import { syncChannels } from "@/lib/channel-sync";
import { isSupportedPlatform } from "@/lib/platforms";

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
 * POST /api/v1/channels/connect/callback
 *
 * Completes a Repliz OAuth connection:
 * - `{ platform, code }` connects Instagram/TikTok directly.
 * - `{ platform: "facebook", code }` exchanges the code and returns the Pages
 *   the user can pick from.
 * - `{ platform: "facebook", assetId, assetToken }` connects the chosen Page.
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

  const body = await request.json();
  const { platform } = body;

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  const repliz = createReplizClient(
    workspace.repliz_access_key_encrypted,
    workspace.repliz_secret_key_encrypted
  );

  try {
    // Facebook: one login can manage several Pages, so list them and let the
    // caller pick one.
    if (platform === "facebook" && body.code && !body.assetId) {
      const token = await repliz.accounts.exchange("facebook", body.code);
      const assets = await repliz.accounts.listAssets("facebook", token);
      return NextResponse.json({
        mode: "assets",
        platform,
        assets: assets.map((asset) => ({
          id: asset.id,
          name: asset.name || null,
          username: asset.username || null,
          picture: asset.picture || null,
          token: asset.token,
        })),
      });
    }

    let accountId: string;

    if (platform === "facebook") {
      if (!body.assetId || !body.assetToken) {
        return NextResponse.json(
          { error: "assetId and assetToken are required for Facebook" },
          { status: 400 }
        );
      }
      accountId = await repliz.accounts.connect("facebook", {
        pageId: String(body.assetId),
        token: String(body.assetToken),
      });
    } else {
      if (!body.code) {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
      }
      accountId = await repliz.accounts.connect(platform, {
        code: String(body.code),
      });
    }

    const synced = await syncChannels({
      supabase,
      repliz,
      workspaceId: workspace.id,
    });

    return NextResponse.json({ mode: "connected", platform, accountId, synced });
  } catch (error) {
    console.error("Failed to complete Repliz connection:", error);
    return NextResponse.json(
      { error: `Connection failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
