import { Fragment, useCallback, useMemo, useState } from "react";
import { type Edge, type Node } from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Clock,
  Copy,
  FileText,
  Flag,
  Gift,
  GitBranch,
  Globe,
  Loader2,
  Mail,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  Plus,
  Play,
  Save,
  Search,
  Sparkles,
  Star,
  Tag,
  BadgeMinus,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  AutomationFrequency,
  AutomationNodeType,
  SiteFormConfig,
  WebsiteAutomationWorkflow,
  WebsiteEmailTemplate,
} from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormattedTextarea } from "@/components/ui/formatted-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { toGreekSafeUpperCase } from "@/lib/greek-text";

function uiUpper(text: string, language: string) {
  const hasGreek = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(text);
  const isGr =
    hasGreek ||
    language === "gr" ||
    language === "el" ||
    language.startsWith("el");
  return isGr ? toGreekSafeUpperCase(text) : text.toLocaleUpperCase("en-US");
}

type Props = {
  websiteId: number;
  websiteLanguage?: string | null;
  contactEmail?: string | null;
};

type ConditionRuleUi = {
  kind: "form_field" | "contact_tag" | "day_of_week" | "time_of_day";
  fieldKey?: string;
  operator?: string;
  value?: string;
  values?: string[];
  timeFrom?: string;
  timeTo?: string;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const VERTICAL_X = 40;
const VERTICAL_START_Y = 40;
const VERTICAL_GAP = 140;

/** Main path: trigger → … following Yes / default edges. */
function getMainChain(nodes: Node[], edges: Edge[]): Node[] {
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return [];
  const chain: Node[] = [trigger];
  let current = trigger.id;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const outs = edges.filter((e) => e.source === current);
    const next =
      outs.find((e) => !e.sourceHandle || e.sourceHandle === "yes") || outs[0];
    if (!next) break;
    const node = nodes.find((n) => n.id === next.target);
    if (!node) break;
    chain.push(node);
    current = node.id;
  }
  return chain;
}

function findChainTail(nodes: Node[], edges: Edge[]): string | null {
  const chain = getMainChain(nodes, edges);
  return chain.length ? chain[chain.length - 1].id : null;
}

function withVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  const chain = getMainChain(nodes, edges);
  const indexById = new Map(chain.map((n, i) => [n.id, i]));
  return nodes.map((n) => {
    const idx = indexById.get(n.id);
    if (idx != null) {
      return {
        ...n,
        position: { x: VERTICAL_X, y: VERTICAL_START_Y + idx * VERTICAL_GAP },
      };
    }
    const parentEdge = edges.find((e) => e.target === n.id);
    const parentIdx = parentEdge
      ? indexById.get(parentEdge.source)
      : undefined;
    return {
      ...n,
      position: {
        x: VERTICAL_X + 260,
        y:
          parentIdx != null
            ? VERTICAL_START_Y + parentIdx * VERTICAL_GAP + 70
            : n.position.y,
      },
    };
  });
}

function stepMeta(
  node: Node,
  t: (key: string, opts?: Record<string, string>) => string,
): { icon: LucideIcon; kind: string; title: string } {
  const type = node.type || "";
  switch (type) {
    case "trigger": {
      const eventType =
        (node.data?.eventType as string) ||
        (node.data?.triggerType as string) ||
        (node.data?.formId ? "form.submitted" : "");
      return {
        icon: triggerIconFor(eventType),
        kind: t("dashboard.automationsTrigger") || "Trigger",
        title:
          (node.data?.formName as string) ||
          (node.data?.eventType as string) ||
          "Trigger",
      };
    }
    case "email":
      return {
        icon: Mail,
        kind: t("dashboard.automationsSendEmail") || "Send email",
        title:
          (node.data?.templateName as string) ||
          (node.data?.subject as string) ||
          (t("dashboard.automationsSendEmail") || "Send email"),
      };
    case "delay":
      return {
        icon: Clock,
        kind: t("dashboard.automationsDelay") || "Wait",
        title: `${Number(node.data?.amount ?? 10)} ${
          (node.data?.unit as string) || "minutes"
        }`,
      };
    case "notify_owner":
      return {
        icon: Bell,
        kind: t("dashboard.automationsNotifyOwner") || "Notify me",
        title:
          (node.data?.subject as string) ||
          (t("dashboard.automationsNotifyOwner") || "Notify me"),
      };
    case "owner_reminder":
      return {
        icon: Bell,
        kind: t("dashboard.automationsOwnerReminder") || "Remind me later",
        title: `${Number(node.data?.amount ?? 2)} ${
          (node.data?.unit as string) || "hours"
        }`,
      };
    case "add_tag":
      return {
        icon: Tag,
        kind: t("dashboard.automationsAddTag") || "Add tag",
        title: (node.data?.tag as string) || "tag",
      };
    case "remove_tag":
      return {
        icon: BadgeMinus,
        kind: t("dashboard.automationsRemoveTag") || "Remove tag",
        title: (node.data?.tag as string) || "tag",
      };
    case "condition":
      return {
        icon: GitBranch,
        kind: t("dashboard.automationsIfElse") || "If / Else",
        title: Array.isArray(node.data?.rules)
          ? t("dashboard.automationsConditionRulesCount", {
              count: String(node.data.rules.length),
            }) || `${node.data.rules.length} rule(s)`
          : t("dashboard.automationsIfElse") || "If / Else",
      };
    case "webhook":
      return {
        icon: Globe,
        kind: t("dashboard.automationsWebhook") || "Webhook",
        title: (node.data?.url as string) || "HTTPS POST",
      };
    case "review_request":
      return {
        icon: Star,
        kind: t("dashboard.automationsReviewRequest") || "Google review",
        title:
          (node.data?.subject as string) ||
          (t("dashboard.automationsReviewRequest") || "Google review"),
      };
    case "send_coupon":
      return {
        icon: Gift,
        kind: t("dashboard.automationsSendCoupon") || "Send coupon",
        title:
          (node.data?.couponCode as string) ||
          (t("dashboard.automationsSendCoupon") || "Coupon"),
      };
    default:
      return {
        icon: Sparkles,
        kind: t("dashboard.automationsStep") || "Step",
        title: type || (t("dashboard.automationsStep") || "Step"),
      };
  }
}

function formatShortDate(value: string | Date | null | undefined, locale: string) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "gr" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function triggerIconFor(type: string | null | undefined): LucideIcon {
  switch (type) {
    case "form.submitted":
      return FileText;
    case "contact.created":
      return UserPlus;
    case "contact.tag_added":
      return Tag;
    case "newsletter.subscribed":
      return Mail;
    case "booking.completed":
      return CalendarCheck;
    case "booking.created":
      return CalendarPlus;
    case "booking.cancelled":
      return CalendarX;
    case "schedule.date_offset":
      return Clock;
    default:
      return Sparkles;
  }
}

type TriggerCategory = "forms" | "contacts" | "bookings" | "time";

function presetIconFor(key: string): LucideIcon {
  switch (key) {
    case "reply_and_notify":
      return MessageSquareReply;
    case "hot_lead":
      return Bell;
    case "welcome_subscriber":
    case "welcome_form_newsletter":
      return Mail;
    case "booking_created_notify":
      return CalendarPlus;
    case "booking_completed_review":
      return CalendarCheck;
    case "booking_cancelled_notify":
      return CalendarX;
    case "contact_created_welcome":
      return UserPlus;
    case "tag_added_followup":
      return Tag;
    case "date_offset_followup":
      return Clock;
    default:
      return Sparkles;
  }
}

type PresetGoalCategory =
  | "popular"
  | "forms_leads"
  | "newsletter"
  | "bookings"
  | "contacts"
  | "time";

type AutomationPresetMeta = {
  key: string;
  name: string;
  nameGr: string;
  description: string;
  descriptionGr: string;
  logic?: string;
  logicGr?: string;
  category?: PresetGoalCategory;
  popular?: boolean;
  featured?: boolean;
  triggerType?: string;
  formType?: string | null;
};

function workflowSummary(
  wf: WebsiteAutomationWorkflow,
  t: (key: string) => string,
): string {
  const nodes = wf.graph?.nodes || [];
  const kinds = new Set(
    nodes.filter((n) => n.type && n.type !== "trigger").map((n) => n.type),
  );
  const parts: string[] = [];
  if (kinds.has("email")) {
    parts.push(t("dashboard.automationsSummaryEmail") || "Email");
  }
  if (kinds.has("notify_owner") || kinds.has("owner_reminder")) {
    parts.push(t("dashboard.automationsSummaryNotify") || "Notify");
  }
  if (kinds.has("delay")) {
    parts.push(t("dashboard.automationsSummaryWait") || "Wait");
  }
  if (kinds.has("condition")) {
    parts.push(t("dashboard.automationsSummaryCondition") || "Condition");
  }
  if (kinds.has("add_tag") || kinds.has("remove_tag")) {
    parts.push(t("dashboard.automationsSummaryTags") || "Tags");
  }
  if (kinds.has("review_request")) {
    parts.push(t("dashboard.automationsSummaryReview") || "Review");
  }
  if (kinds.has("send_coupon")) {
    parts.push(t("dashboard.automationsSummaryCoupon") || "Coupon");
  }
  if (kinds.has("webhook")) {
    parts.push(t("dashboard.automationsSummaryWebhook") || "Webhook");
  }
  if (parts.length === 0) {
    return t("dashboard.automationsSummaryEmpty") || "No steps yet";
  }
  return parts.slice(0, 3).join(" · ");
}

function ConditionRulesEditor({
  rules,
  onChange,
  t,
}: {
  rules: ConditionRuleUi[];
  onChange: (rules: ConditionRuleUi[]) => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const list = rules.length
    ? rules
    : [
        {
          kind: "form_field" as const,
          fieldKey: "message",
          operator: "is_not_empty",
        },
      ];

  const updateRule = (index: number, patch: Partial<ConditionRuleUi>) => {
    const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRule = (index: number) => {
    onChange(list.filter((_, i) => i !== index));
  };

  const addRule = () => {
    onChange([
      ...list,
      { kind: "form_field", fieldKey: "message", operator: "is_not_empty" },
    ]);
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground text-xs">
        {t("dashboard.automationsConditionHint") ||
          "Green Yes / red No. All rules must pass (AND) for Yes."}
      </p>
      {list.map((rule, index) => (
        <div key={index} className="rounded-md border p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">
              {t("dashboard.automationsConditionRule") || "Rule"} {index + 1}
            </Label>
            {list.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => removeRule(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Select
            value={rule.kind}
            onValueChange={(v) =>
              updateRule(index, {
                kind: v as ConditionRuleUi["kind"],
                operator:
                  v === "form_field"
                    ? "is_not_empty"
                    : v === "contact_tag"
                      ? "has"
                      : v === "day_of_week"
                        ? "is_one_of"
                        : "between",
                fieldKey: v === "form_field" ? rule.fieldKey || "message" : undefined,
                value: v === "contact_tag" ? rule.value || "" : undefined,
                values: v === "day_of_week" ? rule.values || ["mon", "tue", "wed", "thu", "fri"] : undefined,
                timeFrom: v === "time_of_day" ? rule.timeFrom || "09:00" : undefined,
                timeTo: v === "time_of_day" ? rule.timeTo || "17:00" : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="form_field">
                {t("dashboard.automationsRuleFormField") || "Form field"}
              </SelectItem>
              <SelectItem value="contact_tag">
                {t("dashboard.automationsRuleTag") || "Contact tag"}
              </SelectItem>
              <SelectItem value="day_of_week">
                {t("dashboard.automationsRuleDay") || "Day of week"}
              </SelectItem>
              <SelectItem value="time_of_day">
                {t("dashboard.automationsRuleTime") || "Time of day"}
              </SelectItem>
            </SelectContent>
          </Select>

          {rule.kind === "form_field" && (
            <>
              <Label className="text-xs">
                {t("dashboard.automationsRuleFieldKey") || "Field"}
              </Label>
              <Select
                value={rule.fieldKey || "message"}
                onValueChange={(v) => updateRule(index, { fieldKey: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">name</SelectItem>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="phone">phone</SelectItem>
                  <SelectItem value="message">message</SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-xs">
                {t("dashboard.automationsRuleOperator") || "Operator"}
              </Label>
              <Select
                value={rule.operator || "is_not_empty"}
                onValueChange={(v) => updateRule(index, { operator: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is_not_empty">
                    {t("dashboard.automationsOpNotEmpty") || "is not empty"}
                  </SelectItem>
                  <SelectItem value="is_empty">
                    {t("dashboard.automationsOpEmpty") || "is empty"}
                  </SelectItem>
                  <SelectItem value="equals">
                    {t("dashboard.automationsOpEquals") || "equals"}
                  </SelectItem>
                  <SelectItem value="not_equals">
                    {t("dashboard.automationsOpNotEquals") || "does not equal"}
                  </SelectItem>
                  <SelectItem value="contains">
                    {t("dashboard.automationsOpContains") || "contains"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {(rule.operator === "equals" ||
                rule.operator === "not_equals" ||
                rule.operator === "contains") && (
                <>
                  <Label className="text-xs">
                    {t("dashboard.automationsRuleValue") || "Value"}
                  </Label>
                  <Input
                    value={rule.value || ""}
                    onChange={(e) => updateRule(index, { value: e.target.value })}
                  />
                </>
              )}
            </>
          )}

          {rule.kind === "contact_tag" && (
            <>
              <Label className="text-xs">
                {t("dashboard.automationsRuleOperator") || "Operator"}
              </Label>
              <Select
                value={rule.operator || "has"}
                onValueChange={(v) => updateRule(index, { operator: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="has">
                    {t("dashboard.automationsOpHasTag") || "has tag"}
                  </SelectItem>
                  <SelectItem value="does_not_have">
                    {t("dashboard.automationsOpNoTag") || "does not have tag"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-xs">
                {t("dashboard.automationsTagName") || "Tag"}
              </Label>
              <Input
                value={rule.value || ""}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                placeholder="lead"
              />
            </>
          )}

          {rule.kind === "day_of_week" && (
            <>
              <Label className="text-xs">
                {t("dashboard.automationsRuleDays") || "Days (Europe/Athens)"}
              </Label>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["mon", "Δευ"],
                    ["tue", "Τρι"],
                    ["wed", "Τετ"],
                    ["thu", "Πεμ"],
                    ["fri", "Παρ"],
                    ["sat", "Σαβ"],
                    ["sun", "Κυρ"],
                  ] as const
                ).map(([key, label]) => {
                  const selected = (rule.values || []).includes(key);
                  return (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const cur = new Set(rule.values || []);
                        if (cur.has(key)) cur.delete(key);
                        else cur.add(key);
                        updateRule(index, { values: Array.from(cur) });
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          {rule.kind === "time_of_day" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">
                  {t("dashboard.automationsRuleFrom") || "From"}
                </Label>
                <Input
                  type="time"
                  value={rule.timeFrom || "09:00"}
                  onChange={(e) => updateRule(index, { timeFrom: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t("dashboard.automationsRuleTo") || "To"}
                </Label>
                <Input
                  type="time"
                  value={rule.timeTo || "17:00"}
                  onChange={(e) => updateRule(index, { timeTo: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRule}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("dashboard.automationsAddRule") || "Add rule"}
      </Button>
    </div>
  );
}

export function AutomationBuilder({
  websiteId,
  websiteLanguage,
  contactEmail,
}: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  /** UI language for casing/copy — not website content language. */
  const uiLang = i18n.language || "en";
  const isUiGr =
    uiLang === "gr" || uiLang === "el" || uiLang.startsWith("el");

  /** Prefer locale string; if i18n returns the raw key, use language fallback. */
  const tx = (key: string, en: string, grText: string) => {
    const v = t(key);
    if (!v || v === key || v.startsWith("dashboard.")) {
      return isUiGr ? grText : en;
    }
    return v;
  };

  const [builderTab, setBuilderTab] = useState<"canvas" | "history">("canvas");
  const [editorOpen, setEditorOpen] = useState(false);
  const [createFlowOpen, setCreateFlowOpen] = useState(false);
  const [createFlowStep, setCreateFlowStep] = useState<
    "recipes" | "triggers" | "preview"
  >("recipes");
  const [recipeCategory, setRecipeCategory] =
    useState<PresetGoalCategory>("popular");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [pendingTriggerId, setPendingTriggerId] = useState<string | null>(null);
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [stepPickerView, setStepPickerView] = useState<"root" | "actions" | "trigger">(
    "root",
  );
  const [triggerCategory, setTriggerCategory] = useState<TriggerCategory>("forms");
  const [triggerSearch, setTriggerSearch] = useState("");
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [listDeleteTarget, setListDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [formConflict, setFormConflict] = useState<{
    formId: string;
    formName: string;
    existingName: string;
    onConfirm: () => void;
  } | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testVisitorEmail, setTestVisitorEmail] = useState("");
  const [testOwnerEmail, setTestOwnerEmail] = useState("");
  const [testVisitorName, setTestVisitorName] = useState("Test Contact");

  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowName, setWorkflowName] = useState("New automation");
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<AutomationFrequency>("every_time");
  const [triggerFormId, setTriggerFormId] = useState("");
  const [triggerType, setTriggerType] = useState<string>("form.submitted");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: formsData } = useQuery<{ forms: SiteFormConfig[] }>({
    queryKey: ["/api/websites", websiteId, "forms"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/forms`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load forms");
      return res.json();
    },
  });

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery<{
    workflows: WebsiteAutomationWorkflow[];
  }>({
    queryKey: ["/api/websites", websiteId, "automation-workflows"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/automation-workflows`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load workflows");
      return res.json();
    },
  });

  const { data: templatesData } = useQuery<{ templates: WebsiteEmailTemplate[] }>({
    queryKey: ["/api/websites", websiteId, "email-templates"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/email-templates`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const { data: presetsData } = useQuery<{
    presets: AutomationPresetMeta[];
  }>({
    queryKey: ["/api/websites", websiteId, "automation-presets"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/automation-presets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load presets");
      return res.json();
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{
    runs: Array<{
      id: number;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      contactEmail: string;
      isTest?: boolean;
      steps: Array<{
        id: number;
        nodeId: string;
        nodeType?: string | null;
        label?: string;
        status: string;
        error: string | null;
        attempts: number;
      }>;
    }>;
  }>({
    queryKey: ["/api/websites", websiteId, "automation-workflows", workflowId, "runs"],
    enabled: workflowId != null && builderTab === "history",
    queryFn: async () => {
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${workflowId}/runs`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const forms = formsData?.forms ?? [];
  const workflows = workflowsData?.workflows ?? [];
  const templates = templatesData?.templates ?? [];
  const presets = presetsData?.presets ?? [];

  const findEnabledFormWorkflow = useCallback(
    (formId: string, excludeId?: number | null) =>
      workflows.find(
        (w) =>
          (w.triggerType || "form.submitted") === "form.submitted" &&
          w.triggerFormId === formId &&
          w.enabled &&
          (excludeId == null || w.id !== excludeId),
      ),
    [workflows],
  );

  const withFormConflictCheck = useCallback(
    (
      formId: string,
      formName: string,
      excludeId: number | null | undefined,
      proceed: () => void,
    ) => {
      const existing = findEnabledFormWorkflow(formId, excludeId);
      if (existing) {
        setFormConflict({
          formId,
          formName,
          existingName: existing.name,
          onConfirm: () => {
            setFormConflict(null);
            proceed();
          },
        });
        return;
      }
      proceed();
    },
    [findEnabledFormWorkflow],
  );

  const startNewWorkflow = useCallback(() => {
    setWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName(
      isUiGr ? "Νέος αυτοματισμός" : "New automation",
    );
    setEnabled(true);
    setFrequency("every_time");
    setTriggerFormId(forms[0]?.id || "");
    setTriggerType("form.submitted");
    setTriggerConfig({});
    setSelectedNodeId(null);
    setBuilderTab("canvas");
  }, [forms, isUiGr]);

  const loadWorkflow = useCallback((wf: WebsiteAutomationWorkflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setEnabled(wf.enabled);
    setFrequency((wf.frequency as AutomationFrequency) || "every_time");
    setTriggerFormId(wf.triggerFormId);
    setTriggerType(wf.triggerType || "form.submitted");
    setTriggerConfig((wf.triggerConfig as Record<string, unknown>) || {});
    const g = wf.graph || { nodes: [], edges: [] };
    const mappedNodes: Node[] = (g.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data || {},
    }));
    const mappedEdges: Edge[] = (g.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }));
    setEdges(mappedEdges);
    setNodes(withVerticalLayout(mappedNodes, mappedEdges));
    setSelectedNodeId(null);
  }, []);

  const openCreateFlow = useCallback(() => {
    setCreateFlowStep("recipes");
    setRecipeCategory("popular");
    setRecipeSearch("");
    setPendingTriggerId(null);
    setTriggerCategory("forms");
    setTriggerSearch("");
    setCreateFlowOpen(true);
  }, []);

  const closeCreateFlow = useCallback(() => {
    setCreateFlowOpen(false);
    setCreateFlowStep("recipes");
    setPendingTriggerId(null);
    setTriggerSearch("");
    setRecipeSearch("");
  }, []);

  const openEditor = useCallback(
    (wf?: WebsiteAutomationWorkflow) => {
      if (!wf) {
        openCreateFlow();
        return;
      }
      loadWorkflow(wf);
      setStepPickerOpen(false);
      setStepPickerView("root");
      setEditorOpen(true);
      setBuilderTab("canvas");
    },
    [loadWorkflow, openCreateFlow],
  );

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setStepPickerOpen(false);
    setInsertAfterId(null);
    setStepPickerView("root");
    setTriggerSearch("");
    setSelectedNodeId(null);
    setBuilderTab("canvas");
  }, []);

  const closeStepPicker = useCallback(() => {
    setStepPickerOpen(false);
    setStepPickerView("root");
    setInsertAfterId(null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  /**
   * A newsletter signup carries no message and no phone — the backend passes
   * both as empty strings — so offering {{message}} and {{phone}} on one of
   * these workflows would silently render blanks in a live email.
   */
  const triggerIsNewsletter = useMemo(() => {
    const trigger = nodes.find((n) => n.type === "trigger");
    const formId = (trigger?.data?.formId as string) || triggerFormId;
    if (!formId) return false;
    return forms.find((f) => f.id === formId)?.type === "newsletter";
  }, [nodes, triggerFormId, forms]);

  const updateSelectedData = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
  };

  const replaceTriggerNode = (
    data: Record<string, unknown>,
    triggerFormIdNext: string,
    triggerTypeNext: string,
    triggerConfigNext: Record<string, unknown>,
  ) => {
    const id = uid("trigger");
    const oldTrigger = nodes.find((n) => n.type === "trigger");
    const nextEdges = oldTrigger
      ? edges
          .filter((e) => e.target !== oldTrigger.id)
          .map((e) =>
            e.source === oldTrigger.id ? { ...e, source: id } : e,
          )
      : edges;
    const nextNodes: Node[] = [
      ...nodes.filter((n) => n.type !== "trigger"),
      {
        id,
        type: "trigger",
        position: { x: VERTICAL_X, y: VERTICAL_START_Y },
        data,
      },
    ];
    setEdges(nextEdges);
    setNodes(withVerticalLayout(nextNodes, nextEdges));
    setTriggerType(triggerTypeNext);
    setTriggerFormId(triggerFormIdNext);
    setTriggerConfig(triggerConfigNext);
    setSelectedNodeId(id);
    closeStepPicker();
  };

  const addEventTrigger = (
    eventType: string,
    label: string,
    config: Record<string, unknown> = {},
  ) => {
    replaceTriggerNode(
      { eventType, formName: label, triggerType: eventType, ...config },
      eventType,
      eventType,
      config,
    );
  };

  const addFormTrigger = (form: SiteFormConfig) => {
    replaceTriggerNode(
      {
        formId: form.id,
        formName: form.name,
        eventType: "form.submitted",
      },
      form.id,
      "form.submitted",
      { formId: form.id },
    );
  };

  const addStep = (kind: Exclude<AutomationNodeType, "trigger">) => {
    const id = uid(kind);
    const defaults: Record<string, Record<string, unknown>> = {
      email: {
        templateId: templates[0]?.id,
        templateName: templates[0]?.name,
        subject: templates[0]?.subject,
        body: templates[0]?.body,
      },
      delay: { amount: 10, unit: "minutes" },
      notify_owner: {
        subject: "New message from {{name}} — {{siteLabel}}",
        body: "Name: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\n\n{{message}}",
      },
      owner_reminder: {
        amount: 2,
        unit: "hours",
        subject: "Follow up: {{name}}",
        body: "{{name}} <{{email}}>\n\n{{message}}",
      },
      add_tag: { tag: "lead" },
      remove_tag: { tag: "lead" },
      condition: {
        rules: [
          { kind: "form_field", fieldKey: "message", operator: "is_not_empty" },
        ],
      },
      webhook: { url: "https://", secret: "" },
      review_request: {
        subject: "How was your visit — {{siteLabel}}?",
        body: "Hi {{name}},\n\nWe'd love your feedback.",
      },
      send_coupon: {
        couponCode: "WELCOME10",
        couponDescription: "10% off your next visit",
        couponExpiry: "",
        subject: "A gift for you — {{siteLabel}}",
        body: "Hi {{name}},\n\nUse code {{coupon_code}}.",
      },
    };

    const afterId = insertAfterId || findChainTail(nodes, edges);
    const afterNode = afterId ? nodes.find((n) => n.id === afterId) : null;
    const sourceHandle =
      afterNode?.type === "condition" ? "yes" : undefined;

    const outgoing = afterId
      ? edges.find(
          (e) =>
            e.source === afterId &&
            (sourceHandle
              ? e.sourceHandle === sourceHandle
              : !e.sourceHandle || e.sourceHandle === "yes"),
        )
      : undefined;

    let nextEdges = edges;
    if (afterId && outgoing) {
      nextEdges = [
        ...edges.filter((e) => e.id !== outgoing.id),
        {
          id: uid("e"),
          source: afterId,
          target: id,
          sourceHandle,
        },
        {
          id: uid("e"),
          source: id,
          target: outgoing.target,
        },
      ];
    } else if (afterId) {
      nextEdges = [
        ...edges,
        {
          id: uid("e"),
          source: afterId,
          target: id,
          sourceHandle,
        },
      ];
    }

    const nextNodes: Node[] = [
      ...nodes,
      {
        id,
        type: kind,
        position: { x: VERTICAL_X, y: VERTICAL_START_Y },
        data: defaults[kind] || {},
      },
    ];
    setEdges(nextEdges);
    setNodes(withVerticalLayout(nextNodes, nextEdges));
    setSelectedNodeId(id);
    closeStepPicker();
  };

  const openStepPicker = (
    view: "root" | "actions" | "trigger" = "root",
    afterId: string | null = null,
  ) => {
    setInsertAfterId(afterId);
    setStepPickerView(view);
    if (view === "trigger") {
      setTriggerCategory("forms");
      setTriggerSearch("");
    }
    setStepPickerOpen(true);
  };

  const mainChain = useMemo(() => getMainChain(nodes, edges), [nodes, edges]);

  const filteredWorkflows = useMemo(() => {
    const q = workflowSearch.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((wf) => wf.name.toLowerCase().includes(q));
  }, [workflows, workflowSearch]);

  const triggerLabel = useCallback(
    (wf: WebsiteAutomationWorkflow) => {
      const type = wf.triggerType || "form.submitted";
      if (type === "form.submitted") {
        const form = forms.find((f) => f.id === wf.triggerFormId);
        return form?.name || t("dashboard.automationsTrigger") || "Trigger";
      }
      const map: Record<string, string> = {
        "contact.created":
          t("dashboard.automationsTriggerContactCreated") || "New contact",
        "contact.tag_added":
          t("dashboard.automationsTriggerTagAdded") || "Tag added",
        "newsletter.subscribed":
          t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed",
        "booking.completed":
          t("dashboard.automationsTriggerBookingDone") || "Appointment completed",
        "booking.created":
          t("dashboard.automationsTriggerBookingCreated") || "Booking created",
        "booking.cancelled":
          t("dashboard.automationsTriggerBookingCancelled") || "Booking cancelled",
        "schedule.date_offset":
          t("dashboard.automationsTriggerDateOffset") || "X days after a date",
      };
      return map[type] || type;
    },
    [forms, t],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trigger = nodes.find((n) => n.type === "trigger");
      const eventType =
        (trigger?.data?.eventType as string) ||
        (trigger?.data?.triggerType as string) ||
        triggerType ||
        "form.submitted";
      const formId =
        eventType === "form.submitted"
          ? (trigger?.data?.formId as string) || triggerFormId || forms[0]?.id
          : eventType;
      if (eventType === "form.submitted" && !formId) {
        throw new Error("Add a form trigger first");
      }
      if (!trigger) throw new Error("Add a trigger first");

      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as AutomationNodeType,
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        })),
      };

      const cfgFromTrigger: Record<string, unknown> = {
        ...triggerConfig,
        ...(trigger.data || {}),
      };
      if (eventType === "form.submitted") cfgFromTrigger.formId = formId;

      const body = {
        name: workflowName.trim() || "Automation",
        enabled,
        triggerFormId: formId || eventType,
        triggerType: eventType,
        triggerConfig: cfgFromTrigger,
        frequency,
        graph,
      };

      if (workflowId) {
        const res = await fetch(
          `/api/websites/${websiteId}/automation-workflows/${workflowId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save");
        }
        return res.json();
      }

      const res = await fetch(`/api/websites/${websiteId}/automation-workflows`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.workflow) loadWorkflow(data.workflow);
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({ title: t("dashboard.automationsSaved") || "Automation saved" });
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (idOverride?: number) => {
      const id = idOverride ?? workflowId;
      if (!id) return;
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      return id;
    },
    onSuccess: (deletedId) => {
      setDeleteConfirmOpen(false);
      setListDeleteTarget(null);
      if (deletedId != null && deletedId === workflowId) {
        startNewWorkflow();
        closeEditor();
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({ title: t("dashboard.automationsDeleted") || "Automation deleted" });
    },
  });

  const workflowsQueryKey = [
    "/api/websites",
    websiteId,
    "automation-workflows",
  ] as const;

  const patchWorkflowMutation = useMutation({
    mutationFn: async (wf: WebsiteAutomationWorkflow & { name?: string; enabled?: boolean }) => {
      const body = {
        name: (wf.name ?? "").trim() || "Automation",
        enabled: wf.enabled ?? false,
        triggerFormId: wf.triggerFormId,
        triggerType: wf.triggerType || "form.submitted",
        triggerConfig: (wf.triggerConfig as Record<string, unknown>) || {},
        frequency: (wf.frequency as AutomationFrequency) || "every_time",
        graph: wf.graph || { nodes: [], edges: [] },
      };
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${wf.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      return res.json() as Promise<{ workflow: WebsiteAutomationWorkflow }>;
    },
    onMutate: async (wf) => {
      await queryClient.cancelQueries({ queryKey: [...workflowsQueryKey] });
      const previous = queryClient.getQueryData<{
        workflows: WebsiteAutomationWorkflow[];
      }>([...workflowsQueryKey]);
      queryClient.setQueryData<{ workflows: WebsiteAutomationWorkflow[] }>(
        [...workflowsQueryKey],
        (old) => {
          if (!old) return old;
          return {
            workflows: old.workflows.map((w) =>
              w.id === wf.id
                ? {
                    ...w,
                    name: wf.name ?? w.name,
                    enabled: wf.enabled ?? w.enabled,
                  }
                : w,
            ),
          };
        },
      );
      return { previous };
    },
    onError: (err: Error, _wf, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...workflowsQueryKey], context.previous);
      }
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      if (data?.workflow) {
        queryClient.setQueryData<{ workflows: WebsiteAutomationWorkflow[] }>(
          [...workflowsQueryKey],
          (old) => {
            if (!old) return old;
            return {
              workflows: old.workflows.map((w) =>
                w.id === data.workflow.id ? data.workflow : w,
              ),
            };
          },
        );
        if (data.workflow.id === workflowId) {
          loadWorkflow(data.workflow);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...workflowsQueryKey] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (wf: WebsiteAutomationWorkflow) => {
      const lang = i18n.language || websiteLanguage || "en";
      const copySuffix =
        lang === "gr" || lang === "el" || lang.startsWith("el")
          ? " (αντίγραφο)"
          : " (copy)";
      const body = {
        name: `${wf.name}${copySuffix}`.slice(0, 120),
        enabled: false,
        triggerFormId: wf.triggerFormId,
        triggerType: wf.triggerType || "form.submitted",
        triggerConfig: (wf.triggerConfig as Record<string, unknown>) || {},
        frequency: (wf.frequency as AutomationFrequency) || "every_time",
        graph: wf.graph || { nodes: [], edges: [] },
        presetKey: wf.presetKey ?? null,
      };
      const res = await fetch(`/api/websites/${websiteId}/automation-workflows`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to duplicate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({
        title: t("dashboard.automationsDuplicated") || "Automation duplicated",
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openTestDialog = () => {
    const defaultUser = user?.email || "";
    const defaultOwner = (contactEmail || "").trim() || defaultUser;
    setTestVisitorEmail((prev) => prev || defaultUser);
    setTestOwnerEmail((prev) => prev || defaultOwner);
    setTestVisitorName((prev) => prev || "Test Contact");
    setTestOpen(true);
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new Error("Save the workflow first");
      const visitorEmail = testVisitorEmail.trim();
      const ownerEmail = testOwnerEmail.trim();
      if (!visitorEmail.includes("@")) {
        throw new Error(
          t("dashboard.automationsTestVisitorEmailInvalid") ||
            "Enter a valid customer email",
        );
      }
      if (!ownerEmail.includes("@")) {
        throw new Error(
          t("dashboard.automationsTestOwnerEmailInvalid") ||
            "Enter a valid owner email",
        );
      }
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${workflowId}/test`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorEmail,
            ownerEmail,
            visitorName: testVisitorName.trim() || "Test Contact",
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Test failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setTestOpen(false);
      setBuilderTab("history");
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows", workflowId, "runs"],
      });
      toast({
        title: t("dashboard.automationsTestStarted") || "Test run started — check History",
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const presetMutation = useMutation({
    mutationFn: async (presetKey: string) => {
      const presetMeta = presets.find((p) => p.key === presetKey);
      const isForm = (presetMeta?.triggerType || "form.submitted") === "form.submitted";
      let formId: string | undefined;
      let formName: string | undefined;
      if (isForm) {
        const form =
          forms.find((f) =>
            !presetMeta?.formType || presetMeta.formType === "any"
              ? true
              : f.type === presetMeta.formType,
          ) ||
          forms.find((f) => f.id === triggerFormId) ||
          forms[0];
        if (!form) throw new Error("No form available for this preset");
        formId = form.id;
        formName = form.name;
      }
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/from-preset`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey,
            formId,
            formName,
            enabled: false,
            language: isUiGr ? "gr" : "en",
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create from preset");
      }
      return res.json();
    },
    onSuccess: (data) => {
      closeCreateFlow();
      if (data?.workflow) {
        loadWorkflow(data.workflow);
        setEditorOpen(true);
        setBuilderTab("canvas");
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({
        title:
          t("dashboard.automationsPresetCreated") ||
          "Added to your automations (inactive until you enable it)",
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const activateFromPickMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      triggerFormId: string;
      triggerType: string;
      triggerConfig: Record<string, unknown>;
      nodeData: Record<string, unknown>;
    }) => {
      const id = uid("trigger");
      const body = {
        name: payload.name,
        enabled: true,
        triggerFormId: payload.triggerFormId,
        triggerType: payload.triggerType,
        triggerConfig: payload.triggerConfig,
        frequency: "every_time" as AutomationFrequency,
        graph: {
          nodes: [
            {
              id,
              type: "trigger" as AutomationNodeType,
              position: { x: VERTICAL_X, y: VERTICAL_START_Y },
              data: payload.nodeData,
            },
          ],
          edges: [],
        },
      };
      const res = await fetch(`/api/websites/${websiteId}/automation-workflows`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      closeCreateFlow();
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({
        title:
          t("dashboard.automationsPreviewActivated") || "Automation activated",
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (workflowsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /** Account/UI language (profile), not website content language. */
  const isGr = isUiGr;

  const suggestedStepItems = [
    {
      kind: "email" as const,
      icon: Mail,
      label: t("dashboard.automationsSendEmail") || "Send email",
    },
    {
      kind: "notify_owner" as const,
      icon: Bell,
      label: t("dashboard.automationsNotifyOwner") || "Notify me",
    },
    {
      kind: "delay" as const,
      icon: Clock,
      label: t("dashboard.automationsDelay") || "Wait",
    },
    {
      kind: "condition" as const,
      icon: GitBranch,
      label: t("dashboard.automationsIfElse") || "If / Else",
    },
    {
      kind: "add_tag" as const,
      icon: Tag,
      label: t("dashboard.automationsAddTag") || "Add tag",
    },
    {
      kind: "owner_reminder" as const,
      icon: Bell,
      label: t("dashboard.automationsOwnerReminder") || "Remind me later",
    },
    {
      kind: "review_request" as const,
      icon: Star,
      label: t("dashboard.automationsReviewRequest") || "Google review",
    },
    {
      kind: "send_coupon" as const,
      icon: Gift,
      label: t("dashboard.automationsSendCoupon") || "Send coupon",
    },
    {
      kind: "remove_tag" as const,
      icon: BadgeMinus,
      label: t("dashboard.automationsRemoveTag") || "Remove tag",
    },
    {
      kind: "webhook" as const,
      icon: Globe,
      label: t("dashboard.automationsWebhook") || "Webhook",
    },
  ];

  const tileClass =
    "flex flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-3 text-center text-xs font-medium shadow-sm hover:border-border hover:bg-muted/40 transition-colors min-h-[88px]";

  const dateLocale = isGr ? "gr" : "en";

  type TriggerCatalogItem = {
    id: string;
    category: TriggerCategory;
    title: string;
    description: string;
    detail: string;
    icon: LucideIcon;
    apply: () => void;
    buildGraph: () => {
      name: string;
      triggerFormId: string;
      triggerType: string;
      triggerConfig: Record<string, unknown>;
      nodeData: Record<string, unknown>;
    };
  };

  const triggerCatalog: TriggerCatalogItem[] = [
    ...forms.map((form) => ({
      id: `form:${form.id}`,
      category: "forms" as const,
      title: form.name,
      description:
        t("dashboard.automationsTriggerFormDesc") ||
        "When this form is submitted",
      detail:
        t("dashboard.automationsTriggerFormDetail") ||
        "Starts every time someone submits this form. Then you can add actions like email, notify, or tags.",
      icon: FileText,
      apply: () => addFormTrigger(form),
      buildGraph: () => ({
        name: form.name,
        triggerFormId: form.id,
        triggerType: "form.submitted",
        triggerConfig: { formId: form.id },
        nodeData: {
          formId: form.id,
          formName: form.name,
          eventType: "form.submitted",
        },
      }),
    })),
    {
      id: "contact.created",
      category: "contacts",
      title:
        t("dashboard.automationsTriggerContactCreated") || "New contact",
      description:
        t("dashboard.automationsTriggerContactCreatedDesc") ||
        "When a new contact is added to your list",
      detail:
        t("dashboard.automationsTriggerContactCreatedDetail") ||
        "Starts when a new contact is added to your list. Great for welcome messages or tags.",
      icon: UserPlus,
      apply: () =>
        addEventTrigger(
          "contact.created",
          t("dashboard.automationsTriggerContactCreated") || "New contact",
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerContactCreated") || "New contact";
        return {
          name: label,
          triggerFormId: "contact.created",
          triggerType: "contact.created",
          triggerConfig: {},
          nodeData: {
            eventType: "contact.created",
            formName: label,
            triggerType: "contact.created",
          },
        };
      },
    },
    {
      id: "contact.tag_added",
      category: "contacts",
      title: t("dashboard.automationsTriggerTagAdded") || "Tag added",
      description:
        t("dashboard.automationsTriggerTagAddedDesc") ||
        "When a tag is added to a contact",
      detail:
        t("dashboard.automationsTriggerTagAddedDetail") ||
        "Starts when a tag is added to a contact. Useful for follow-ups by segment.",
      icon: Tag,
      apply: () =>
        addEventTrigger(
          "contact.tag_added",
          t("dashboard.automationsTriggerTagAdded") || "Tag added",
          { tag: "lead" },
        ),
      buildGraph: () => {
        const label = t("dashboard.automationsTriggerTagAdded") || "Tag added";
        return {
          name: label,
          triggerFormId: "contact.tag_added",
          triggerType: "contact.tag_added",
          triggerConfig: { tag: "lead" },
          nodeData: {
            eventType: "contact.tag_added",
            formName: label,
            triggerType: "contact.tag_added",
            tag: "lead",
          },
        };
      },
    },
    {
      id: "newsletter.subscribed",
      category: "contacts",
      title:
        t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed",
      description:
        t("dashboard.automationsTriggerNewsletterDesc") ||
        "When someone subscribes to your newsletter",
      detail:
        t("dashboard.automationsTriggerNewsletterDetail") ||
        "Starts when someone subscribes to your newsletter. Ideal for welcome email and tagging.",
      icon: Mail,
      apply: () =>
        addEventTrigger(
          "newsletter.subscribed",
          t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed",
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed";
        return {
          name: label,
          triggerFormId: "newsletter.subscribed",
          triggerType: "newsletter.subscribed",
          triggerConfig: {},
          nodeData: {
            eventType: "newsletter.subscribed",
            formName: label,
            triggerType: "newsletter.subscribed",
          },
        };
      },
    },
    {
      id: "booking.completed",
      category: "bookings",
      title:
        t("dashboard.automationsTriggerBookingDone") || "Appointment completed",
      description:
        t("dashboard.automationsTriggerBookingDoneDesc") ||
        "When a booking is marked as completed",
      detail:
        t("dashboard.automationsTriggerBookingDoneDetail") ||
        "Starts when a booking is completed. Ideal for review requests or follow-up.",
      icon: CalendarCheck,
      apply: () =>
        addEventTrigger(
          "booking.completed",
          t("dashboard.automationsTriggerBookingDone") || "Appointment completed",
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerBookingDone") ||
          "Appointment completed";
        return {
          name: label,
          triggerFormId: "booking.completed",
          triggerType: "booking.completed",
          triggerConfig: {},
          nodeData: {
            eventType: "booking.completed",
            formName: label,
            triggerType: "booking.completed",
          },
        };
      },
    },
    {
      id: "booking.created",
      category: "bookings",
      title:
        t("dashboard.automationsTriggerBookingCreated") || "Booking created",
      description:
        t("dashboard.automationsTriggerBookingCreatedDesc") ||
        "When a new booking is made",
      detail:
        t("dashboard.automationsTriggerBookingCreatedDetail") ||
        "Starts when a new booking is made. Useful for confirmation or owner notify.",
      icon: CalendarPlus,
      apply: () =>
        addEventTrigger(
          "booking.created",
          t("dashboard.automationsTriggerBookingCreated") || "Booking created",
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerBookingCreated") || "Booking created";
        return {
          name: label,
          triggerFormId: "booking.created",
          triggerType: "booking.created",
          triggerConfig: {},
          nodeData: {
            eventType: "booking.created",
            formName: label,
            triggerType: "booking.created",
          },
        };
      },
    },
    {
      id: "booking.cancelled",
      category: "bookings",
      title:
        t("dashboard.automationsTriggerBookingCancelled") || "Booking cancelled",
      description:
        t("dashboard.automationsTriggerBookingCancelledDesc") ||
        "When a booking is cancelled",
      detail:
        t("dashboard.automationsTriggerBookingCancelledDetail") ||
        "Starts when a booking is cancelled. You can send an update or adjust tags.",
      icon: CalendarX,
      apply: () =>
        addEventTrigger(
          "booking.cancelled",
          t("dashboard.automationsTriggerBookingCancelled") ||
            "Booking cancelled",
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerBookingCancelled") ||
          "Booking cancelled";
        return {
          name: label,
          triggerFormId: "booking.cancelled",
          triggerType: "booking.cancelled",
          triggerConfig: {},
          nodeData: {
            eventType: "booking.cancelled",
            formName: label,
            triggerType: "booking.cancelled",
          },
        };
      },
    },
    {
      id: "schedule.date_offset",
      category: "time",
      title:
        t("dashboard.automationsTriggerDateOffset") || "X days after a date",
      description:
        t("dashboard.automationsTriggerDateOffsetDesc") ||
        "A set number of days after a contact date",
      detail:
        t("dashboard.automationsTriggerDateOffsetDetail") ||
        "Starts a set number of days after a contact date (e.g. last booking).",
      icon: Clock,
      apply: () =>
        addEventTrigger(
          "schedule.date_offset",
          t("dashboard.automationsTriggerDateOffset") || "X days after a date",
          { dateSource: "last_booking", offsetDays: 180, yearly: false },
        ),
      buildGraph: () => {
        const label =
          t("dashboard.automationsTriggerDateOffset") || "X days after a date";
        const config = {
          dateSource: "last_booking",
          offsetDays: 180,
          yearly: false,
        };
        return {
          name: label,
          triggerFormId: "schedule.date_offset",
          triggerType: "schedule.date_offset",
          triggerConfig: config,
          nodeData: {
            eventType: "schedule.date_offset",
            formName: label,
            triggerType: "schedule.date_offset",
            ...config,
          },
        };
      },
    },
  ];

  const triggerCategories: { id: TriggerCategory; label: string }[] = [
    {
      id: "forms",
      label: t("dashboard.automationsTriggersForms") || "Forms",
    },
    {
      id: "contacts",
      label: t("dashboard.automationsTriggersContacts") || "Contacts",
    },
    {
      id: "bookings",
      label: t("dashboard.automationsTriggersBooking") || "Bookings",
    },
    {
      id: "time",
      label: t("dashboard.automationsTriggersTime") || "Time",
    },
  ];

  const filteredTriggerItems = (() => {
    const q = triggerSearch.trim().toLowerCase();
    return triggerCatalog.filter((item) => {
      if (item.category !== triggerCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
      );
    });
  })();

  const pendingTrigger =
    triggerCatalog.find((item) => item.id === pendingTriggerId) || null;

  const bootstrapEditorFromPick = (pick: TriggerCatalogItem, makeEnabled: boolean) => {
    const built = pick.buildGraph();
    const id = uid("trigger");
    const nextNodes: Node[] = [
      {
        id,
        type: "trigger",
        position: { x: VERTICAL_X, y: VERTICAL_START_Y },
        data: built.nodeData,
      },
    ];
    setWorkflowId(null);
    setEdges([]);
    setNodes(nextNodes);
    setWorkflowName(built.name);
    setEnabled(makeEnabled);
    setFrequency("every_time");
    setTriggerFormId(built.triggerFormId);
    setTriggerType(built.triggerType);
    setTriggerConfig(built.triggerConfig);
    setSelectedNodeId(id);
    setBuilderTab("canvas");
    setStepPickerOpen(false);
    setStepPickerView("root");
    setInsertAfterId(null);
  };

  const recipeGoalCategories: { id: PresetGoalCategory; label: string }[] = [
    {
      id: "popular",
      label: t("dashboard.automationsRecipeCatPopular") || "Popular",
    },
    {
      id: "forms_leads",
      label: t("dashboard.automationsRecipeCatForms") || "Forms & leads",
    },
    {
      id: "newsletter",
      label: t("dashboard.automationsRecipeCatNewsletter") || "Newsletter",
    },
    {
      id: "bookings",
      label: t("dashboard.automationsRecipeCatBookings") || "Bookings",
    },
    {
      id: "contacts",
      label: t("dashboard.automationsRecipeCatContacts") || "Contacts",
    },
    {
      id: "time",
      label: t("dashboard.automationsRecipeCatTime") || "Time-based",
    },
  ];

  const filteredRecipes = (() => {
    const q = recipeSearch.trim().toLowerCase();
    return presets.filter((p) => {
      if (recipeCategory === "popular") {
        if (!(p.popular || p.featured)) return false;
      } else if (p.category !== recipeCategory) {
        return false;
      }
      if (!q) return true;
      const hay = [
        p.name,
        p.nameGr,
        p.description,
        p.descriptionGr,
        p.logic,
        p.logicGr,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  })();

  const renderRecipeGallery = () => (
    <div className="flex flex-col sm:flex-row min-h-[360px] max-h-[min(60vh,520px)] flex-1">
      <nav
        className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border/60 p-3 flex sm:flex-col gap-1 overflow-x-auto bg-muted/20"
        aria-label={t("dashboard.automationsCategories") || "Categories"}
      >
        <p className="hidden sm:block text-[11px] font-medium tracking-wide text-muted-foreground px-2 mb-2">
          {uiUpper(t("dashboard.automationsCategories") || "Categories", uiLang)}
        </p>
        {recipeGoalCategories.map((cat) => {
          const active = recipeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setRecipeCategory(cat.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "bg-sky-50 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              data-testid={`automation-recipe-cat-${cat.id}`}
            >
              {cat.label}
            </button>
          );
        })}
        <div className="hidden sm:block mt-auto pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 w-full justify-center rounded-full border-border/80 bg-background px-3 py-2 text-xs font-medium leading-snug shadow-none hover:bg-muted/40 whitespace-normal text-center"
            onClick={() => {
              setTriggerCategory("forms");
              setTriggerSearch("");
              setCreateFlowStep("triggers");
            }}
            data-testid="automation-start-from-scratch"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            <span className="text-left">
              {t("dashboard.automationsStartFromScratch") || "Start from scratch"}
            </span>
          </Button>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col p-4">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder={
              t("dashboard.automationsRecipeSearch") ||
              "Search by name, trigger, or action"
            }
            className="pl-9 h-9"
            data-testid="automation-recipe-search"
          />
        </div>

        <p className="text-sm font-semibold mb-2">
          {recipeGoalCategories.find((c) => c.id === recipeCategory)?.label}
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {filteredRecipes.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-4">
              {t("dashboard.automationsRecipeNoResults") ||
                "No recipes match your search."}
            </p>
          ) : (
            filteredRecipes.map((p) => {
              const Icon = presetIconFor(p.key);
              const needsForm =
                (p.triggerType || "form.submitted") === "form.submitted";
              const disabled =
                presetMutation.isPending || (needsForm && forms.length === 0);
              return (
                <div
                  key={p.key}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3"
                  data-testid={`automation-recipe-row-${p.key}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {isGr ? p.nameGr : p.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {isGr
                        ? p.logicGr || p.descriptionGr
                        : p.logic || p.description}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={disabled}
                    onClick={() => presetMutation.mutate(p.key)}
                    data-testid={`automation-recipe-setup-${p.key}`}
                  >
                    {presetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("dashboard.automationsRecipeSetUp") || "Set up"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="sm:hidden mt-3 pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 w-full justify-center rounded-full border-border/80 bg-background px-3 py-2 text-xs font-medium leading-snug shadow-none hover:bg-muted/40 whitespace-normal"
            onClick={() => setCreateFlowStep("triggers")}
            data-testid="automation-start-from-scratch-mobile"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {t("dashboard.automationsStartFromScratch") || "Start from scratch"}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderTriggerGalleryList = (onPick: (item: TriggerCatalogItem) => void) => (
    <div className="flex flex-col sm:flex-row min-h-[360px] max-h-[min(60vh,520px)] flex-1">
      <nav
        className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-border/60 p-3 flex sm:flex-col gap-1 overflow-x-auto bg-muted/20"
        aria-label={t("dashboard.automationsCategories") || "Categories"}
      >
        <p className="hidden sm:block text-[11px] font-medium tracking-wide text-muted-foreground px-2 mb-2">
          {uiUpper(t("dashboard.automationsCategories") || "Categories", uiLang)}
        </p>
        {triggerCategories.map((cat) => {
          const active = triggerCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTriggerCategory(cat.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "bg-sky-50 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              data-testid={`automation-trigger-cat-${cat.id}`}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0 flex flex-col p-4">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={triggerSearch}
            onChange={(e) => setTriggerSearch(e.target.value)}
            placeholder={
              t("dashboard.automationsTriggerSearch") || "Search triggers"
            }
            className="pl-9 h-9"
            data-testid="automation-trigger-search"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {triggerCategory === "forms" && forms.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-4">
              {t("dashboard.automationsEmptyDescription") ||
                "No forms in site config yet."}
            </p>
          ) : filteredTriggerItems.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-4">
              {t("dashboard.automationsTriggerNoResults") ||
                "No triggers match your search."}
            </p>
          ) : (
            filteredTriggerItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 text-left hover:border-border hover:bg-muted/30 transition-colors"
                  data-testid={`automation-trigger-item-${item.id}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderInlineStepPicker = () => (
    <div
      className={`w-full rounded-xl border border-border/70 bg-background shadow-sm ${
        stepPickerView === "trigger" ? "max-w-3xl p-0 overflow-hidden" : "max-w-lg p-3"
      }`}
      data-testid="automation-inline-step-picker"
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          stepPickerView === "trigger" ? "px-4 pt-3 pb-2 border-b border-border/60" : "mb-3"
        }`}
      >
        <div>
          <p className="text-sm font-medium">
            {stepPickerView === "trigger"
              ? t("dashboard.automationsChooseTrigger") || "Choose trigger"
              : t("dashboard.automationsAddStep") || "Add step"}
          </p>
          {stepPickerView === "trigger" ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dashboard.automationsChooseTriggerHint") ||
                "When should this automation start?"}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={closeStepPicker}
          aria-label={t("dashboard.close") || "Close"}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {stepPickerView === "trigger" ? (
        renderTriggerGalleryList((item) => {
          if (item.category === "forms") {
            withFormConflictCheck(item.buildGraph().triggerFormId, item.title, workflowId, () =>
              item.apply(),
            );
          } else {
            item.apply();
          }
        })
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {suggestedStepItems.map((item) => (
            <button
              key={item.kind}
              type="button"
              className={tileClass}
              onClick={() => addStep(item.kind)}
              data-testid={`automation-suggest-${item.kind}`}
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span className="leading-snug line-clamp-2">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="rounded-xl bg-muted/40 p-4 sm:p-5 space-y-6"
      data-testid="automation-builder"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {t("dashboard.automations") || "Automations"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t("dashboard.automationsDescription") ||
              "Choose a ready workflow or create your own step by step."}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openEditor()}
          data-testid="automation-create-button"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("dashboard.automationsNewWorkflow") || "New workflow"}
        </Button>
      </div>

      {presets.some((p) => p.featured) && (
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">
              {t("dashboard.automationsSuggested") || "Suggested for you"}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dashboard.automationsSuggestedHint") ||
                "Ready-made flows you can customize in one click."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presets
              .filter((p) => p.featured)
              .map((p) => {
                const Icon = presetIconFor(p.key);
                const needsForm =
                  (p.triggerType || "form.submitted") === "form.submitted";
                const disabled =
                  presetMutation.isPending || (needsForm && forms.length === 0);
                return (
                  <button
                    key={p.key}
                    type="button"
                    className="group rounded-xl border border-border/60 bg-background p-4 text-left shadow-sm hover:border-border hover:shadow transition-all disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => presetMutation.mutate(p.key)}
                    data-testid={`automation-suggested-${p.key}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <div className="font-medium text-sm leading-snug">
                          {isGr ? p.nameGr : p.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {isGr
                            ? p.logicGr || p.descriptionGr
                            : p.logic || p.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">
              {t("dashboard.automationsYourWorkflows") || "Your automations"}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dashboard.automationsYourWorkflowsHint") ||
                "Open one to edit steps, test, or turn it on and off."}
            </p>
          </div>
          {workflows.length > 0 ? (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={workflowSearch}
                onChange={(e) => setWorkflowSearch(e.target.value)}
                placeholder={
                  t("dashboard.automationsSearchPlaceholder") || "Search by name…"
                }
                className="h-9 pl-8"
                data-testid="automation-search"
              />
            </div>
          ) : null}
        </div>
        {workflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background px-4 py-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.automationsListEmpty") ||
                "No automations yet. Start from a suggested workflow or create one."}
            </p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background px-4 py-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.automationsSearchEmpty") ||
                "No automations match your search."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_7rem_8.5rem] gap-3 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground">
              <span>{uiUpper(t("dashboard.automationsColName") || "Name", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColTrigger") || "Trigger", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColDoes") || "What it does", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColCreated") || "Created", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColEdited") || "Last edited", uiLang)}</span>
              <span className="text-right">
                {uiUpper(
                  tx("dashboard.automationsColActions", "Actions", "Ενέργειες"),
                  uiLang,
                )}
              </span>
            </div>
            <div className="divide-y">
              {filteredWorkflows.map((wf) => {
                const Icon = triggerIconFor(wf.triggerType);
                return (
                  <div
                    key={wf.id}
                    className={`grid w-full grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_7rem_8.5rem] gap-2 md:gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer ${
                      wf.enabled
                        ? "bg-sky-50/80 hover:bg-sky-50 dark:bg-sky-950/25 dark:hover:bg-sky-950/40"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => openEditor(wf)}
                    data-testid={`automation-row-${wf.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEditor(wf);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 border border-border/50">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {wf.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate pl-12 md:pl-0">
                      <span className="md:hidden text-[11px] tracking-wide mr-1.5 text-muted-foreground/80">
                        {uiUpper(t("dashboard.automationsColTrigger") || "Trigger", uiLang)}:
                      </span>
                      {triggerLabel(wf)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate pl-12 md:pl-0">
                      <span className="md:hidden text-[11px] tracking-wide mr-1.5 text-muted-foreground/80">
                        {uiUpper(t("dashboard.automationsColDoes") || "What it does", uiLang)}:
                      </span>
                      {workflowSummary(wf, t)}
                    </div>
                    <div className="text-sm text-muted-foreground pl-12 md:pl-0">
                      <span className="md:hidden text-[11px] tracking-wide mr-1.5 text-muted-foreground/80">
                        {uiUpper(t("dashboard.automationsColCreated") || "Created", uiLang)}:
                      </span>
                      {formatShortDate(wf.createdAt, dateLocale)}
                    </div>
                    <div className="text-sm text-muted-foreground pl-12 md:pl-0">
                      <span className="md:hidden text-[11px] tracking-wide mr-1.5 text-muted-foreground/80">
                        {uiUpper(t("dashboard.automationsColEdited") || "Last edited", uiLang)}:
                      </span>
                      {formatShortDate(wf.updatedAt, dateLocale)}
                    </div>
                    <div
                      className="flex md:justify-end items-center gap-2 pl-12 md:pl-0"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={wf.enabled}
                        disabled={patchWorkflowMutation.isPending}
                        onCheckedChange={(checked) => {
                          const enableForm =
                            checked &&
                            (wf.triggerType || "form.submitted") ===
                              "form.submitted" &&
                            !!wf.triggerFormId;
                          const run = () =>
                            patchWorkflowMutation.mutate({
                              ...wf,
                              enabled: checked,
                            });
                          if (enableForm) {
                            withFormConflictCheck(
                              wf.triggerFormId,
                              triggerLabel(wf),
                              wf.id,
                              run,
                            );
                          } else {
                            run();
                          }
                        }}
                        aria-label={
                          wf.enabled
                            ? tx(
                                "dashboard.automationsSetInactive",
                                "Turn off",
                                "Απενεργοποίηση",
                              )
                            : tx(
                                "dashboard.automationsSetActive",
                                "Turn on",
                                "Ενεργοποίηση",
                              )
                        }
                        data-testid={`automation-row-enabled-${wf.id}`}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 bg-background"
                            data-testid={`automation-row-actions-${wf.id}`}
                            aria-label={tx(
                              "dashboard.automationsColActions",
                              "Actions",
                              "Ενέργειες",
                            )}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            disabled={duplicateMutation.isPending}
                            onClick={() => duplicateMutation.mutate(wf)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            {tx(
                              "dashboard.automationsDuplicate",
                              "Duplicate",
                              "Αντιγραφή",
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget({ id: wf.id, name: wf.name });
                              setRenameValue(wf.name);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            {tx(
                              "dashboard.automationsRename",
                              "Rename",
                              "Μετονομασία",
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              setListDeleteTarget({ id: wf.id, name: wf.name })
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {tx(
                              "dashboard.automationsDelete",
                              "Delete",
                              "Διαγραφή",
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={createFlowOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateFlow();
        }}
      >
        <DialogContent
          hideClose
          className="max-w-[min(960px,96vw)] w-full h-[min(88vh,720px)] flex flex-col p-0 gap-0 overflow-hidden"
          data-testid="automation-create-flow-dialog"
        >
          {createFlowStep === "recipes" ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold">
                    {t("dashboard.automationsCreateTitle") ||
                      "Create a new automation"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    {t("dashboard.automationsCreateRecipesHint") ||
                      "Choose a ready workflow by goal, or start from scratch with a trigger."}
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={closeCreateFlow}
                  aria-label={t("dashboard.close") || "Close"}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {renderRecipeGallery()}
            </>
          ) : createFlowStep === "triggers" || !pendingTrigger ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold">
                    {t("dashboard.automationsChooseTrigger") || "Choose trigger"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    {t("dashboard.automationsChooseTriggerHint") ||
                      "When should this automation start?"}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setCreateFlowStep("recipes")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("dashboard.automationsBackToRecipes") || "Recipes"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={closeCreateFlow}
                    aria-label={t("dashboard.close") || "Close"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {renderTriggerGalleryList((item) => {
                const goPreview = () => {
                  setPendingTriggerId(item.id);
                  setCreateFlowStep("preview");
                };
                if (item.category === "forms") {
                  withFormConflictCheck(
                    item.buildGraph().triggerFormId,
                    item.title,
                    null,
                    goPreview,
                  );
                } else {
                  goPreview();
                }
              })}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <DialogTitle className="text-lg font-semibold">
                  {t("dashboard.automationsPreviewTitle") || "Preview trigger"}
                </DialogTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={closeCreateFlow}
                  aria-label={t("dashboard.close") || "Close"}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="border-b md:border-b-0 md:border-r border-border/60 p-5 flex flex-col gap-4 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {triggerCategories.find((c) => c.id === pendingTrigger.category)
                        ?.label || pendingTrigger.category}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold leading-snug">
                      {pendingTrigger.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {pendingTrigger.detail}
                    </p>
                  </div>
                  <div className="mt-auto pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0 h-auto text-sm"
                      onClick={() => {
                        setCreateFlowStep("triggers");
                        setPendingTriggerId(null);
                      }}
                      data-testid="automation-preview-back"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1.5" />
                      {t("dashboard.automationsPreviewBack") ||
                        "Back to triggers"}
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 flex flex-col items-center justify-center overflow-y-auto">
                  {(() => {
                    const PreviewIcon = pendingTrigger.icon;
                    return (
                      <div className="w-full max-w-sm flex flex-col items-center gap-0">
                        <span className="mb-2 rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                          {uiUpper(
                            t("dashboard.automationsTriggerBadge") || "TRIGGER",
                            uiLang,
                          )}
                        </span>
                        <div className="w-full rounded-xl border border-border/70 bg-background shadow-sm overflow-hidden">
                          <div className="flex items-stretch">
                            <div className="w-1.5 shrink-0 bg-sky-500" />
                            <div className="flex items-center gap-3 px-4 py-3.5 min-w-0">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                <PreviewIcon className="h-5 w-5" />
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">
                                  {pendingTrigger.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {pendingTrigger.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Flag className="h-4 w-4" />
                          <span className="text-[10px] font-semibold tracking-wide">
                            {uiUpper(
                              t("dashboard.automationsTriggerEnd") || "END",
                              uiLang,
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="border-t px-5 py-3 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    bootstrapEditorFromPick(pendingTrigger, false);
                    closeCreateFlow();
                    setEditorOpen(true);
                  }}
                  data-testid="automation-preview-edit"
                >
                  {t("dashboard.automationsPreviewEdit") || "Edit"}
                </Button>
                <Button
                  type="button"
                  disabled={activateFromPickMutation.isPending}
                  onClick={() =>
                    activateFromPickMutation.mutate(pendingTrigger.buildGraph())
                  }
                  data-testid="automation-preview-activate"
                >
                  {activateFromPickMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t("dashboard.automationsPreviewActivate") || "Activate"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent
          hideClose
          className="max-w-[min(1180px,96vw)] w-full h-[min(88vh,860px)] flex flex-col p-0 gap-0 overflow-hidden"
          data-testid="automation-editor-dialog"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 h-9"
                onClick={closeEditor}
                aria-label={t("dashboard.back") || "Back"}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="max-w-xs h-9"
                data-testid="automation-workflow-name"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="wf-enabled" className="text-sm">
                  {t("dashboard.automationsEnabled") || "Enabled"}
                </Label>
                <Switch
                  id="wf-enabled"
                  checked={enabled}
                  onCheckedChange={(checked) => {
                    if (
                      checked &&
                      (triggerType || "form.submitted") === "form.submitted" &&
                      triggerFormId
                    ) {
                      withFormConflictCheck(
                        triggerFormId,
                        forms.find((f) => f.id === triggerFormId)?.name ||
                          triggerFormId,
                        workflowId,
                        () => setEnabled(true),
                      );
                    } else {
                      setEnabled(checked);
                    }
                  }}
                />
              </div>
              {workflowId != null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={openTestDialog}
                  disabled={testMutation.isPending}
                  data-testid="automation-test-button"
                >
                  <Play className="h-4 w-4 mr-1" />
                  {t("dashboard.automationsTest") || "Test"}
                </Button>
              )}
              <Button
                size="sm"
                className="h-9"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="automation-save-button"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("dashboard.automationsSave") || "Save"}
              </Button>
              {workflowId != null && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2"
                      data-testid="automation-more-button"
                      aria-label={t("dashboard.automationsMore") || "More"}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteConfirmOpen(true)}
                      data-testid="automation-delete-button"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("dashboard.automationsDelete") || "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 px-0 rounded-full"
                onClick={closeEditor}
                aria-label={t("dashboard.close") || "Close"}
                data-testid="automation-close-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs
            value={builderTab}
            onValueChange={(v) => setBuilderTab(v as "canvas" | "history")}
            className="flex-1 flex flex-col min-h-0 px-4 pb-4"
          >
            <TabsList className="mt-3 w-fit">
              <TabsTrigger value="canvas">
                {t("dashboard.automationsTabCanvas") || "Builder"}
              </TabsTrigger>
              <TabsTrigger value="history" disabled={workflowId == null}>
                {t("dashboard.automationsTabHistory") || "History"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-3 flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (historyData?.runs?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  {t("dashboard.automationsHistoryEmpty") || "No runs yet."}
                </p>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {historyData!.runs.map((run) => (
                    <details
                      key={run.id}
                      className="rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <summary className="cursor-pointer flex flex-wrap gap-2 items-center">
                        <span className="font-medium">
                          {run.contactEmail || "—"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                        {run.isTest ? (
                          <span className="text-[10px] tracking-wide rounded border px-1.5 py-0.5 text-muted-foreground">
                            {uiUpper(
                              t("dashboard.automationsHistoryTest") || "Test",
                              uiLang,
                            )}
                          </span>
                        ) : null}
                        <span className="text-xs tracking-wide">
                          {t(`dashboard.automationsRunStatus_${run.status}`) ||
                            run.status}
                        </span>
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-2">
                        {run.steps.map((s) => (
                          <li key={s.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-foreground">
                              {s.label || s.nodeId}
                            </span>
                            <span>
                              {t(`dashboard.automationsStepStatus_${s.status}`) ||
                                s.status}
                            </span>
                            {s.error ? (
                              <span className="text-destructive">— {s.error}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="canvas"
              className="mt-3 flex-1 min-h-0 data-[state=inactive]:hidden"
            >
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3 h-full min-h-[480px]">
                <div className="relative rounded-lg border bg-muted/30 overflow-y-auto min-h-[420px]">
                  {mainChain.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-6 min-h-[420px]">
                      {!stepPickerOpen || stepPickerView !== "trigger" ? (
                        <div className="max-w-sm rounded-xl border bg-background px-5 py-4 text-center shadow-sm">
                          <p className="text-sm font-medium">
                            {t("dashboard.automationsEmptyCanvasTitle") ||
                              "Build your automation"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("dashboard.automationsEmptyCanvasHint") ||
                              "First choose when this automation should start."}
                          </p>
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => openStepPicker("trigger")}
                            data-testid="automation-choose-trigger"
                          >
                            {t("dashboard.automationsChooseTrigger") ||
                              "Choose trigger"}
                          </Button>
                        </div>
                      ) : (
                        renderInlineStepPicker()
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center px-4 py-8"
                      data-testid="automation-vertical-flow"
                    >
                      {stepPickerOpen && stepPickerView === "trigger" ? (
                        <div className="w-full flex justify-center pb-6">
                          {renderInlineStepPicker()}
                        </div>
                      ) : null}
                      {mainChain.map((node, index) => {
                        const meta = stepMeta(node, t);
                        const Icon = meta.icon;
                        const selected = selectedNodeId === node.id;
                        const isLast = index === mainChain.length - 1;
                        const pickerHere =
                          stepPickerOpen &&
                          stepPickerView !== "trigger" &&
                          insertAfterId === node.id;
                        return (
                          <Fragment key={node.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedNodeId(node.id)}
                              className={`w-full max-w-sm rounded-xl border bg-background px-4 py-3 text-left shadow-sm transition-all ${
                                selected
                                  ? "border-primary ring-2 ring-primary/20"
                                  : "border-border/70 hover:border-border"
                              }`}
                              data-testid={`automation-step-${node.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 pt-0.5">
                                  <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
                                    {uiUpper(meta.kind, uiLang)}
                                  </div>
                                  <div className="text-sm font-semibold truncate mt-0.5">
                                    {meta.title}
                                  </div>
                                </div>
                              </div>
                            </button>

                            <div className="flex flex-col items-center py-1">
                              <div className="h-3 w-px bg-border" />
                              <button
                                type="button"
                                className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors ${
                                  pickerHere
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border/80 bg-background text-foreground hover:bg-muted"
                                }`}
                                onClick={() => {
                                  if (pickerHere) closeStepPicker();
                                  else openStepPicker("root", node.id);
                                }}
                                aria-label={
                                  t("dashboard.automationsAddStep") || "Add step"
                                }
                                data-testid={`automation-add-after-${node.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              {!isLast && !pickerHere ? (
                                <div className="h-3 w-px bg-border" />
                              ) : null}
                            </div>

                            {pickerHere ? (
                              <div className="w-full flex justify-center pb-4 pt-1">
                                {renderInlineStepPicker()}
                              </div>
                            ) : null}

                            {pickerHere && !isLast ? (
                              <div className="h-3 w-px bg-border mb-1" />
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-card overflow-hidden flex flex-col min-h-[280px]">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    {t("dashboard.automationsEditor") || "Edit"}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                      <Label htmlFor="wf-frequency" className="text-sm">
                        {t("dashboard.automationsFrequency") || "Frequency"}
                      </Label>
                      <Select
                        value={frequency}
                        onValueChange={(v) => setFrequency(v as AutomationFrequency)}
                      >
                        <SelectTrigger
                          id="wf-frequency"
                          className="h-9"
                          data-testid="automation-frequency"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="every_time">
                            {t("dashboard.automationsFreqEvery") || "Every time"}
                          </SelectItem>
                          <SelectItem value="once_per_contact">
                            {t("dashboard.automationsFreqOnce") || "Once per contact"}
                          </SelectItem>
                          <SelectItem value="once_per_contact_per_24h">
                            {t("dashboard.automationsFreqOnce24h") || "Once per contact / 24h"}
                          </SelectItem>
                          <SelectItem value="once_per_contact_per_90d">
                            {t("dashboard.automationsFreqOnce90d") || "Once per contact / 90 days"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {!selectedNode ? null : selectedNode.type === "trigger" ? (
                      <div className="space-y-2 text-sm">
                        <p className="font-medium">
                          {(selectedNode.data.formName as string) ||
                            (selectedNode.data.eventType as string) ||
                            "Trigger"}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => openStepPicker("trigger")}
                        >
                          {t("dashboard.automationsChangeTrigger") || "Change trigger"}
                        </Button>
                        {selectedNode.data.eventType === "contact.tag_added" && (
                          <>
                            <Label>{t("dashboard.automationsTagName") || "Tag"}</Label>
                            <Input
                              value={(selectedNode.data.tag as string) || ""}
                              onChange={(e) => {
                                updateSelectedData({ tag: e.target.value });
                                setTriggerConfig((c) => ({ ...c, tag: e.target.value }));
                              }}
                            />
                          </>
                        )}
                        {selectedNode.data.eventType === "schedule.date_offset" && (
                          <>
                            <Label>
                              {t("dashboard.automationsDateSource") || "Date source"}
                            </Label>
                            <Select
                              value={(selectedNode.data.dateSource as string) || "last_booking"}
                              onValueChange={(v) => {
                                updateSelectedData({ dateSource: v });
                                setTriggerConfig((c) => ({ ...c, dateSource: v }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="last_booking">
                                  {t("dashboard.automationsDateLastBooking") || "Last booking"}
                                </SelectItem>
                                <SelectItem value="subscribed_at">
                                  {t("dashboard.automationsDateSubscribed") || "Newsletter signup"}
                                </SelectItem>
                                <SelectItem value="dates.birthday">
                                  {t("dashboard.automationsDateBirthday") || "Birthday (custom)"}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Label>
                              {t("dashboard.automationsOffsetDays") || "Days after"}
                            </Label>
                            <Input
                              type="number"
                              value={Number(selectedNode.data.offsetDays ?? 0)}
                              onChange={(e) => {
                                const offsetDays = Number(e.target.value) || 0;
                                updateSelectedData({ offsetDays });
                                setTriggerConfig((c) => ({ ...c, offsetDays }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={selectedNode.data.yearly === true}
                                onCheckedChange={(v) => {
                                  updateSelectedData({ yearly: v });
                                  setTriggerConfig((c) => ({ ...c, yearly: v }));
                                }}
                              />
                              <Label>
                                {t("dashboard.automationsYearly") || "Every year"}
                              </Label>
                            </div>
                          </>
                        )}
                      </div>
                    ) : selectedNode.type === "webhook" ? (
                      <div className="space-y-2">
                        <Label>URL (https)</Label>
                        <Input
                          value={(selectedNode.data.url as string) || ""}
                          onChange={(e) => updateSelectedData({ url: e.target.value })}
                        />
                        <Label>
                          {t("dashboard.automationsWebhookSecret") || "Secret (optional)"}
                        </Label>
                        <Input
                          value={(selectedNode.data.secret as string) || ""}
                          onChange={(e) => updateSelectedData({ secret: e.target.value })}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/websites/${websiteId}/automation-webhook-test`,
                                {
                                  method: "POST",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    url: selectedNode.data.url,
                                    secret: selectedNode.data.secret,
                                  }),
                                },
                              );
                              const data = await res.json();
                              toast({
                                title: data.ok
                                  ? `OK (${data.status})`
                                  : `Failed (${data.status || res.status})`,
                                variant: data.ok ? "default" : "destructive",
                              });
                            } catch (e: any) {
                              toast({
                                title: e?.message || "Test failed",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          {t("dashboard.automationsWebhookTest") || "Test webhook"}
                        </Button>
                      </div>
                    ) : selectedNode.type === "review_request" ||
                      selectedNode.type === "send_coupon" ? (
                      <div className="space-y-2">
                        {selectedNode.type === "send_coupon" && (
                          <>
                            <Label>
                              {t("dashboard.automationsCouponCode") || "Coupon code"}
                            </Label>
                            <Input
                              value={(selectedNode.data.couponCode as string) || ""}
                              onChange={(e) =>
                                updateSelectedData({ couponCode: e.target.value })
                              }
                            />
                            <Label>
                              {t("dashboard.automationsCouponDesc") || "Offer description"}
                            </Label>
                            <Input
                              value={(selectedNode.data.couponDescription as string) || ""}
                              onChange={(e) =>
                                updateSelectedData({ couponDescription: e.target.value })
                              }
                            />
                            <Label>
                              {t("dashboard.automationsCouponExpiry") || "Expiry (optional)"}
                            </Label>
                            <Input
                              type="date"
                              value={(selectedNode.data.couponExpiry as string) || ""}
                              onChange={(e) =>
                                updateSelectedData({ couponExpiry: e.target.value })
                              }
                            />
                          </>
                        )}
                        {selectedNode.type === "review_request" && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {t("dashboard.automationsReviewUrlHint") ||
                              "Set Google review URL in website settings before enabling."}
                          </p>
                        )}
                        <Label>{t("dashboard.automationsSubject") || "Subject"}</Label>
                        <Input
                          value={(selectedNode.data.subject as string) || ""}
                          onChange={(e) => updateSelectedData({ subject: e.target.value })}
                        />
                        <Label>{t("dashboard.automationsBody") || "Body"}</Label>
                        <FormattedTextarea
                          value={(selectedNode.data.body as string) || ""}
                          onChange={(e) => updateSelectedData({ body: e.target.value })}
                          rows={6}
                          showPreview
                        />
                      </div>
                    ) : selectedNode.type === "delay" ||
                      selectedNode.type === "owner_reminder" ? (
                      <div className="space-y-2">
                        <Label>{t("dashboard.automationsDelayAmount") || "Wait amount"}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={Number(selectedNode.data.amount ?? 10)}
                          onChange={(e) =>
                            updateSelectedData({
                              amount: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                        <Label>{t("dashboard.automationsDelayUnit") || "Unit"}</Label>
                        <Select
                          value={(selectedNode.data.unit as string) || "minutes"}
                          onValueChange={(v) => updateSelectedData({ unit: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">
                              {t("dashboard.automationsMinutes") || "Minutes"}
                            </SelectItem>
                            <SelectItem value="hours">
                              {t("dashboard.automationsHours") || "Hours"}
                            </SelectItem>
                            <SelectItem value="days">
                              {t("dashboard.automationsDays") || "Days"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {selectedNode.type === "owner_reminder" && (
                          <>
                            <Label>{t("dashboard.automationsSubject") || "Subject"}</Label>
                            <Input
                              value={(selectedNode.data.subject as string) || ""}
                              onChange={(e) =>
                                updateSelectedData({ subject: e.target.value })
                              }
                            />
                            <Label>{t("dashboard.automationsBody") || "Body"}</Label>
                            <FormattedTextarea
                              value={(selectedNode.data.body as string) || ""}
                              onChange={(e) => updateSelectedData({ body: e.target.value })}
                              rows={6}
                              showPreview
                            />
                          </>
                        )}
                      </div>
                    ) : selectedNode.type === "add_tag" ||
                      selectedNode.type === "remove_tag" ? (
                      <div className="space-y-2">
                        <Label>{t("dashboard.automationsTagName") || "Tag"}</Label>
                        <Input
                          value={(selectedNode.data.tag as string) || ""}
                          onChange={(e) => updateSelectedData({ tag: e.target.value })}
                          placeholder="lead"
                        />
                      </div>
                    ) : selectedNode.type === "condition" ? (
                      <ConditionRulesEditor
                        rules={
                          Array.isArray(selectedNode.data.rules)
                            ? (selectedNode.data.rules as ConditionRuleUi[])
                            : []
                        }
                        onChange={(rules) => updateSelectedData({ rules })}
                        t={t}
                      />
                    ) : selectedNode.type === "notify_owner" ? (
                      <div className="space-y-2">
                        <Label>{t("dashboard.automationsSubject") || "Subject"}</Label>
                        <Input
                          value={(selectedNode.data.subject as string) || ""}
                          onChange={(e) => updateSelectedData({ subject: e.target.value })}
                        />
                        <Label>{t("dashboard.automationsBody") || "Body"}</Label>
                        <FormattedTextarea
                          value={(selectedNode.data.body as string) || ""}
                          onChange={(e) => updateSelectedData({ body: e.target.value })}
                          rows={8}
                          showPreview
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("dashboard.automationsPlaceholdersHint", {
                            name: "{{name}}",
                            email: "{{email}}",
                            phone: "{{phone}}",
                            message: "{{message}}",
                            siteLabel: "{{siteLabel}}",
                          })}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>{t("dashboard.automationsTemplates") || "Email template"}</Label>
                        <Select
                          value={
                            selectedNode.data.templateId != null
                              ? String(selectedNode.data.templateId)
                              : "inline"
                          }
                          onValueChange={(v) => {
                            if (v === "inline") {
                              updateSelectedData({
                                templateId: undefined,
                                templateName: undefined,
                              });
                              return;
                            }
                            const tpl = templates.find((x) => x.id === Number(v));
                            if (tpl) {
                              updateSelectedData({
                                templateId: tpl.id,
                                templateName: tpl.name,
                                subject: tpl.subject,
                                body: tpl.body,
                                logoUrl: tpl.logoUrl,
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inline">
                              {t("dashboard.automationsInlineEmail") || "Custom (inline)"}
                            </SelectItem>
                            {templates.map((tpl) => (
                              <SelectItem key={tpl.id} value={String(tpl.id)}>
                                {tpl.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label>{t("dashboard.automationsSubject") || "Subject"}</Label>
                        <Input
                          value={(selectedNode.data.subject as string) || ""}
                          onChange={(e) => updateSelectedData({ subject: e.target.value })}
                        />
                        <Label>{t("dashboard.automationsBody") || "Body"}</Label>
                        <FormattedTextarea
                          value={(selectedNode.data.body as string) || ""}
                          onChange={(e) => updateSelectedData({ body: e.target.value })}
                          rows={8}
                          showPreview
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {triggerIsNewsletter
                            ? t("dashboard.automationsPlaceholdersHintNewsletter", {
                                name: "{{name}}",
                                email: "{{email}}",
                                siteLabel: "{{siteLabel}}",
                              })
                            : t("dashboard.automationsPlaceholdersHint", {
                                name: "{{name}}",
                                email: "{{email}}",
                                phone: "{{phone}}",
                                message: "{{message}}",
                                siteLabel: "{{siteLabel}}",
                              })}
                        </p>
                      </div>
                    )}

                    {selectedNode && selectedNode.type !== "trigger" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const removeId = selectedNode.id;
                          const incoming = edges.filter((e) => e.target === removeId);
                          const outgoing = edges.filter((e) => e.source === removeId);
                          let nextEdges = edges.filter(
                            (e) => e.source !== removeId && e.target !== removeId,
                          );
                          for (const inn of incoming) {
                            for (const out of outgoing) {
                              if (
                                inn.sourceHandle === "no" ||
                                out.sourceHandle === "no"
                              ) {
                                continue;
                              }
                              nextEdges = [
                                ...nextEdges,
                                {
                                  id: uid("e"),
                                  source: inn.source,
                                  target: out.target,
                                  sourceHandle: inn.sourceHandle,
                                },
                              ];
                            }
                          }
                          const nextNodes = nodes.filter((n) => n.id !== removeId);
                          setEdges(nextEdges);
                          setNodes(withVerticalLayout(nextNodes, nextEdges));
                          setSelectedNodeId(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {t("dashboard.automationsRemoveNode") || "Remove node"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-md" data-testid="automation-test-dialog">
          <DialogHeader>
            <DialogTitle>
              {t("dashboard.automationsTestTitle") || "Run test"}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.automationsTestHint") ||
                "Emails go to the addresses you enter. Delays are skipped."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="test-visitor-email">
                {t("dashboard.automationsTestVisitorEmail") ||
                  "Customer email (form filler)"}
              </Label>
              <Input
                id="test-visitor-email"
                type="email"
                value={testVisitorEmail}
                onChange={(e) => setTestVisitorEmail(e.target.value)}
                placeholder="customer@example.com"
                data-testid="automation-test-visitor-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-visitor-name">
                {t("dashboard.automationsTestVisitorName") || "Customer name"}
              </Label>
              <Input
                id="test-visitor-name"
                value={testVisitorName}
                onChange={(e) => setTestVisitorName(e.target.value)}
                placeholder="Test Contact"
                data-testid="automation-test-visitor-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-owner-email">
                {t("dashboard.automationsTestOwnerEmail") || "Owner / admin email"}
              </Label>
              <Input
                id="test-owner-email"
                type="email"
                value={testOwnerEmail}
                onChange={(e) => setTestOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                data-testid="automation-test-owner-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              {t("dashboard.cancel") || "Cancel"}
            </Button>
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="automation-test-run"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {t("dashboard.automationsTestRun") || "Run test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget != null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm" data-testid="automation-rename-dialog">
          <DialogHeader>
            <DialogTitle>
              {tx("dashboard.automationsRename", "Rename", "Μετονομασία")}
            </DialogTitle>
            <DialogDescription>
              {tx(
                "dashboard.automationsRenameHint",
                "Choose a new name for this automation.",
                "Δώσε νέο όνομα σε αυτόν τον αυτοματισμό.",
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            data-testid="automation-rename-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              {t("dashboard.cancel") || "Cancel"}
            </Button>
            <Button
              disabled={
                !renameTarget ||
                !renameValue.trim() ||
                patchWorkflowMutation.isPending
              }
              onClick={() => {
                if (!renameTarget) return;
                const wf = workflows.find((w) => w.id === renameTarget.id);
                if (!wf) return;
                patchWorkflowMutation.mutate(
                  { ...wf, name: renameValue.trim() },
                  {
                    onSuccess: () => {
                      setRenameTarget(null);
                      toast({
                        title:
                          t("dashboard.automationsRenamed") ||
                          "Automation renamed",
                      });
                    },
                  },
                );
              }}
              data-testid="automation-rename-save"
            >
              {patchWorkflowMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("dashboard.automationsSave") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={formConflict != null}
        onOpenChange={(open) => {
          if (!open) setFormConflict(null);
        }}
      >
        <AlertDialogContent data-testid="automation-form-conflict-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dashboard.automationsFormConflictTitle") ||
                "This form already has an active automation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const existing = formConflict?.existingName || "";
                const form = formConflict?.formName || "";
                const raw = t("dashboard.automationsFormConflictBody", {
                  existing,
                  form,
                });
                if (!raw || raw === "dashboard.automationsFormConflictBody" || raw.includes("{{")) {
                  return isUiGr
                    ? `Το «${existing}» είναι ήδη ενεργό για τη φόρμα «${form}». Μπορείς να συνεχίσεις, αλλά εκείνος θα απενεργοποιηθεί όταν ενεργοποιηθεί ο νέος.`
                    : `“${existing}” is already active for “${form}”. You can continue, but that automation will be turned off when this one is activated.`;
                }
                return raw;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("dashboard.automationsFormConflictCancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formConflict?.onConfirm()}
              data-testid="automation-form-conflict-continue"
            >
              {t("dashboard.automationsFormConflictContinue") || "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen || listDeleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmOpen(false);
            setListDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dashboard.automationsDeleteTitle") || "Delete workflow?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.automationsDeleteConfirm", {
                name: listDeleteTarget?.name || workflowName,
              }) ||
                `Delete “${listDeleteTarget?.name || workflowName}”? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("dashboard.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(listDeleteTarget?.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("dashboard.automationsDeleteConfirmAction") || "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
