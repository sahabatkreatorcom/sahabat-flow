import type { NodeType } from "@/lib/types/database";

/**
 * Built-in flow templates.
 *
 * Plain data, so a test can hold them to the shapes the engine actually reads.
 * A template that drifts out of sync is worse than no template: it looks right
 * in the gallery and does nothing at runtime.
 *
 *   - a message node keeps its copy in `messages[].text`, not `text`
 *   - action nodes are `type: "action"` with the concrete action in `actionType`
 *   - condition branches leave through the `yes` / `no` handles, an AB split
 *     through `split-<index>` — those are the handles the canvas draws
 *   - `{{message}}` is the last inbound text; `{{name}}` and friends only exist
 *     once a Set Field node has written them
 */

export type FlowTemplateIcon =
  | "message"
  | "help"
  | "userPlus"
  | "gift"
  | "bot"
  | "shuffle"
  | "bellOff";

export interface FlowTemplateNode {
  id: string;
  /** A canvas node type, or "action" with the real one in data.actionType. */
  type: NodeType | "action";
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowTemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: FlowTemplateIcon;
  iconColor: string;
  iconBg: string;
  nodes: FlowTemplateNode[];
  edges: FlowTemplateEdge[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "welcome-flow",
    name: "Welcome Flow",
    description:
      "Greet a new follower, offer two quick replies, then follow up once after 30 minutes if they stay quiet.",
    category: "Onboarding",
    icon: "message",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: { label: "New follower", triggerType: "welcome", keywords: [] },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 260, y: 160 },
        data: {
          label: "Greeting",
          messages: [
            {
              text: "Hai! Makasih sudah mampir 👋\nAku bisa bantu lihat katalog atau sambungkan ke admin.",
              quickReplies: [
                { title: "Lihat katalog", payload: "KATALOG" },
                { title: "Tanya admin", payload: "ADMIN" },
              ],
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 340 },
        data: {
          actionType: "smartDelay",
          label: "Wait 30 minutes",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "msg-2",
        type: "sendMessage",
        position: { x: 260, y: 500 },
        data: {
          label: "Follow-up",
          messages: [
            {
              text: "Belum sempat balas? Tenang, aku masih di sini. Kalau mau lihat katalognya, tinggal ketik *katalog* ya 🙂",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 260, y: 660 },
        data: { actionType: "addTag", label: "Tag new follower", tagName: "baru" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "msg-2" },
      { id: "e4", source: "msg-2", target: "tag-1" },
    ],
  },
  {
    id: "faq-bot",
    name: "FAQ Bot",
    description:
      'Answer "help" / "faq" / "bantuan" with a menu, then branch on what the person actually types: pricing goes to a canned answer, everything else to a human.',
    category: "Support",
    icon: "help",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "FAQ trigger",
          triggerType: "keyword",
          keywords: [
            { value: "help", matchType: "exact" },
            { value: "faq", matchType: "exact" },
            { value: "bantuan", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-menu",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Menu",
          messages: [
            {
              text: "Tentu, aku bantu. Mau tanya soal apa?\n\n• *harga* — paket dan biaya\n• *lain* — langsung ke admin",
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 350 },
        data: {
          actionType: "smartDelay",
          label: "Wait for topic",
          timeout: 15,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: 260, y: 510 },
        data: {
          label: "Asked about pricing?",
          logic: "and",
          conditions: [
            { field: "variable:message", operator: "contains", value: "harga" },
          ],
        },
      },
      {
        id: "msg-pricing",
        type: "sendMessage",
        position: { x: 40, y: 690 },
        data: {
          label: "Pricing answer",
          messages: [
            {
              text: "Ini paketnya:\n\n• Starter — Rp99rb/bulan\n• Pro — Rp249rb/bulan\n• Bisnis — Rp599rb/bulan\n\nSemua bisa dicoba 7 hari gratis.",
            },
          ],
        },
      },
      {
        id: "msg-other",
        type: "sendMessage",
        position: { x: 480, y: 690 },
        data: {
          label: "Hand off",
          messages: [
            {
              text: "Oke, pertanyaanmu aku teruskan ke admin kami ya. Biasanya dibalas dalam beberapa menit 🙏",
            },
          ],
        },
      },
      {
        id: "handoff",
        type: "action",
        position: { x: 480, y: 870 },
        data: {
          actionType: "humanTakeover",
          label: "Human takeover",
          message: "Admin needed",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-menu" },
      { id: "e2", source: "msg-menu", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "cond-1" },
      {
        id: "e4",
        source: "cond-1",
        target: "msg-pricing",
        sourceHandle: "yes",
      },
      { id: "e5", source: "cond-1", target: "msg-other", sourceHandle: "no" },
      { id: "e6", source: "msg-other", target: "handoff" },
    ],
  },
  {
    id: "lead-capture",
    name: "Lead Capture",
    description:
      "Ask for a name and an email one at a time, store both as custom fields, tag the contact as a lead, then thank them.",
    category: "Marketing",
    icon: "userPlus",
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Lead trigger",
          triggerType: "keyword",
          keywords: [
            { value: "info", matchType: "contains" },
            { value: "minat", matchType: "contains" },
            { value: "pricing", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-name",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Ask name",
          messages: [{ text: "Siap, aku bantu. Boleh tahu nama kamu?" }],
        },
      },
      {
        id: "wait-name",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for name",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "set-name",
        type: "action",
        position: { x: 260, y: 490 },
        data: {
          actionType: "setCustomField",
          label: "Save name",
          fieldSlug: "name",
          value: "{{message}}",
        },
      },
      {
        id: "msg-email",
        type: "sendMessage",
        position: { x: 260, y: 650 },
        data: {
          label: "Ask email",
          messages: [
            {
              text: "Makasih {{name}}! Kirim email kamu ya, biar detailnya aku kirim ke sana.",
            },
          ],
        },
      },
      {
        id: "wait-email",
        type: "action",
        position: { x: 260, y: 810 },
        data: {
          actionType: "smartDelay",
          label: "Wait for email",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "set-email",
        type: "action",
        position: { x: 260, y: 970 },
        data: {
          actionType: "setCustomField",
          label: "Save email",
          fieldSlug: "email",
          value: "{{message}}",
        },
      },
      {
        id: "tag-lead",
        type: "action",
        position: { x: 260, y: 1130 },
        data: { actionType: "addTag", label: "Tag as lead", tagName: "lead" },
      },
      {
        id: "msg-thanks",
        type: "sendMessage",
        position: { x: 260, y: 1290 },
        data: {
          label: "Thank you",
          messages: [
            {
              text: "Mantap, datanya sudah aku simpan. Detail lengkapnya menyusul ke email kamu ya 🙌",
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-name" },
      { id: "e2", source: "msg-name", target: "wait-name" },
      { id: "e3", source: "wait-name", target: "set-name" },
      { id: "e4", source: "set-name", target: "msg-email" },
      { id: "e5", source: "msg-email", target: "wait-email" },
      { id: "e6", source: "wait-email", target: "set-email" },
      { id: "e7", source: "set-email", target: "tag-lead" },
      { id: "e8", source: "tag-lead", target: "msg-thanks" },
    ],
  },
  {
    id: "comment-lead-magnet",
    name: "Comment → DM Lead Magnet",
    description:
      'Someone comments "template" on a post: reply publicly, send the link by DM, then follow up. Instagram and Facebook only.',
    category: "Growth",
    icon: "gift",
    iconColor: "text-pink-600",
    iconBg: "bg-pink-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Comment keyword",
          triggerType: "comment_keyword",
          keywords: [
            { value: "template", matchType: "contains" },
            { value: "gratis", matchType: "contains" },
          ],
        },
      },
      {
        id: "public-reply",
        type: "action",
        position: { x: 260, y: 170 },
        data: {
          actionType: "commentReply",
          label: "Public reply",
          text: "Sudah aku kirim ke DM ya 🙌",
        },
      },
      {
        id: "dm-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "privateReply",
          label: "DM the link",
          text: "Hai! Ini template gratis yang kamu minta:\nhttps://sahabatkreator.com/template\n\nKalau bingung cara pakainya, balas aja di sini.",
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 260, y: 490 },
        data: { label: "Wait 1 day", duration: 1, unit: "days" },
      },
      {
        id: "msg-followup",
        type: "sendMessage",
        position: { x: 260, y: 650 },
        data: {
          label: "Follow-up",
          messages: [
            {
              text: "Sudah sempat buka templatenya? Kalau mau, aku bisa bantu sesuaikan dengan brand kamu.",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 260, y: 810 },
        data: {
          actionType: "addTag",
          label: "Tag lead magnet",
          tagName: "lead-magnet",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "public-reply" },
      { id: "e2", source: "public-reply", target: "dm-1" },
      { id: "e3", source: "dm-1", target: "delay-1" },
      { id: "e4", source: "delay-1", target: "msg-followup" },
      { id: "e5", source: "msg-followup", target: "tag-1" },
    ],
  },
  {
    id: "ai-support",
    name: "AI Support Bot",
    description:
      "Answer greetings with an AI node that keeps the last 10 messages as context, then tag the contact so you can find AI-handled chats later.",
    category: "Support",
    icon: "bot",
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Greeting trigger",
          triggerType: "keyword",
          keywords: [
            { value: "halo", matchType: "startsWith" },
            { value: "hai", matchType: "startsWith" },
            { value: "hello", matchType: "startsWith" },
          ],
        },
      },
      {
        id: "ai-1",
        type: "aiResponse",
        position: { x: 260, y: 170 },
        data: {
          label: "AI answer",
          model: "openai/gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 500,
          contextMessages: 10,
          systemPrompt:
            "Kamu adalah asisten customer service Sahabat Kreator. Jawab dalam bahasa Indonesia yang ramah dan singkat (maksimal 3 kalimat). Bantu soal pembuatan chatbot, koneksi channel Instagram/Facebook/Telegram/TikTok, dan paket langganan. Kalau pertanyaannya di luar itu atau butuh tindakan manual, arahkan ke admin dan jangan mengarang jawaban.",
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 260, y: 350 },
        data: {
          actionType: "addTag",
          label: "Tag AI handled",
          tagName: "ai-handled",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "ai-1" },
      { id: "e2", source: "ai-1", target: "tag-1" },
    ],
  },
  {
    id: "ab-welcome",
    name: "A/B Test Welcome",
    description:
      "Split new followers 50/50 between two opening messages, then tag both branches so you can compare which one gets more replies.",
    category: "Growth",
    icon: "shuffle",
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: { label: "New follower", triggerType: "welcome", keywords: [] },
      },
      {
        id: "split-1",
        type: "action",
        position: { x: 260, y: 170 },
        data: {
          actionType: "abSplit",
          label: "50 / 50 split",
          paths: [
            { name: "A", weight: 50 },
            { name: "B", weight: 50 },
          ],
        },
      },
      {
        id: "msg-a",
        type: "sendMessage",
        position: { x: 40, y: 360 },
        data: {
          label: "Variant A — casual",
          messages: [{ text: "Heyy! Makasih udah follow 🎉 Mau lihat yang lagi ramai sekarang?" }],
        },
      },
      {
        id: "msg-b",
        type: "sendMessage",
        position: { x: 480, y: 360 },
        data: {
          label: "Variant B — direct",
          messages: [
            {
              text: "Halo! Aku bisa bantu bikin chatbot untuk DM dan komentar kamu. Mau mulai dari mana?",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 260, y: 540 },
        data: {
          actionType: "addTag",
          label: "Tag welcome test",
          tagName: "welcome-test",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "split-1" },
      { id: "e2", source: "split-1", target: "msg-a", sourceHandle: "split-0" },
      { id: "e3", source: "split-1", target: "msg-b", sourceHandle: "split-1" },
      { id: "e4", source: "msg-a", target: "tag-1" },
      { id: "e5", source: "msg-b", target: "tag-1" },
    ],
  },
  {
    id: "opt-out",
    name: "Stop Promo (Opt-out)",
    description:
      'Handle "stop" / "berhenti" cleanly: unsubscribe people who are still subscribed and confirm, tell the rest they are already off the list.',
    category: "Compliance",
    icon: "bellOff",
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Opt-out keyword",
          triggerType: "keyword",
          keywords: [
            { value: "stop", matchType: "exact" },
            { value: "berhenti", matchType: "exact" },
            { value: "unsub", matchType: "startsWith" },
          ],
        },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: 260, y: 170 },
        data: {
          label: "Still subscribed?",
          logic: "and",
          conditions: [
            { field: "is_subscribed", operator: "equals", value: "true" },
          ],
        },
      },
      {
        id: "unsub-1",
        type: "action",
        position: { x: 40, y: 350 },
        data: { actionType: "unsubscribe", label: "Unsubscribe" },
      },
      {
        id: "msg-done",
        type: "sendMessage",
        position: { x: 40, y: 500 },
        data: {
          label: "Confirm opt-out",
          messages: [
            {
              text: "Oke, kamu sudah berhenti menerima promo dari kami. Kalau berubah pikiran, ketik *mulai* kapan saja ya.",
            },
          ],
        },
      },
      {
        id: "msg-already",
        type: "sendMessage",
        position: { x: 480, y: 350 },
        data: {
          label: "Already opted out",
          messages: [
            {
              text: "Kamu memang sudah tidak menerima promo dari kami. Tidak ada yang perlu dilakukan 🙂",
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "cond-1" },
      { id: "e2", source: "cond-1", target: "unsub-1", sourceHandle: "yes" },
      { id: "e3", source: "unsub-1", target: "msg-done" },
      { id: "e4", source: "cond-1", target: "msg-already", sourceHandle: "no" },
    ],
  },
];
