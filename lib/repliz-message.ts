import type {
  ReplizSendMessageBody,
} from "@/lib/repliz-client";

export interface BuildReplizMessageInput {
  /** Destination platform, so unsupported message types degrade instead of 400ing. */
  platform?: string;
  text?: string;
  imageUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  quickReplies?: Array<{ title: string; payload?: string }>;
  buttons?: Array<{
    title: string;
    type: "postback" | "url";
    payload?: string;
    url?: string;
  }>;
  carousel?: {
    elements: Array<{
      imageUrl?: string;
      title: string;
      subtitle?: string;
      buttons?: Array<{
        type: "postback" | "url";
        title: string;
        payload?: string;
        url?: string;
      }>;
    }>;
  };
}

/** Repliz link buttons: 1–3 per message, title max 20 characters. */
const MAX_LINK_BUTTONS = 3;
const MAX_BUTTON_TITLE = 20;
const MAX_BUTTON_TEXT = 640;

// https://docs.repliz.com/api/chat/send-message.html#supported-message-types
const BUTTON_PLATFORMS = new Set(["facebook", "instagram"]);
const IMAGE_PLATFORMS = new Set(["facebook", "instagram", "telegram"]);

function truncate(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit) : value;
}

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Repliz sends one message type per request. This builder turns Sahabat Kreator's
 * rich message model into a small sequence of Repliz messages:
 *
 * - text → `text`
 * - image → `image` on Facebook/Instagram/Telegram; TikTok gets the URL as text
 * - URL buttons → `button` on Facebook/Instagram (max 3, extra buttons become
 *   text links); Telegram and TikTok get every link in the text
 * - quick replies / postback buttons / carousels → numbered text fallback
 * - video/audio/document → text with the public URL, since Repliz requires
 *   metadata (duration, size) that Sahabat Kreator does not collect
 */
export function buildReplizMessages(
  input: BuildReplizMessageInput
): ReplizSendMessageBody[] {
  let text = input.text?.trim() ?? "";
  const platform = input.platform?.toLowerCase();
  const supportsButtons = !platform || BUTTON_PLATFORMS.has(platform);
  const supportsImages = !platform || IMAGE_PLATFORMS.has(platform);

  const mediaUrl = input.mediaUrl || input.imageUrl;
  const mediaType =
    input.mediaType || (input.imageUrl ? "image" : undefined);
  const isImage =
    supportsImages && !!mediaUrl && (!mediaType || mediaType === "image");

  // Carousel: Repliz has no generic template, so flatten the cards to text.
  if (input.carousel?.elements?.length) {
    const cards = input.carousel.elements.map((el, index) => {
      let card = `${index + 1}. ${el.title}`;
      if (el.subtitle) card += `\n   ${el.subtitle}`;
      for (const button of el.buttons ?? []) {
        card +=
          button.type === "url" && button.url
            ? `\n   ${button.title}: ${button.url}`
            : `\n   ${button.title}`;
      }
      return card;
    });
    text = text ? `${text}\n\n${cards.join("\n\n")}` : cards.join("\n\n");
  }

  // Postback buttons and quick replies cannot carry a payload in Repliz (only
  // link buttons exist), so offer them as numbered options the contact can type.
  const numbered = [
    ...(input.quickReplies ?? []).map((option) => ({
      title: option.title,
      url: undefined as string | undefined,
    })),
    ...(input.buttons ?? [])
      .filter((button) => button.type !== "url" || !button.url)
      .map((button) => ({ title: button.title, url: undefined })),
  ];
  if (numbered.length) {
    const options = numbered
      .map((option, index) => `${index + 1}. ${option.title}`)
      .join("\n");
    text = text ? `${text}\n\n${options}` : options;
  }

  const allLinkButtons = (input.buttons ?? [])
    .filter((button) => button.type === "url" && !!button.url)
    .map((button) => ({
      type: "web_url" as const,
      title: truncate(button.title, MAX_BUTTON_TITLE),
      url: button.url as string,
    }));

  // Telegram and TikTok have no button message, so every link goes into the text.
  const linkButtons = supportsButtons
    ? allLinkButtons.slice(0, MAX_LINK_BUTTONS)
    : [];
  const extraLinks = supportsButtons
    ? allLinkButtons.slice(MAX_LINK_BUTTONS)
    : allLinkButtons;
  if (extraLinks.length) {
    const links = extraLinks.map((link) => `${link.title}: ${link.url}`).join("\n");
    text = text ? `${text}\n\n${links}` : links;
  }

  const messages: ReplizSendMessageBody[] = [];

  // A non-image attachment without metadata would be rejected by Repliz, so
  // deliver it as a link instead of silently dropping the file.
  if (mediaUrl && !isImage) {
    text = text ? `${text}\n\n${mediaUrl}` : mediaUrl;
  }

  // With link buttons the button message already carries the text, so sending
  // both would deliver the same text twice.
  if (text && !linkButtons.length) {
    messages.push({ type: "text", text });
  }

  if (linkButtons.length) {
    messages.push({
      type: "button",
      button: {
        text: truncate(text || "Choose an option", MAX_BUTTON_TEXT),
        ...(isImage && mediaUrl ? { image: mediaUrl } : {}),
        buttons: linkButtons,
      },
    });
  } else if (isImage && mediaUrl) {
    messages.push({
      type: "image",
      image: {
        url: mediaUrl,
        mimetype: imageMimeType(mediaUrl),
      },
    });
  }

  return messages;
}
