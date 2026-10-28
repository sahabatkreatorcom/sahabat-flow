/**
 * The platforms Sahabat Kreator can drive through Repliz. Repliz connects many more
 * (Threads, YouTube, LinkedIn, X, Pinterest, Shopee, WhatsApp), but only these
 * expose the DM inbox that flows, sequences and broadcasts are built on.
 */
export const PLATFORMS = [
  "instagram",
  "facebook",
  "telegram",
  "tiktok",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  tiktok: "TikTok",
};

export function isSupportedPlatform(value: unknown): value is Platform {
  return (
    typeof value === "string" && (PLATFORMS as readonly string[]).includes(value)
  );
}

export function platformLabel(platform: string): string {
  return isSupportedPlatform(platform)
    ? PLATFORM_LABELS[platform]
    : platform.charAt(0).toUpperCase() + platform.slice(1);
}
