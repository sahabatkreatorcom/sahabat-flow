import { describe, it, expect } from "vitest";
import {
  generateWebhookToken,
  replizWebhookUrl,
  verifyWebhookToken,
} from "./repliz-webhook";

describe("repliz webhook helpers", () => {
  it("generates a 64-character hex token", () => {
    const token = generateWebhookToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(generateWebhookToken()).not.toBe(token);
  });

  it("builds the workspace-scoped webhook URL and trims trailing slashes", () => {
    expect(replizWebhookUrl("https://app.example.com/", "ws-1")).toBe(
      "https://app.example.com/api/webhooks/repliz?workspace=ws-1"
    );
  });

  it("accepts only an exact token", () => {
    expect(verifyWebhookToken("abc123", "abc123")).toBe(true);
    expect(verifyWebhookToken("abc123", "abc124")).toBe(false);
    expect(verifyWebhookToken("abc123", "abc1234")).toBe(false);
    expect(verifyWebhookToken("abc123", null)).toBe(false);
    expect(verifyWebhookToken(null, "abc123")).toBe(false);
  });
});
