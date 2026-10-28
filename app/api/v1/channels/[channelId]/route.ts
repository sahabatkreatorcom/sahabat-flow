import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReplizClient, ReplizApiError } from "@/lib/repliz-client";

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
 * DELETE /api/v1/channels/[channelId]
 *
 * Permanently deletes a channel: disconnects the account on Repliz first
 * (otherwise /api/v1/channels/sync would re-create it from the account list),
 * then deletes the local row (cascades conversations, contact links, etc.).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: channel } = await supabase
    .from("channels")
    .select("id, repliz_account_id")
    .eq("id", channelId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!channel)
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  if (
    workspace.repliz_access_key_encrypted &&
    workspace.repliz_secret_key_encrypted
  ) {
    const repliz = createReplizClient(
      workspace.repliz_access_key_encrypted,
      workspace.repliz_secret_key_encrypted
    );
    try {
      await repliz.accounts.delete(channel.repliz_account_id);
    } catch (error) {
      // A 404 means the account is already gone from Repliz; that's fine.
      if (!(error instanceof ReplizApiError) || error.status !== 404) {
        console.error("Failed to disconnect Repliz account:", error);
        return NextResponse.json(
          {
            error: `Failed to disconnect the account: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
          { status: 502 }
        );
      }
    }
  }

  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId)
    .eq("workspace_id", workspace.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
