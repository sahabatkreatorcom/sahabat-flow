"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Asset {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
  token: string;
}

export default function ChannelCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"syncing" | "success" | "error">("syncing");
  const [message, setMessage] = useState("Connecting your account...");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const started = useRef(false);

  const platform = searchParams.get("platform") || "instagram";

  function finish(text: string) {
    setStatus("success");
    setMessage(text);
    setTimeout(() => router.push("/dashboard/channels"), 1500);
  }

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
    setTimeout(() => router.push("/dashboard/channels"), 2500);
  }

  async function connect(body: Record<string, string>) {
    setStatus("syncing");
    try {
      const res = await fetch("/api/v1/channels/connect/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        fail(data.error || "Failed to connect the account.");
        return;
      }

      if (data.mode === "assets") {
        if (!data.assets?.length) {
          fail("No Facebook Pages are available for this account.");
          return;
        }
        setAssets(data.assets as Asset[]);
        setMessage("Choose the Page you want to connect.");
        return;
      }

      const created = data.synced?.created ?? 0;
      finish(
        created > 0
          ? `${platform} account connected successfully!`
          : "Account connected! Channel is already synced."
      );
    } catch {
      fail("Failed to connect. You can try again from Channels.");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Facebook returns the token in the URL fragment, which never reaches the
    // server, so read it in the browser.
    const hash =
      platform === "facebook"
        ? new URLSearchParams(window.location.hash.replace(/^#/, ""))
        : null;
    const code = hash?.get("access_token") || searchParams.get("code");

    if (!code) {
      fail("Connection was cancelled or failed.");
      return;
    }

    connect({ platform, code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        {status === "syncing" && assets === null && (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
        {status === "success" && (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        )}
        {status === "error" && (
          <XCircle className="h-8 w-8 text-red-500" />
        )}
        <p className="text-sm font-medium text-foreground">{message}</p>

        {assets && (
          <div className="flex w-full flex-col gap-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() =>
                  connect({
                    platform,
                    assetId: asset.id,
                    assetToken: asset.token,
                  })
                }
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                {asset.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.picture}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {asset.name || asset.username || asset.id}
                  </p>
                  {asset.username && (
                    <p className="truncate text-xs text-muted-foreground">
                      @{asset.username}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Redirecting to channels...</p>
      </div>
    </div>
  );
}
