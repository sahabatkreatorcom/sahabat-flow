"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MessageSquare,
  HelpCircle,
  UserPlus,
  GitBranch,
  Loader2,
  BookmarkPlus,
  ArrowLeft,
  Gift,
  Bot,
  Shuffle,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLOW_TEMPLATES,
  type FlowTemplate,
  type FlowTemplateIcon,
} from "@/lib/flow-templates";
import Link from "next/link";


// --- Component ---

const templateIcons: Record<FlowTemplateIcon, React.ElementType> = {
  message: MessageSquare,
  help: HelpCircle,
  userPlus: UserPlus,
  gift: Gift,
  bot: Bot,
  shuffle: Shuffle,
  bellOff: BellOff,
};

export function TemplatesView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function handleUseTemplate(template: FlowTemplate) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setCreating(template.id);

    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          nodes: template.nodes,
          edges: template.edges,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create flow");
      }

      const flow = await res.json();
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err) {
      console.error("Failed to create flow from template:", err);
      pendingRef.current = false;
      setCreating(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/flows"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Flows
              </Link>
            </div>
            <h1 className="text-2xl font-bold">Flow Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a pre-built flow and customize it to your needs
            </p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
            title="Coming soon"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save Current Flow as Template
          </button>
        </div>
      </div>

      {/* Template gallery */}
      <div className="flex-1 overflow-auto p-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW_TEMPLATES.map((template) => {
            const isCreating = creating === template.id;
            const Icon = templateIcons[template.icon];
            const nodeCount = template.nodes.length;

            return (
              <div
                key={template.id}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                {/* Icon + category */}
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      template.iconBg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", template.iconColor)} />
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {template.category}
                  </span>
                </div>

                {/* Name + description */}
                <h3 className="mt-4 text-sm font-semibold group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {template.description}
                </p>

                {/* Node count */}
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span>
                    {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
                  </span>
                </div>

                {/* Use template button */}
                <button
                  onClick={() => handleUseTemplate(template)}
                  disabled={!!creating}
                  className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isCreating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Use Template
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
