import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PLATFORMS, PLATFORM_LABELS, isSupportedPlatform, platformLabel } from "./platforms";

/**
 * Issue #16: the channel picker offered a platform the connect route rejected
 * and the channels check constraint could not have stored. Each layer carried
 * its own copy of the list. These tests pin them to PLATFORMS.
 */
describe("platform allowlist", () => {
  it("labels every supported platform", () => {
    for (const platform of PLATFORMS) {
      expect(PLATFORM_LABELS[platform]).toBeTruthy();
    }
  });

  it("accepts supported platforms and rejects everything else", () => {
    expect(isSupportedPlatform("instagram")).toBe(true);
    expect(isSupportedPlatform("facebook")).toBe(true);
    expect(isSupportedPlatform("telegram")).toBe(true);
    expect(isSupportedPlatform("tiktok")).toBe(true);
    // Repliz connects these, Sahabat Kreator has no DM inbox for them.
    expect(isSupportedPlatform("whatsapp")).toBe(false);
    expect(isSupportedPlatform("youtube")).toBe(false);
    expect(isSupportedPlatform(undefined)).toBe(false);
  });

  it("falls back to a capitalised name for unknown platforms", () => {
    expect(platformLabel("whatsapp")).toBe("Whatsapp");
    expect(platformLabel("tiktok")).toBe("TikTok");
  });

  it("is allowed by the channels platform check constraint", () => {
    const constraint = latestChannelsPlatformConstraint();
    for (const platform of PLATFORMS) {
      expect(constraint).toContain(platform);
    }
  });

  it("keeps ALL_MIGRATIONS.sql a faithful in-order copy of every migration", () => {
    const dir = migrationsDir();
    const bundle = readFileSync(join(dir, "ALL_MIGRATIONS.sql"), "utf8");
    let cursor = 0;
    for (const file of migrationFiles()) {
      const body = readFileSync(join(dir, file), "utf8").trim();
      const at = bundle.indexOf(body, cursor);
      expect(at, `${file} missing from ALL_MIGRATIONS.sql or out of order`).toBeGreaterThan(-1);
      cursor = at + body.length;
    }
  });
});

function migrationsDir(): string {
  return join(__dirname, "..", "supabase", "migrations");
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir())
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
}

/** The platform list from the newest migration that redefines the constraint. */
function latestChannelsPlatformConstraint(): string[] {
  const dir = migrationsDir();

  for (const file of [...migrationFiles()].reverse()) {
    const sql = readFileSync(join(dir, file), "utf8");
    const match = sql.match(
      /channels[\s\S]*?platform[\s\S]*?check\s*\(\s*platform\s+in\s*\(([^)]*)\)/i
    );
    if (match) {
      return match[1]
        .split(",")
        .map((v) => v.trim().replace(/^'|'$/g, ""))
        .sort();
    }
  }
  throw new Error("no migration defines the channels platform constraint");
}
