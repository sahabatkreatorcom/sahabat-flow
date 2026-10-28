"use client";

import { useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ConditionPanelData {
  conditions?: Condition[];
  logic?: "and" | "or";
  [key: string]: unknown;
}

interface ConditionPanelProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const fieldOptions = [
  { value: "platform", label: "Platform" },
  { value: "is_subscribed", label: "Is Subscribed" },
  { value: "tag", label: "Tag" },
  { value: "custom_field", label: "Custom Field" },
  { value: "variable", label: "Variable" },
];

/**
 * The engine keys a condition by one string: `platform`, `is_subscribed`,
 * `tag:<name>`, `variable:<name>`, or a custom field slug. The panel edits the
 * two halves separately so the tag or variable name cannot end up in the value
 * box, which used to make the condition compare against nothing.
 */
function parseField(field: string): { kind: string; name: string } {
  if (field.startsWith("tag:")) return { kind: "tag", name: field.slice(4) };
  if (field.startsWith("variable:")) {
    return { kind: "variable", name: field.slice("variable:".length) };
  }
  if (field === "platform" || field === "is_subscribed") {
    return { kind: field, name: "" };
  }
  if (!field) return { kind: "platform", name: "" };
  // Anything else is a custom field slug.
  return { kind: "custom_field", name: field };
}

function buildField(kind: string, name: string): string {
  const trimmed = name.trim();
  if (kind === "tag") return `tag:${trimmed}`;
  if (kind === "variable") return `variable:${trimmed}`;
  if (kind === "custom_field") return trimmed;
  return kind;
}

const namePlaceholders: Record<string, string> = {
  tag: "Tag name",
  variable: "Variable name",
  custom_field: "Field slug",
};

const operatorOptions = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

export function ConditionPanel({ data: rawData, onChange }: ConditionPanelProps) {
  const data = rawData as ConditionPanelData;
  const conditions = data.conditions || [];
  const logic = data.logic || "and";

  const addCondition = useCallback(() => {
    onChange({
      ...data,
      conditions: [...conditions, { field: "platform", operator: "equals", value: "" }],
    });
  }, [data, conditions, onChange]);

  const updateCondition = useCallback(
    (index: number, updated: Condition) => {
      const updated_conditions = [...conditions];
      updated_conditions[index] = updated;
      onChange({ ...data, conditions: updated_conditions });
    },
    [data, conditions, onChange]
  );

  const removeCondition = useCallback(
    (index: number) => {
      onChange({ ...data, conditions: conditions.filter((_, i) => i !== index) });
    },
    [data, conditions, onChange]
  );

  const toggleLogic = useCallback(() => {
    onChange({ ...data, logic: logic === "and" ? "or" : "and" });
  }, [data, logic, onChange]);

  return (
    <div className="space-y-4">
      {/* Logic Toggle */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Match</span>
          <button
            type="button"
            onClick={toggleLogic}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              logic === "and"
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
            )}
          >
            {logic === "and" ? "ALL" : "ANY"}
          </button>
          <span className="text-xs text-muted-foreground">conditions</span>
        </div>
      )}

      {/* Conditions List */}
      <div className="space-y-3">
        {conditions.map((condition, index) => {
          const { kind, name } = parseField(condition.field);
          const needsName =
            kind === "tag" || kind === "variable" || kind === "custom_field";

          return (
            <div key={index}>
              {index > 0 && (
                <div className="my-2 flex items-center justify-center">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      logic === "and"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-100 text-blue-600"
                    )}
                  >
                    {logic}
                  </span>
                </div>
              )}
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Condition {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Field */}
                <div className="space-y-2">
                  <select
                    value={kind}
                    onChange={(e) =>
                      updateCondition(index, {
                        ...condition,
                        field: buildField(e.target.value, name),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {fieldOptions.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  {needsName && (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        updateCondition(index, {
                          ...condition,
                          field: buildField(kind, e.target.value),
                        })
                      }
                      placeholder={namePlaceholders[kind]}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  )}

                  {/* Operator */}
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(index, { ...condition, operator: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {operatorOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* Value (hidden for "exists" operator) */}
                  {condition.operator !== "exists" && (
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) =>
                        updateCondition(index, { ...condition, value: e.target.value })
                      }
                      placeholder="Value..."
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Condition */}
      <button
        type="button"
        onClick={addCondition}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-amber-400 hover:text-amber-500"
      >
        <Plus className="h-4 w-4" />
        Add Condition
      </button>

      {conditions.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Add conditions to create branching logic. Contacts matching the conditions go to the &ldquo;Yes&rdquo; path, others go to &ldquo;No&rdquo;.
        </p>
      )}
    </div>
  );
}
