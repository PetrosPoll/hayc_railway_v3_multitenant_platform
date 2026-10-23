/** Athens local parts for condition rules. */
export function athensNowParts(now = new Date()): {
  day: string;
  minutes: number;
} {
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    weekday: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const day = dayFmt.format(now).toLowerCase().slice(0, 3); // mon, tue…
  const time = timeFmt.format(now); // HH:MM
  const [hh, mm] = time.split(":").map((x) => Number(x));
  return { day, minutes: hh * 60 + mm };
}

export function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export type ConditionRule = {
  kind: "form_field" | "contact_tag" | "day_of_week" | "time_of_day";
  fieldKey?: string;
  operator?:
    | "equals"
    | "not_equals"
    | "contains"
    | "is_empty"
    | "is_not_empty"
    | "has"
    | "does_not_have"
    | "is_one_of"
    | "between";
  value?: string;
  values?: string[];
  timeFrom?: string;
  timeTo?: string;
};

function fieldValue(
  fields: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: string,
): string {
  if (key in fields) return String(fields[key] ?? "");
  // Common aliases on the event payload
  const aliases: Record<string, string> = {
    name: String(payload.visitorName || payload.name || ""),
    email: String(payload.visitorEmail || payload.email || ""),
    phone: String(payload.visitorPhone || payload.phone || ""),
    message: String(payload.visitorMessage || payload.message || ""),
  };
  if (key in aliases) return aliases[key];
  return "";
}

function evalFormField(
  rule: ConditionRule,
  fields: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  const key = rule.fieldKey || "";
  const raw = fieldValue(fields, payload, key);
  const op = rule.operator || "equals";
  const expected = rule.value ?? "";
  switch (op) {
    case "equals":
      return raw === expected;
    case "not_equals":
      return raw !== expected;
    case "contains":
      return raw.toLowerCase().includes(expected.toLowerCase());
    case "is_empty":
      return !raw.trim();
    case "is_not_empty":
      return !!raw.trim();
    default:
      return false;
  }
}

function evalTag(rule: ConditionRule, tagNames: string[]): boolean {
  const tag = (rule.value || "").trim().toLowerCase();
  const has = tagNames.some((t) => t.toLowerCase() === tag);
  if (rule.operator === "does_not_have") return !has;
  return has; // has
}

function evalDay(rule: ConditionRule, now = new Date()): boolean {
  const { day } = athensNowParts(now);
  const values = (rule.values || []).map((v) => v.toLowerCase().slice(0, 3));
  return values.includes(day);
}

function evalTime(rule: ConditionRule, now = new Date()): boolean {
  const { minutes } = athensNowParts(now);
  const from = parseHhMm(rule.timeFrom || "00:00");
  const to = parseHhMm(rule.timeTo || "23:59");
  if (from == null || to == null) return false;
  if (from <= to) return minutes >= from && minutes <= to;
  // Overnight window e.g. 22:00–06:00
  return minutes >= from || minutes <= to;
}

/**
 * AND of all rules. Empty rules → true (pass to "yes").
 */
export function evaluateConditionRules(params: {
  rules: ConditionRule[];
  fields: Record<string, unknown>;
  payload: Record<string, unknown>;
  tagNames: string[];
  now?: Date;
}): boolean {
  const rules = params.rules || [];
  if (!rules.length) return true;
  return rules.every((rule) => {
    switch (rule.kind) {
      case "form_field":
        return evalFormField(rule, params.fields, params.payload);
      case "contact_tag":
        return evalTag(rule, params.tagNames);
      case "day_of_week":
        return evalDay(rule, params.now);
      case "time_of_day":
        return evalTime(rule, params.now);
      default:
        return false;
    }
  });
}

export function parseConditionRules(data: Record<string, unknown>): ConditionRule[] {
  const raw = data.rules;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is ConditionRule =>
      !!r && typeof r === "object" && typeof (r as any).kind === "string",
  );
}
