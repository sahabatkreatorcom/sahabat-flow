import { describe, it, expect } from "vitest";
import { adaptMessage } from "./platform-adapter";

/**
 * Repliz gives Facebook and Instagram Messenger-native shapes, Telegram its
 * inline keyboard, and TikTok nothing but text. WhatsApp used to share the
 * Meta branch but is no longer a connectable platform.
 */
describe("adaptMessage for tiktok", () => {
  it("degrades a carousel to numbered text instead of a generic template", () => {
    const adapted = adaptMessage(
      {
        text: "Pick one",
        carousel: {
          elements: [
            { title: "Basic", subtitle: "10/mo", buttons: [{ title: "Buy", type: "url", url: "https://example.com/basic" }] },
            { title: "Pro", subtitle: "20/mo" },
          ],
        },
      },
      "tiktok"
    );

    expect(adapted.template).toBeUndefined();
    expect(adapted.text).toContain("1. Basic");
    expect(adapted.text).toContain("2. Pro");
    expect(adapted.text).toContain("https://example.com/basic");
  });

  it("keeps a link button's URL by rendering it as text", () => {
    const adapted = adaptMessage(
      { text: "Docs", buttons: [{ title: "Open", type: "url", url: "https://example.com" }] },
      "tiktok"
    );

    expect(adapted.buttons).toBeUndefined();
    expect(adapted.text).toContain("https://example.com");
  });

  it("turns reply buttons into numbered text options", () => {
    const adapted = adaptMessage(
      {
        text: "Confirm?",
        buttons: [
          { title: "Yes", type: "postback" as const, payload: "yes" },
          { title: "No", type: "postback" as const, payload: "no" },
        ],
      },
      "tiktok"
    );

    expect(adapted.buttons).toBeUndefined();
    expect(adapted.text).toContain("1. Yes");
    expect(adapted.text).toContain("2. No");
  });

  it("degrades quick replies to numbered text", () => {
    const adapted = adaptMessage(
      {
        text: "Pick",
        quickReplies: [
          { title: "A", payload: "a" },
          { title: "B", payload: "b" },
          { title: "C", payload: "c" },
          { title: "D", payload: "d" },
        ],
      },
      "tiktok"
    );

    expect(adapted.quickReplies).toBeUndefined();
    expect(adapted.text).toContain("4. D");
  });
});

describe("adaptMessage for telegram", () => {
  it("converts buttons to an inline keyboard", () => {
    const adapted = adaptMessage(
      { text: "Open", buttons: [{ title: "Docs", type: "url", url: "https://example.com" }] },
      "telegram"
    );

    expect(adapted.replyMarkup?.type).toBe("inline_keyboard");
    expect(adapted.replyMarkup?.keyboard[0][0]).toEqual({
      text: "Docs",
      url: "https://example.com",
    });
  });

  it("converts quick replies to a one-time reply keyboard", () => {
    const adapted = adaptMessage(
      { text: "Pick", quickReplies: [{ title: "Yes", payload: "yes" }] },
      "telegram"
    );

    expect(adapted.replyMarkup?.type).toBe("reply_keyboard");
    expect(adapted.replyMarkup?.oneTime).toBe(true);
  });
});

describe("adaptMessage for meta", () => {
  it("gives Facebook the generic template carousel", () => {
    const adapted = adaptMessage(
      { carousel: { elements: [{ title: "Basic" }] } },
      "facebook"
    );

    expect(adapted.template?.type).toBe("generic");
  });

  it("passes buttons through for Instagram", () => {
    const buttons = [{ title: "Yes", type: "postback" as const, payload: "yes" }];
    const adapted = adaptMessage({ text: "Confirm?", buttons }, "instagram");

    expect(adapted.buttons).toEqual(buttons);
  });
});
