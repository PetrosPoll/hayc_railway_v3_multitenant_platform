import { describe, expect, it } from "vitest";
import {
  evaluateConditionRules,
  parseConditionRules,
} from "./automation-conditions";
import { athensNowParts, parseHhMm } from "./automation-conditions";

describe("parseHhMm / athensNowParts", () => {
  it("parses HH:MM", () => {
    expect(parseHhMm("09:30")).toBe(9 * 60 + 30);
    expect(parseHhMm("bad")).toBeNull();
  });

  it("returns Athens day/minutes", () => {
    const parts = athensNowParts(new Date("2026-06-15T12:00:00Z"));
    expect(parts.day).toMatch(/^(mon|tue|wed|thu|fri|sat|sun)$/);
    expect(parts.minutes).toBeGreaterThanOrEqual(0);
    expect(parts.minutes).toBeLessThan(24 * 60);
  });
});

describe("evaluateConditionRules", () => {
  it("ANDs form field rules", () => {
    const ok = evaluateConditionRules({
      rules: [
        { kind: "form_field", fieldKey: "message", operator: "is_not_empty" },
        {
          kind: "form_field",
          fieldKey: "name",
          operator: "equals",
          value: "Ada",
        },
      ],
      fields: {},
      payload: { visitorName: "Ada", visitorMessage: "Hello" },
      tagNames: [],
    });
    expect(ok).toBe(true);

    const fail = evaluateConditionRules({
      rules: [
        { kind: "form_field", fieldKey: "message", operator: "is_not_empty" },
      ],
      fields: {},
      payload: { visitorMessage: "" },
      tagNames: [],
    });
    expect(fail).toBe(false);
  });

  it("checks contact tags", () => {
    expect(
      evaluateConditionRules({
        rules: [{ kind: "contact_tag", operator: "has", value: "VIP" }],
        fields: {},
        payload: {},
        tagNames: ["vip", "lead"],
      }),
    ).toBe(true);
    expect(
      evaluateConditionRules({
        rules: [
          { kind: "contact_tag", operator: "does_not_have", value: "vip" },
        ],
        fields: {},
        payload: {},
        tagNames: ["vip"],
      }),
    ).toBe(false);
  });

  it("parses rules from node data", () => {
    expect(parseConditionRules({ rules: [{ kind: "form_field" }] })).toHaveLength(
      1,
    );
    expect(parseConditionRules({})).toEqual([]);
  });
});
