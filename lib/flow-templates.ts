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
  | "bellOff"
  | "package"
  | "calendar"
  | "target"
  | "star"
  | "shoppingBag"
  | "sparkles"
  | "megaphone";

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
  {
    id: "order-status",
    name: "Order Status Lookup",
    description:
      'Someone asks "pesanan" / "resi": ask for the order number, wait, save it as a custom field, then answer with the status or hand off when the number is unknown.',
    category: "Support",
    icon: "package",
    iconColor: "text-orange-600",
    iconBg: "bg-orange-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Order keyword",
          triggerType: "keyword",
          keywords: [
            { value: "pesanan", matchType: "contains" },
            { value: "order", matchType: "contains" },
            { value: "resi", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-ask",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Ask order number",
          messages: [
            { text: "Boleh kirim nomor pesanan kamu? Contohnya *SK-10293*." },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for order number",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "set-order",
        type: "action",
        position: { x: 260, y: 490 },
        data: {
          actionType: "setCustomField",
          label: "Save order number",
          fieldSlug: "last_order",
          value: "{{message}}",
        },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: 260, y: 650 },
        data: {
          label: "Order number known?",
          logic: "and",
          conditions: [{ field: "last_order", operator: "exists", value: "" }],
        },
      },
      {
        id: "msg-found",
        type: "sendMessage",
        position: { x: 40, y: 830 },
        data: {
          label: "Status answer",
          messages: [
            {
              text: "Pesanan {{last_order}} ketemu ✅\n\nStatus: sedang dikemas di gudang.\nEstimasi kirim: besok sore.\n\nMau aku kabari lagi kalau resinya keluar?",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 40, y: 990 },
        data: {
          actionType: "addTag",
          label: "Tag order checked",
          tagName: "cek-pesanan",
        },
      },
      {
        id: "msg-missing",
        type: "sendMessage",
        position: { x: 480, y: 830 },
        data: {
          label: "Not found",
          messages: [
            {
              text: "Hmm, nomor itu belum ada di sistem kami. Aku sambungkan ke admin biar dicek manual ya 🙏",
            },
          ],
        },
      },
      {
        id: "handoff",
        type: "action",
        position: { x: 480, y: 990 },
        data: {
          actionType: "humanTakeover",
          label: "Human takeover",
          message: "Nomor pesanan tidak ditemukan",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-ask" },
      { id: "e2", source: "msg-ask", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "set-order" },
      { id: "e4", source: "set-order", target: "cond-1" },
      { id: "e5", source: "cond-1", target: "msg-found", sourceHandle: "yes" },
      { id: "e6", source: "msg-found", target: "tag-1" },
      { id: "e7", source: "cond-1", target: "msg-missing", sourceHandle: "no" },
      { id: "e8", source: "msg-missing", target: "handoff" },
    ],
  },
  {
    id: "booking",
    name: "Appointment Booking",
    description:
      "Service menu with quick replies, a nested condition for each service, then collect the preferred date, confirm it and tag the booking.",
    category: "Sales",
    icon: "calendar",
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Booking keyword",
          triggerType: "keyword",
          keywords: [
            { value: "booking", matchType: "contains" },
            { value: "jadwal", matchType: "contains" },
            { value: "reservasi", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-menu",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Service menu",
          messages: [
            {
              text: "Halo! Mau booking layanan yang mana?",
              quickReplies: [
                { title: "Potong rambut", payload: "POTONG" },
                { title: "Coloring", payload: "COLOR" },
                { title: "Lainnya", payload: "LAIN" },
              ],
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for choice",
          timeout: 15,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-haircut",
        type: "condition",
        position: { x: 260, y: 490 },
        data: {
          label: "Haircut?",
          logic: "and",
          conditions: [
            { field: "variable:message", operator: "contains", value: "potong" },
          ],
        },
      },
      {
        id: "msg-haircut",
        type: "sendMessage",
        position: { x: 20, y: 670 },
        data: {
          label: "Haircut price",
          messages: [
            {
              text: "Potong rambut Rp75rb, durasi sekitar 45 menit. Termasuk cuci dan styling ya.",
            },
          ],
        },
      },
      {
        id: "set-haircut",
        type: "action",
        position: { x: 20, y: 830 },
        data: {
          actionType: "setCustomField",
          label: "Save service",
          fieldSlug: "layanan",
          value: "Potong rambut",
        },
      },
      {
        id: "cond-color",
        type: "condition",
        position: { x: 500, y: 670 },
        data: {
          label: "Coloring?",
          logic: "and",
          conditions: [
            { field: "variable:message", operator: "contains", value: "color" },
          ],
        },
      },
      {
        id: "msg-color",
        type: "sendMessage",
        position: { x: 380, y: 850 },
        data: {
          label: "Coloring price",
          messages: [
            {
              text: "Coloring mulai Rp250rb, tergantung panjang rambut. Konsultasi warna gratis dulu.",
            },
          ],
        },
      },
      {
        id: "set-color",
        type: "action",
        position: { x: 380, y: 1010 },
        data: {
          actionType: "setCustomField",
          label: "Save service",
          fieldSlug: "layanan",
          value: "Coloring",
        },
      },
      {
        id: "msg-other",
        type: "sendMessage",
        position: { x: 700, y: 850 },
        data: {
          label: "Other request",
          messages: [
            {
              text: "Untuk layanan lain, aku teruskan ke admin kami ya biar lebih tepat.",
            },
          ],
        },
      },
      {
        id: "handoff",
        type: "action",
        position: { x: 700, y: 1010 },
        data: {
          actionType: "humanTakeover",
          label: "Human takeover",
          message: "Permintaan layanan lain",
        },
      },
      {
        id: "msg-ask-date",
        type: "sendMessage",
        position: { x: 200, y: 1170 },
        data: {
          label: "Ask date",
          messages: [
            {
              text: "Mau datang kapan? Tulis tanggal dan jamnya ya, misalnya *Sabtu 10 pagi*.",
            },
          ],
        },
      },
      {
        id: "wait-date",
        type: "action",
        position: { x: 200, y: 1330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for date",
          timeout: 60,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "set-date",
        type: "action",
        position: { x: 200, y: 1490 },
        data: {
          actionType: "setCustomField",
          label: "Save date",
          fieldSlug: "jadwal",
          value: "{{message}}",
        },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 200, y: 1650 },
        data: {
          label: "Confirm",
          messages: [
            {
              text: "Siap! {{layanan}} pada {{jadwal}} sudah aku catat. Admin akan konfirmasi ketersediaannya sebentar lagi ya 🙌",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 200, y: 1810 },
        data: { actionType: "addTag", label: "Tag booking", tagName: "booking" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-menu" },
      { id: "e2", source: "msg-menu", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "cond-haircut" },
      {
        id: "e4",
        source: "cond-haircut",
        target: "msg-haircut",
        sourceHandle: "yes",
      },
      { id: "e5", source: "msg-haircut", target: "set-haircut" },
      { id: "e6", source: "set-haircut", target: "msg-ask-date" },
      { id: "e7", source: "cond-haircut", target: "cond-color", sourceHandle: "no" },
      { id: "e8", source: "cond-color", target: "msg-color", sourceHandle: "yes" },
      { id: "e9", source: "msg-color", target: "set-color" },
      { id: "e10", source: "set-color", target: "msg-ask-date" },
      { id: "e11", source: "cond-color", target: "msg-other", sourceHandle: "no" },
      { id: "e12", source: "msg-other", target: "handoff" },
      { id: "e13", source: "msg-ask-date", target: "wait-date" },
      { id: "e14", source: "wait-date", target: "set-date" },
      { id: "e15", source: "set-date", target: "msg-confirm" },
      { id: "e16", source: "msg-confirm", target: "tag-1" },
    ],
  },
  {
    id: "product-quiz",
    name: "Product Recommender Quiz",
    description:
      "One question with quick replies, a branch per budget, a different tag on each branch, then a shared closing message.",
    category: "Sales",
    icon: "target",
    iconColor: "text-teal-600",
    iconBg: "bg-teal-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Recommendation keyword",
          triggerType: "keyword",
          keywords: [
            { value: "rekomendasi", matchType: "contains" },
            { value: "bingung pilih", matchType: "contains" },
            { value: "saran", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-q1",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Budget question",
          messages: [
            {
              text: "Biar rekomendasinya pas: budget kamu di kisaran mana?",
              quickReplies: [
                { title: "Di bawah 150rb", payload: "BUDGET" },
                { title: "150rb ke atas", payload: "PREMIUM" },
              ],
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for answer",
          timeout: 15,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-budget",
        type: "condition",
        position: { x: 260, y: 490 },
        data: {
          label: "Budget tier?",
          logic: "and",
          conditions: [
            { field: "variable:message", operator: "contains", value: "150" },
          ],
        },
      },
      {
        id: "msg-budget",
        type: "sendMessage",
        position: { x: 40, y: 670 },
        data: {
          label: "Budget pick",
          messages: [
            {
              text: "Untuk budget di bawah 150rb, aku sarankan *Paket Hemat* — cukup untuk 1 channel dan 500 kontak. Paling pas buat yang baru mulai.",
            },
          ],
        },
      },
      {
        id: "tag-budget",
        type: "action",
        position: { x: 40, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag budget tier",
          tagName: "minat-hemat",
        },
      },
      {
        id: "msg-premium",
        type: "sendMessage",
        position: { x: 480, y: 670 },
        data: {
          label: "Premium pick",
          messages: [
            {
              text: "Kalau budgetnya lega, *Paket Pro* lebih worth it — semua channel, otomasi tanpa batas, dan prioritas support.",
            },
          ],
        },
      },
      {
        id: "tag-premium",
        type: "action",
        position: { x: 480, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag premium tier",
          tagName: "minat-pro",
        },
      },
      {
        id: "msg-cta",
        type: "sendMessage",
        position: { x: 260, y: 990 },
        data: {
          label: "Closing",
          messages: [
            {
              text: "Mau aku bantu aktifkan sekarang, atau kirim detail perbandingannya dulu?",
              quickReplies: [
                { title: "Aktifkan sekarang", payload: "AKTIF" },
                { title: "Kirim detail", payload: "DETAIL" },
              ],
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-q1" },
      { id: "e2", source: "msg-q1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "cond-budget" },
      { id: "e4", source: "cond-budget", target: "msg-budget", sourceHandle: "yes" },
      { id: "e5", source: "msg-budget", target: "tag-budget" },
      { id: "e6", source: "tag-budget", target: "msg-cta" },
      {
        id: "e7",
        source: "cond-budget",
        target: "msg-premium",
        sourceHandle: "no",
      },
      { id: "e8", source: "msg-premium", target: "tag-premium" },
      { id: "e9", source: "tag-premium", target: "msg-cta" },
    ],
  },
  {
    id: "nps-survey",
    name: "Feedback Score",
    description:
      "Ask for a 1–5 score and compare it numerically: happy customers get a thank-you and a promoter tag, unhappy ones get an apology and a human handoff.",
    category: "Retention",
    icon: "star",
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Feedback keyword",
          triggerType: "keyword",
          keywords: [
            { value: "feedback", matchType: "contains" },
            { value: "rating", matchType: "contains" },
            { value: "ulasan", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-ask",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Ask score",
          messages: [
            {
              text: "Boleh nilai pengalaman kamu bareng kami? Balas angka 1–5 (5 paling puas).",
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for score",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-score",
        type: "condition",
        position: { x: 260, y: 490 },
        data: {
          label: "Score above 3?",
          logic: "and",
          conditions: [{ field: "variable:message", operator: "gt", value: "3" }],
        },
      },
      {
        id: "msg-thanks",
        type: "sendMessage",
        position: { x: 40, y: 670 },
        data: {
          label: "Thank you",
          messages: [
            {
              text: "Makasih banyak! Kalau sempat, boleh banget tulis ulasan singkat di postingan terakhir kami 🙏",
            },
          ],
        },
      },
      {
        id: "tag-promoter",
        type: "action",
        position: { x: 40, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag promoter",
          tagName: "promoter",
        },
      },
      {
        id: "msg-sorry",
        type: "sendMessage",
        position: { x: 480, y: 670 },
        data: {
          label: "Apology",
          messages: [
            {
              text: "Maaf banget pengalamannya kurang enak. Aku sambungkan ke admin sekarang biar bisa dibantu langsung.",
            },
          ],
        },
      },
      {
        id: "tag-detractor",
        type: "action",
        position: { x: 480, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag detractor",
          tagName: "detractor",
        },
      },
      {
        id: "handoff",
        type: "action",
        position: { x: 480, y: 990 },
        data: {
          actionType: "humanTakeover",
          label: "Human takeover",
          message: "Skor feedback rendah",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-ask" },
      { id: "e2", source: "msg-ask", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "cond-score" },
      { id: "e4", source: "cond-score", target: "msg-thanks", sourceHandle: "yes" },
      { id: "e5", source: "msg-thanks", target: "tag-promoter" },
      { id: "e6", source: "cond-score", target: "msg-sorry", sourceHandle: "no" },
      { id: "e7", source: "msg-sorry", target: "tag-detractor" },
      { id: "e8", source: "tag-detractor", target: "handoff" },
    ],
  },
  {
    id: "catalog-carousel",
    name: "Carousel Catalog",
    description:
      "Send a three-card carousel with link buttons, then follow up a couple of hours later and tag everyone who asked for the catalog.",
    category: "Sales",
    icon: "shoppingBag",
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Catalog keyword",
          triggerType: "keyword",
          keywords: [
            { value: "katalog", matchType: "contains" },
            { value: "catalog", matchType: "contains" },
            { value: "produk", matchType: "contains" },
          ],
        },
      },
      {
        id: "msg-carousel",
        type: "sendMessage",
        position: { x: 260, y: 170 },
        data: {
          label: "Catalog carousel",
          messages: [
            {
              text: "Ini yang paling sering dipesan 👇 Ketuk kartunya buat lihat detail.",
              carousel: {
                elements: [
                  {
                    title: "Paket Hemat",
                    subtitle: "Rp99rb / bulan · 1 channel",
                    buttons: [
                      {
                        type: "url",
                        title: "Lihat detail",
                        url: "https://sahabatkreator.com/paket/hemat",
                      },
                    ],
                  },
                  {
                    title: "Paket Pro",
                    subtitle: "Rp249rb / bulan · semua channel",
                    buttons: [
                      {
                        type: "url",
                        title: "Lihat detail",
                        url: "https://sahabatkreator.com/paket/pro",
                      },
                    ],
                  },
                  {
                    title: "Paket Bisnis",
                    subtitle: "Rp599rb / bulan · tim & API",
                    buttons: [
                      {
                        type: "url",
                        title: "Lihat detail",
                        url: "https://sahabatkreator.com/paket/bisnis",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 260, y: 350 },
        data: { label: "Wait 2 hours", duration: 2, unit: "hours" },
      },
      {
        id: "msg-followup",
        type: "sendMessage",
        position: { x: 260, y: 510 },
        data: {
          label: "Follow-up",
          messages: [
            {
              text: "Sudah sempat lihat katalognya? Kalau ada yang mau ditanyakan soal fitur atau pembayaran, tanya aja di sini.",
            },
          ],
        },
      },
      {
        id: "tag-1",
        type: "action",
        position: { x: 260, y: 670 },
        data: {
          actionType: "addTag",
          label: "Tag catalog viewer",
          tagName: "lihat-katalog",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-carousel" },
      { id: "e2", source: "msg-carousel", target: "delay-1" },
      { id: "e3", source: "delay-1", target: "msg-followup" },
      { id: "e4", source: "msg-followup", target: "tag-1" },
    ],
  },
  {
    id: "ai-triage",
    name: "AI Triage with Escalation",
    description:
      "A default-reply flow: the AI drafts an answer without sending it, a condition checks whether it flagged the chat for a human, and only then is the reply sent.",
    category: "Support",
    icon: "bot",
    iconColor: "text-sky-600",
    iconBg: "bg-sky-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: { label: "Everything else", triggerType: "default", keywords: [] },
      },
      {
        id: "ai-1",
        type: "aiResponse",
        position: { x: 260, y: 170 },
        data: {
          label: "Draft answer",
          model: "openai/gpt-4o-mini",
          temperature: 0.5,
          maxTokens: 400,
          contextMessages: 10,
          sendDirectly: false,
          systemPrompt:
            "Kamu asisten customer service Sahabat Kreator. Jawab singkat dalam bahasa Indonesia (maksimal 3 kalimat) dan hanya soal produk, harga, serta cara koneksi channel. Kalau pertanyaannya butuh data akun, refund, atau tindakan manual, jangan menjawab: balas tepat dengan kata ADMIN saja.",
        },
      },
      {
        id: "cond-escalate",
        type: "condition",
        position: { x: 260, y: 350 },
        data: {
          label: "Needs a human?",
          logic: "and",
          conditions: [
            { field: "variable:ai_response", operator: "contains", value: "ADMIN" },
          ],
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 40, y: 530 },
        data: { label: "Send AI answer", messages: [{ text: "{{ai_response}}" }] },
      },
      {
        id: "tag-ai",
        type: "action",
        position: { x: 40, y: 690 },
        data: {
          actionType: "addTag",
          label: "Tag AI handled",
          tagName: "ai-handled",
        },
      },
      {
        id: "handoff",
        type: "action",
        position: { x: 480, y: 530 },
        data: {
          actionType: "humanTakeover",
          label: "Human takeover",
          message: "AI flagged this conversation",
        },
      },
      {
        id: "tag-escalated",
        type: "action",
        position: { x: 480, y: 690 },
        data: {
          actionType: "addTag",
          label: "Tag escalated",
          tagName: "perlu-admin",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "ai-1" },
      { id: "e2", source: "ai-1", target: "cond-escalate" },
      { id: "e3", source: "cond-escalate", target: "msg-1", sourceHandle: "no" },
      { id: "e4", source: "msg-1", target: "tag-ai" },
      { id: "e5", source: "cond-escalate", target: "handoff", sourceHandle: "yes" },
      { id: "e6", source: "handoff", target: "tag-escalated" },
    ],
  },
  {
    id: "vip-router",
    name: "VIP Router",
    description:
      'A "menu" keyword that routes on a contact tag: VIPs get a priority line, everyone else gets the normal menu. The only template that branches on tags.',
    category: "Support",
    icon: "sparkles",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: {
          label: "Menu keyword",
          triggerType: "keyword",
          keywords: [
            { value: "menu", matchType: "exact" },
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
              text: "Silakan pilih:",
              buttons: [
                { type: "postback", title: "Cek pesanan", payload: "PESANAN" },
                { type: "postback", title: "Bicara dengan admin", payload: "ADMIN" },
              ],
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 260, y: 330 },
        data: {
          actionType: "smartDelay",
          label: "Wait for choice",
          timeout: 15,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-vip",
        type: "condition",
        position: { x: 260, y: 490 },
        data: {
          label: "Is VIP?",
          logic: "and",
          conditions: [{ field: "tag:vip", operator: "equals", value: "true" }],
        },
      },
      {
        id: "msg-vip",
        type: "sendMessage",
        position: { x: 40, y: 670 },
        data: {
          label: "VIP line",
          messages: [
            {
              text: "Hai! Karena kamu pelanggan VIP, chat ini aku tandai prioritas — admin balas lebih dulu ya ✨",
            },
          ],
        },
      },
      {
        id: "tag-vip",
        type: "action",
        position: { x: 40, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag priority",
          tagName: "prioritas",
        },
      },
      {
        id: "msg-normal",
        type: "sendMessage",
        position: { x: 480, y: 670 },
        data: {
          label: "Normal menu",
          messages: [
            {
              text: "Oke! Ketik *pesanan* kalau mau cek kiriman, atau *admin* kalau mau bicara dengan tim kami.",
            },
          ],
        },
      },
      {
        id: "tag-normal",
        type: "action",
        position: { x: 480, y: 830 },
        data: {
          actionType: "addTag",
          label: "Tag menu used",
          tagName: "pakai-menu",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-menu" },
      { id: "e2", source: "msg-menu", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "cond-vip" },
      { id: "e4", source: "cond-vip", target: "msg-vip", sourceHandle: "yes" },
      { id: "e5", source: "msg-vip", target: "tag-vip" },
      { id: "e6", source: "cond-vip", target: "msg-normal", sourceHandle: "no" },
      { id: "e7", source: "msg-normal", target: "tag-normal" },
    ],
  },
  {
    id: "promo-optin",
    name: "Promo Opt-in",
    description:
      "New followers who are not subscribed get an offer with a yes/no quick reply; saying yes subscribes them and sends the code. Already-subscribed people get the promo straight away.",
    category: "Marketing",
    icon: "megaphone",
    iconColor: "text-lime-600",
    iconBg: "bg-lime-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 260, y: 0 },
        data: { label: "New follower", triggerType: "welcome", keywords: [] },
      },
      {
        id: "cond-sub",
        type: "condition",
        position: { x: 260, y: 170 },
        data: {
          label: "Already subscribed?",
          logic: "and",
          conditions: [{ field: "is_subscribed", operator: "equals", value: "true" }],
        },
      },
      {
        id: "msg-promo",
        type: "sendMessage",
        position: { x: 40, y: 350 },
        data: {
          label: "Promo",
          messages: [
            {
              text: "Promo bulan ini: diskon 30% untuk paket Pro, sampai akhir bulan. Mau aku bantu aktifkan?",
            },
          ],
        },
      },
      {
        id: "tag-promo",
        type: "action",
        position: { x: 40, y: 510 },
        data: {
          actionType: "addTag",
          label: "Tag promo sent",
          tagName: "promo-terkirim",
        },
      },
      {
        id: "msg-offer",
        type: "sendMessage",
        position: { x: 480, y: 350 },
        data: {
          label: "Ask permission",
          messages: [
            {
              text: "Hai! Kami punya promo bulan ini (diskon 30%). Boleh aku kirim infonya?",
              quickReplies: [
                { title: "Boleh", payload: "MAU" },
                { title: "Jangan dulu", payload: "NANTI" },
              ],
            },
          ],
        },
      },
      {
        id: "wait-1",
        type: "action",
        position: { x: 480, y: 510 },
        data: {
          actionType: "smartDelay",
          label: "Wait for consent",
          timeout: 30,
          timeoutUnit: "minutes",
        },
      },
      {
        id: "cond-consent",
        type: "condition",
        position: { x: 480, y: 670 },
        data: {
          label: "Said yes?",
          logic: "and",
          conditions: [
            { field: "variable:message", operator: "contains", value: "boleh" },
          ],
        },
      },
      {
        id: "sub-1",
        type: "action",
        position: { x: 380, y: 850 },
        data: { actionType: "subscribe", label: "Subscribe" },
      },
      {
        id: "msg-welcome-promo",
        type: "sendMessage",
        position: { x: 380, y: 1010 },
        data: {
          label: "Promo after opt-in",
          messages: [
            {
              text: "Siap, sudah aku daftarkan ✅\n\nIni kodenya: *SAHABAT30* — berlaku sampai akhir bulan, bisa dipakai di semua paket.",
            },
          ],
        },
      },
      {
        id: "tag-sub",
        type: "action",
        position: { x: 380, y: 1170 },
        data: {
          actionType: "addTag",
          label: "Tag subscriber",
          tagName: "subscriber",
        },
      },
      {
        id: "msg-later",
        type: "sendMessage",
        position: { x: 700, y: 850 },
        data: {
          label: "No thanks",
          messages: [
            {
              text: "Oke, tidak aku kirim ya. Kalau nanti berubah pikiran, tinggal ketik *promo* 🙂",
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "cond-sub" },
      { id: "e2", source: "cond-sub", target: "msg-promo", sourceHandle: "yes" },
      { id: "e3", source: "msg-promo", target: "tag-promo" },
      { id: "e4", source: "cond-sub", target: "msg-offer", sourceHandle: "no" },
      { id: "e5", source: "msg-offer", target: "wait-1" },
      { id: "e6", source: "wait-1", target: "cond-consent" },
      { id: "e7", source: "cond-consent", target: "sub-1", sourceHandle: "yes" },
      { id: "e8", source: "sub-1", target: "msg-welcome-promo" },
      { id: "e9", source: "msg-welcome-promo", target: "tag-sub" },
      { id: "e10", source: "cond-consent", target: "msg-later", sourceHandle: "no" },
    ],
  },
];
