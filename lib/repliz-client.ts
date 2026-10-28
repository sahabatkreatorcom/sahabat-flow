/**
 * Repliz API client.
 *
 * Repliz has no official Node SDK, so this module is a small typed wrapper
 * around the public REST API (https://api.repliz.com/public). Authentication is
 * HTTP Basic with a workspace's Access Key and Secret Key.
 *
 * Docs: https://docs.repliz.com/api/introduction.html
 */

const API_BASE = "https://api.repliz.com/public";

export class ReplizApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ReplizApiError";
    this.status = status;
  }
}

// ── Resource types ───────────────────────────────────────────────────────────

export interface ReplizAccount {
  _id: string;
  generatedId?: string;
  name?: string;
  username?: string;
  picture?: string;
  isConnected?: boolean;
  type?: string;
  additional?: Record<string, unknown>;
}

export interface ReplizAttachment {
  type?: string;
  url?: string;
  mimetype?: string;
  thumbnail?: string;
  name?: string;
  duration?: number;
  size?: number;
}

export interface ReplizChatMessage {
  _id: string;
  chatId?: string;
  messageId?: string;
  senderId?: string;
  isFromMe?: boolean;
  type?: string;
  text?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  image?: ReplizAttachment;
  video?: ReplizAttachment;
  audio?: ReplizAttachment;
  document?: ReplizAttachment;
  embed?: ReplizAttachment;
  sticker?: ReplizAttachment;
}

export interface ReplizChat {
  _id: string;
  accountId: string;
  senderId: string;
  senderName?: string;
  senderPicture?: string | null;
  unreadCount?: number;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: ReplizChatMessage;
  account?: ReplizAccount;
}

export interface ReplizConversationSession {
  id?: string;
  token?: string;
  isConnected?: boolean;
  isPasswordRequired?: boolean;
  passwordHint?: string;
  qrcode?: string;
  name?: string;
  picture?: string;
  generatedId?: string;
}

export interface ReplizAsset {
  id: string;
  name?: string;
  username?: string;
  picture?: string;
  token: string;
}

export interface ReplizPage<T> {
  docs: T[];
  totalDocs?: number;
  limit?: number;
  totalPages?: number;
  page?: number;
  hasNextPage?: boolean;
  nextPage?: number | null;
}

export interface ReplizSendMessageBody {
  type: "text" | "image" | "video" | "audio" | "document" | "button";
  text?: string;
  image?: { url: string; mimetype: string; thumbnail?: string };
  video?: {
    url: string;
    mimetype: string;
    duration: number;
    thumbnail?: string;
  };
  audio?: { url: string; mimetype: string; duration: number };
  document?: {
    url: string;
    name: string;
    size: number;
    mimetype: string;
  };
  button?: {
    text: string;
    image?: string;
    buttons: Array<{ type: "web_url"; title: string; url: string }>;
  };
}

export type ReplizOAuthPlatform =
  | "facebook"
  | "instagram"
  | "telegram"
  | "tiktok";

export const REPLIZ_OAUTH_PLATFORMS: readonly ReplizOAuthPlatform[] = [
  "instagram",
  "facebook",
  "telegram",
  "tiktok",
];

// ── Client ───────────────────────────────────────────────────────────────────

export interface ReplizClient {
  accounts: {
    list(params?: {
      types?: string[];
      search?: string;
      limit?: number;
      maxPages?: number;
    }): Promise<ReplizAccount[]>;
    delete(accountId: string): Promise<void>;
    authorize(platform: ReplizOAuthPlatform, redirect: string): Promise<string>;
    exchange(platform: ReplizOAuthPlatform, code: string): Promise<string>;
    listAssets(
      platform: "facebook",
      token: string
    ): Promise<ReplizAsset[]>;
    connect(
      platform: ReplizOAuthPlatform,
      body: Record<string, string>
    ): Promise<string>;
    reconnect(
      platform: ReplizOAuthPlatform,
      accountId: string,
      body: Record<string, string>
    ): Promise<void>;
    createSession(platform: "telegram" | "whatsapp"): Promise<string>;
    getSession(
      platform: "telegram" | "whatsapp",
      token: string
    ): Promise<ReplizConversationSession>;
    sendSessionPassword(
      platform: "telegram",
      token: string,
      password: string
    ): Promise<void>;
  };
  chats: {
    list(params?: {
      accountId?: string;
      status?: "unread" | "unreplied";
      search?: string;
      page?: number;
      limit?: number;
    }): Promise<ReplizPage<ReplizChat>>;
    messages(
      chatId: string,
      params?: { page?: number; limit?: number }
    ): Promise<ReplizPage<ReplizChatMessage>>;
    send(
      chatId: string,
      body: ReplizSendMessageBody
    ): Promise<{ messageId?: string }>;
    markRead(chatId: string): Promise<void>;
  };
  comments: {
    /** Public reply to a comment. `commentId` is the Repliz `_id`, not the platform id. */
    reply(commentId: string, text: string): Promise<void>;
    /** Private reply (DM) to the author of a comment. FB/IG only. */
    sendPrivateReply(
      contentId: string,
      body: { accountId: string; commentId: string; text: string }
    ): Promise<{ messageId?: string }>;
  };
}

function basicAuth(accessKey: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString("base64")}`;
}

function buildQuery(
  params: Record<string, string | number | string[] | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(`${key}[]`, item);
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function createReplizClient(
  accessKey: string,
  secretKey: string
): ReplizClient {
  async function request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: basicAuth(accessKey, secretKey),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message =
        (data as { message?: string } | null)?.message ||
        `Repliz API error (${response.status})`;
      throw new ReplizApiError(response.status, message);
    }

    return (data ?? {}) as T;
  }

  async function listAccounts({
    types,
    search,
    limit = 100,
    maxPages = 10,
  }: {
    types?: string[];
    search?: string;
    limit?: number;
    maxPages?: number;
  } = {}): Promise<ReplizAccount[]> {
    const accounts: ReplizAccount[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await request<ReplizPage<ReplizAccount>>(
        `/account${buildQuery({ page, limit, types, search })}`
      );
      accounts.push(...(res.docs ?? []));
      if (!res.hasNextPage || res.docs?.length === 0) break;
    }
    return accounts;
  }

  return {
    accounts: {
      list: listAccounts,
      delete: async (accountId) => {
        await request(`/account/${accountId}`, { method: "DELETE" });
      },
      authorize: async (platform, redirect) => {
        const res = await request<{ url?: string }>(
          `/account/${platform}/authorize${buildQuery({ redirect })}`
        );
        if (!res.url) throw new ReplizApiError(502, "Repliz returned no authorization URL");
        return res.url;
      },
      exchange: async (platform, code) => {
        const res = await request<{ token?: string }>(
          `/account/${platform}/exchange`,
          { method: "POST", body: JSON.stringify({ code }) }
        );
        if (!res.token) throw new ReplizApiError(502, "Repliz returned no exchange token");
        return res.token;
      },
      listAssets: async (platform, token) => {
        const res = await request<{ docs?: ReplizAsset[] }>(
          `/account/${platform}/page${buildQuery({ token })}`
        );
        return res.docs ?? [];
      },
      connect: async (platform, body) => {
        const res = await request<{ accountId?: string }>(
          `/account/${platform}/connect`,
          { method: "POST", body: JSON.stringify(body) }
        );
        if (!res.accountId) throw new ReplizApiError(502, "Repliz returned no account ID");
        return res.accountId;
      },
      reconnect: async (platform, accountId, body) => {
        await request(`/account/${platform}/connect/${accountId}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      createSession: async (platform) => {
        const res = await request<{ token?: string }>(
          `/account/${platform}/session`,
          { method: "POST" }
        );
        if (!res.token) throw new ReplizApiError(502, "Repliz returned no session token");
        return res.token;
      },
      getSession: async (platform, token) =>
        request<ReplizConversationSession>(
          `/account/${platform}/session${buildQuery({ token })}`
        ),
      sendSessionPassword: async (platform, token, password) => {
        await request(`/account/${platform}/session/password`, {
          method: "POST",
          body: JSON.stringify({ token, password }),
        });
      },
    },
    chats: {
      list: async (params = {}) =>
        request<ReplizPage<ReplizChat>>(
          `/chat${buildQuery({
            page: params.page ?? 1,
            limit: params.limit ?? 50,
            accountIds: params.accountId ? [params.accountId] : undefined,
            status: params.status,
            search: params.search,
          })}`
        ),
      messages: async (chatId, params = {}) =>
        request<ReplizPage<ReplizChatMessage>>(
          `/chat/${chatId}/message${buildQuery({
            page: params.page ?? 1,
            limit: params.limit ?? 50,
          })}`
        ),
      send: async (chatId, body) =>
        request<{ messageId?: string }>(`/chat/${chatId}/message`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      markRead: async (chatId) => {
        await request(`/chat/${chatId}/read`, { method: "POST" });
      },
    },
    comments: {
      reply: async (commentId, text) => {
        await request(`/comment/${commentId}`, {
          method: "POST",
          body: JSON.stringify({ text }),
        });
      },
      sendPrivateReply: async (contentId, body) =>
        request<{ messageId?: string }>(`/content/${contentId}/message`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
  };
}
