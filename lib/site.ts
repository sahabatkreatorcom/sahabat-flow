/**
 * Public site identity. NEXT_PUBLIC_* values are inlined at build time.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://sahabatkreator.com";

/**
 * Repository link shown on the marketing page. Empty until this project has a
 * repository of its own, so the UI never points at somebody else's fork.
 */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || "";
