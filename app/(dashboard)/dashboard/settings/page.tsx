import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getOrCreateWorkspaceWebhookToken,
  replizWebhookUrl,
} from "@/lib/repliz-webhook";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const { workspace } = await getWorkspace();

  const supabase = await createServiceClient();
  const webhookToken = await getOrCreateWorkspaceWebhookToken(
    supabase,
    workspace.id
  );
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <SettingsView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        hasApiKey: !!workspace.repliz_access_key_encrypted,
        hasSecretKey: !!workspace.repliz_secret_key_encrypted,
        hasAiKey: !!workspace.ai_api_key,
        globalKeywords: (workspace.global_keywords as string[]) ?? [],
        webhookUrl: replizWebhookUrl(appUrl, workspace.id),
        webhookToken,
      }}
    />
  );
}
