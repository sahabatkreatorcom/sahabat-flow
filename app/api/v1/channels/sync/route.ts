import { NextResponse } from "next/server";
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

/**
 * POST /api/v1/channels/sync
 *
 * Syncs all Repliz accounts as channels for the current workspace.
 * Creates new channels for accounts not yet in the DB.
 * Deactivates channels whose Repliz accounts no longer exist.
 */
export async function POST() {
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

  const repliz = createReplizClient(
    workspace.repliz_access_key_encrypted,
    workspace.repliz_secret_key_encrypted
  );

  try {
    const synced = await syncChannels({
      supabase,
      repliz,
      workspaceId: workspace.id,
    });

    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ channels: channels ?? [], synced });
  } catch (error) {
    console.error("Failed to sync channels:", error);
    return NextResponse.json(
      { error: `Failed to sync channels: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
