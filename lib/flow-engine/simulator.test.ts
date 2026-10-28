import { afterEach, describe, expect, it, vi } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { simulateFlow } from "./simulator";

/**
 * The Test panel is the only place a flow can be checked before publishing, so
 * the simulator has to follow the same shapes the canvas stores. Every node a
 * user drags from the palette is `type: "action"` with the real action in
 * `data.actionType` — these tests pin that down.
 */

function graph(
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>,
  edges: Array<{ source: string; target: string; sourceHandle?: string }>
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n, i) => ({
      ...n,
      position: { x: 0, y: i * 100 },
    })) as unknown as Node[],
    edges: edges.map((e, i) => ({ id: `e${i}`, ...e })) as unknown as Edge[],
  };
}

const trigger = {
  id: "trigger",
  type: "trigger",
  data: { label: "Start", triggerType: "keyword", keywords: [{ value: "halo", matchType: "contains" }] },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("simulateFlow with palette action nodes", () => {
  it("branches an AB split that is stored as type action", () => {
    // Path A always wins, so the run must land on msg-a and never on msg-b.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { nodes, edges } = graph(
      [
        trigger,
        {
          id: "split",
          type: "action",
          data: {
            actionType: "abSplit",
            label: "Split",
            paths: [
              { name: "A", weight: 50 },
              { name: "B", weight: 50 },
            ],
          },
        },
        { id: "msg-a", type: "sendMessage", data: { messages: [{ text: "A" }] } },
        { id: "msg-b", type: "sendMessage", data: { messages: [{ text: "B" }] } },
      ],
      [
        { source: "trigger", target: "split" },
        { source: "split", target: "msg-a", sourceHandle: "split-0" },
        { source: "split", target: "msg-b", sourceHandle: "split-1" },
      ]
    );

    const result = simulateFlow(nodes, edges, { incomingMessage: "halo" });

    expect(result.errors).toEqual([]);
    // The trailing "end" marker reuses the last node id, so drop it.
    const visited = result.steps
      .filter((s) => s.nodeType !== "end")
      .map((s) => s.nodeId);
    expect(visited).toEqual(["trigger", "split", "msg-a"]);
  });

  it("pauses at a smart delay that is stored as type action", () => {
    const { nodes, edges } = graph(
      [
        trigger,
        {
          id: "wait",
          type: "action",
          data: { actionType: "smartDelay", label: "Wait", timeout: 30, timeoutUnit: "minutes" },
        },
        { id: "after", type: "sendMessage", data: { messages: [{ text: "later" }] } },
      ],
      [
        { source: "trigger", target: "wait" },
        { source: "wait", target: "after" },
      ]
    );

    const result = simulateFlow(nodes, edges, { incomingMessage: "halo" });

    expect(result.steps.map((s) => s.nodeId)).toEqual(["trigger", "wait"]);
    expect(result.steps[1].nodeType).toBe("smartDelay");
  });

  it("records a tag as an add, not a remove", () => {
    const { nodes, edges } = graph(
      [
        trigger,
        {
          id: "tag",
          type: "action",
          data: { actionType: "addTag", label: "Tag", tagName: "lead" },
        },
      ],
      [{ source: "trigger", target: "tag" }]
    );

    const result = simulateFlow(nodes, edges, { incomingMessage: "halo" });
    const step = result.steps.find((s) => s.nodeId === "tag");

    expect(step?.result).toMatchObject({ actionType: "addTag", detail: "Add tag: lead" });
  });

  it("still shows an action it has no semantics for", () => {
    const { nodes, edges } = graph(
      [
        trigger,
        {
          id: "custom",
          type: "action",
          data: { actionType: "someFutureAction", label: "Future" },
        },
      ],
      [{ source: "trigger", target: "custom" }]
    );

    const result = simulateFlow(nodes, edges, { incomingMessage: "halo" });
    const step = result.steps.find((s) => s.nodeId === "custom");

    expect(step?.result.type).toBe("action");
    expect(result.errors).toEqual([]);
  });
});
