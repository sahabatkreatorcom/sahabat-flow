import { describe, expect, it } from "vitest";
import { FLOW_TEMPLATES, type FlowTemplate } from "./flow-templates";
import { findBranchEdge } from "./flow-engine/handles";
import type { FlowEdge, FlowNode } from "./flow-engine/types";

/** Node types the engine dispatches on, plus the canvas wrapper. */
const ACTION_TYPES = new Set([
  "addTag",
  "removeTag",
  "setCustomField",
  "httpRequest",
  "goToFlow",
  "humanTakeover",
  "subscribe",
  "unsubscribe",
  "commentReply",
  "privateReply",
  "abSplit",
  "smartDelay",
  "enrollSequence",
]);

const CANVAS_TYPES = new Set(["trigger", "sendMessage", "condition", "delay", "aiResponse"]);

function asFlowNodes(template: FlowTemplate): FlowNode[] {
  return template.nodes as unknown as FlowNode[];
}

function asFlowEdges(template: FlowTemplate): FlowEdge[] {
  return template.edges as unknown as FlowEdge[];
}

describe("flow templates", () => {
  it("has unique template ids and node ids within each template", () => {
    const ids = FLOW_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const template of FLOW_TEMPLATES) {
      const nodeIds = template.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size, `${template.id} has duplicate node ids`).toBe(
        nodeIds.length
      );
    }
  });

  it("only references nodes that exist", () => {
    for (const template of FLOW_TEMPLATES) {
      const nodeIds = new Set(template.nodes.map((n) => n.id));
      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source), `${template.id}: ${edge.id} source`).toBe(true);
        expect(nodeIds.has(edge.target), `${template.id}: ${edge.id} target`).toBe(true);
      }
    }
  });

  it("uses node types the canvas can render and the engine can dispatch", () => {
    for (const template of FLOW_TEMPLATES) {
      for (const node of template.nodes) {
        if (node.type === "action") {
          const actionType = node.data.actionType;
          expect(
            ACTION_TYPES.has(String(actionType)),
            `${template.id}/${node.id}: unknown actionType ${String(actionType)}`
          ).toBe(true);
        } else {
          expect(
            CANVAS_TYPES.has(node.type),
            `${template.id}/${node.id}: unknown node type ${node.type}`
          ).toBe(true);
        }
      }
    }
  });

  it("keeps message copy where the engine reads it", () => {
    for (const template of FLOW_TEMPLATES) {
      for (const node of template.nodes) {
        const actionType = String(node.data.actionType ?? "");

        if (node.type === "action") {
          // commentReply / privateReply are the one pair that really does read
          // data.text; every other action node must not carry it.
          if (actionType === "commentReply" || actionType === "privateReply") {
            expect(
              typeof node.data.text === "string" && node.data.text.length > 0,
              `${template.id}/${node.id}: ${actionType} without text`
            ).toBe(true);
          } else {
            expect(node.data.text, `${template.id}/${node.id}`).toBeUndefined();
          }
          continue;
        }

        if (node.type !== "sendMessage") continue;

        // The old templates carried copy in `data.text`, which no node or
        // engine path ever read: the flow rendered empty and sent nothing.
        expect(node.data.text, `${template.id}/${node.id}`).toBeUndefined();

        const messages = node.data.messages;
        expect(Array.isArray(messages), `${template.id}/${node.id}: no messages`).toBe(
          true
        );
        for (const message of messages as Array<{ text?: string }>) {
          expect(
            typeof message.text === "string" && message.text.length > 0,
            `${template.id}/${node.id}: empty message`
          ).toBe(true);
        }
      }
    }
  });

  it("wires every branch handle the way the canvas draws it", () => {
    for (const template of FLOW_TEMPLATES) {
      const nodes = asFlowNodes(template);
      const edges = asFlowEdges(template);

      for (const node of nodes) {
        const outgoing = edges.filter((e) => e.source === node.id);

        if (node.type === "condition") {
          // The condition node renders `yes` / `no`. Anything else and the run
          // ends at the node, because no edge matches the handle it returns.
          expect(outgoing.length, `${template.id}/${node.id}`).toBeGreaterThan(0);
          for (const edge of outgoing) {
            expect(
              ["yes", "no"].includes(String(edge.sourceHandle)),
              `${template.id}/${edge.id}: handle ${String(edge.sourceHandle)}`
            ).toBe(true);
          }
        }

        if (
          String(node.type) === "action" &&
          (node.data as { actionType?: string }).actionType === "abSplit"
        ) {
          const paths = (node.data as { paths?: Array<{ name: string }> }).paths ?? [];
          expect(paths.length, `${template.id}/${node.id}: no split paths`).toBeGreaterThan(
            1
          );
          for (const edge of outgoing) {
            expect(
              /^split-\d+$/.test(String(edge.sourceHandle)),
              `${template.id}/${edge.id}: handle ${String(edge.sourceHandle)}`
            ).toBe(true);
          }
          // Every branch the split can pick must resolve to an edge.
          for (let i = 0; i < paths.length; i++) {
            expect(
              findBranchEdge(edges, node.id, `split-${i}`, paths),
              `${template.id}/${node.id}: branch ${i} is unwired`
            ).toBeDefined();
          }
        }
      }
    }
  });

  it("resolves condition branches through the engine helper", () => {
    for (const template of FLOW_TEMPLATES) {
      const nodes = asFlowNodes(template);
      const edges = asFlowEdges(template);

      for (const node of nodes) {
        if (node.type !== "condition") continue;
        const hasYes = edges.some(
          (e) => e.source === node.id && e.sourceHandle === "yes"
        );
        if (!hasYes) continue;

        expect(
          findBranchEdge(edges, node.id, "yes"),
          `${template.id}/${node.id}: yes branch`
        ).toBeDefined();
        expect(
          findBranchEdge(edges, node.id, "no"),
          `${template.id}/${node.id}: no branch`
        ).toBeDefined();
      }
    }
  });

  it("starts from exactly one trigger and reaches every node", () => {
    for (const template of FLOW_TEMPLATES) {
      const triggers = template.nodes.filter((n) => n.type === "trigger");
      expect(triggers.length, `${template.id} trigger count`).toBe(1);

      const trigger = triggers[0];
      const triggerType = String(trigger.data.triggerType);
      if (triggerType === "keyword" || triggerType === "comment_keyword") {
        const keywords = trigger.data.keywords;
        expect(
          Array.isArray(keywords) && keywords.length > 0,
          `${template.id}: ${triggerType} trigger without keywords`
        ).toBe(true);
      }

      // Walk the graph; a node nothing points at is dead weight in the gallery.
      const seen = new Set<string>([trigger.id]);
      const queue = [trigger.id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const edge of template.edges) {
          if (edge.source === current && !seen.has(edge.target)) {
            seen.add(edge.target);
            queue.push(edge.target);
          }
        }
      }

      for (const node of template.nodes) {
        expect(seen.has(node.id), `${template.id}/${node.id} is unreachable`).toBe(true);
      }
    }
  });
});
