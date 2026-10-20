import { Fragment, useCallback, useMemo, useState } from "react";
import { type Edge, type Node } from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bell,
  Calendar,
  Clock,
  FileText,
  Gift,
  GitBranch,
  Globe,
  Loader2,
  Mail,
  MessageSquareReply,
  MoreHorizontal,
  Plus,
  Play,
  Save,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { toGreekSafeUpperCase } from "@/lib/greek-text";

function uiUpper(text: string, language: string) {
  const isGr = language === "gr" || language === "el" || language.startsWith("el");
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
    case "booking.created":
    case "booking.cancelled":
      return Calendar;
    case "schedule.date_offset":
      return Clock;
    default:
      return Sparkles;
  }
}

function presetIconFor(key: string): LucideIcon {
  switch (key) {
    case "reply_and_notify":
      return MessageSquareReply;
    case "hot_lead":
      return Bell;
    case "welcome_subscriber":
      return Mail;
    default:
      return Sparkles;
  }
}

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
  const uiLang = websiteLanguage || i18n.language || "en";

  const [builderTab, setBuilderTab] = useState<"canvas" | "history">("canvas");
  const [editorOpen, setEditorOpen] = useState(false);
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [stepPickerView, setStepPickerView] = useState<"root" | "actions" | "trigger">(
    "root",
  );
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
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
    presets: Array<{
      key: string;
      name: string;
      nameGr: string;
      description: string;
      descriptionGr: string;
      formType?: string;
    }>;
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

  const startNewWorkflow = useCallback(() => {
    setWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName(
      websiteLanguage === "gr" ? "Νέος αυτοματισμός" : "New automation",
    );
    setEnabled(true);
    setFrequency("every_time");
    setTriggerFormId(forms[0]?.id || "");
    setTriggerType("form.submitted");
    setTriggerConfig({});
    setSelectedNodeId(null);
    setBuilderTab("canvas");
  }, [forms, websiteLanguage]);

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

  const openEditor = useCallback(
    (wf?: WebsiteAutomationWorkflow) => {
      if (wf) loadWorkflow(wf);
      else startNewWorkflow();
      setEditorOpen(true);
      setBuilderTab("canvas");
      if (!wf) {
        setInsertAfterId(null);
        setStepPickerView("trigger");
        setStepPickerOpen(true);
      }
    },
    [loadWorkflow, startNewWorkflow],
  );

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setStepPickerOpen(false);
    setInsertAfterId(null);
    setSelectedNodeId(null);
    setBuilderTab("canvas");
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
    setStepPickerOpen(false);
    setInsertAfterId(null);
    setStepPickerView("root");
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
    setStepPickerOpen(false);
    setInsertAfterId(null);
    setStepPickerView("root");
  };

  const openStepPicker = (
    view: "root" | "actions" | "trigger" = "root",
    afterId: string | null = null,
  ) => {
    setInsertAfterId(afterId);
    setStepPickerView(view);
    setStepPickerOpen(true);
  };

  const mainChain = useMemo(() => getMainChain(nodes, edges), [nodes, edges]);

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
    mutationFn: async () => {
      if (!workflowId) return;
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${workflowId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      startNewWorkflow();
      closeEditor();
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({ title: t("dashboard.automationsDeleted") || "Automation deleted" });
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
      const form =
        forms.find((f) =>
          !presetMeta?.formType || presetMeta.formType === "any"
            ? true
            : f.type === presetMeta.formType,
        ) ||
        forms.find((f) => f.id === triggerFormId) ||
        forms[0];
      if (!form) throw new Error("No form available");
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/from-preset`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey,
            formId: form.id,
            formName: form.name,
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
      if (data?.workflow) {
        loadWorkflow(data.workflow);
        setEditorOpen(true);
        setBuilderTab("canvas");
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({
        title: t("dashboard.automationsPresetCreated") || "Workflow created from template",
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

  const isGr = websiteLanguage === "gr";

  const actionItems = [
    { kind: "email" as const, icon: Mail, label: t("dashboard.automationsSendEmail") || "Send email" },
    { kind: "notify_owner" as const, icon: Bell, label: t("dashboard.automationsNotifyOwner") || "Notify me" },
    { kind: "owner_reminder" as const, icon: Bell, label: t("dashboard.automationsOwnerReminder") || "Remind me later" },
    { kind: "add_tag" as const, icon: Tag, label: t("dashboard.automationsAddTag") || "Add tag" },
    { kind: "remove_tag" as const, icon: BadgeMinus, label: t("dashboard.automationsRemoveTag") || "Remove tag" },
    { kind: "review_request" as const, icon: Star, label: t("dashboard.automationsReviewRequest") || "Google review" },
    { kind: "send_coupon" as const, icon: Gift, label: t("dashboard.automationsSendCoupon") || "Send coupon" },
    { kind: "webhook" as const, icon: Globe, label: t("dashboard.automationsWebhook") || "Webhook" },
  ];

  const pickerButtonClass =
    "flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors";

  const dateLocale = isGr ? "gr" : "en";

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

      {presets.length > 0 && (
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
            {presets.map((p) => {
              const Icon = presetIconFor(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  className="group rounded-xl border border-border/60 bg-background p-4 text-left shadow-sm hover:border-border hover:shadow transition-all disabled:opacity-50"
                  disabled={presetMutation.isPending || forms.length === 0}
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
                        {isGr ? p.descriptionGr : p.description}
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
        <div>
          <h4 className="text-sm font-semibold">
            {t("dashboard.automationsYourWorkflows") || "Your automations"}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("dashboard.automationsYourWorkflowsHint") ||
              "Open one to edit steps, test, or turn it on and off."}
          </p>
        </div>
        {workflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background px-4 py-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.automationsListEmpty") ||
                "No automations yet. Start from a suggested workflow or create one."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_7.5rem_5.5rem] gap-3 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground">
              <span>{uiUpper(t("dashboard.automationsColName") || "Name", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColTrigger") || "Trigger", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColDoes") || "What it does", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColCreated") || "Created", uiLang)}</span>
              <span>{uiUpper(t("dashboard.automationsColEdited") || "Last edited", uiLang)}</span>
              <span className="text-right">
                {uiUpper(t("dashboard.automationsColStatus") || "Status", uiLang)}
              </span>
            </div>
            <div className="divide-y">
              {workflows.map((wf) => {
                const Icon = triggerIconFor(wf.triggerType);
                return (
                  <button
                    key={wf.id}
                    type="button"
                    className="grid w-full grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_7.5rem_5.5rem] gap-2 md:gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => openEditor(wf)}
                    data-testid={`automation-row-${wf.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-sm truncate">
                        {wf.name}
                      </span>
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
                    <div className="flex md:justify-end items-center pl-12 md:pl-0">
                      <span
                        className={
                          wf.enabled
                            ? "text-[11px] font-medium tracking-wide rounded-full border px-2.5 py-0.5 text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/40"
                            : "text-[11px] font-medium tracking-wide rounded-full border px-2.5 py-0.5 text-muted-foreground bg-muted/50"
                        }
                      >
                        {uiUpper(
                          wf.enabled
                            ? t("dashboard.automationsActive") || "Active"
                            : t("dashboard.automationsInactive") || "Off",
                          uiLang,
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

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
                <Switch id="wf-enabled" checked={enabled} onCheckedChange={setEnabled} />
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
                    <div className="flex items-center justify-center p-6 h-full min-h-[420px]">
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
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center px-4 py-8"
                      data-testid="automation-vertical-flow"
                    >
                      {mainChain.map((node, index) => {
                        const meta = stepMeta(node, t);
                        const Icon = meta.icon;
                        const selected = selectedNodeId === node.id;
                        const isLast = index === mainChain.length - 1;
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
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-sm hover:bg-muted transition-colors"
                                onClick={() => openStepPicker("root", node.id)}
                                aria-label={
                                  t("dashboard.automationsAddStep") || "Add step"
                                }
                                data-testid={`automation-add-after-${node.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              {!isLast ? (
                                <div className="h-3 w-px bg-border" />
                              ) : null}
                            </div>
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

      <Dialog
        open={stepPickerOpen}
        onOpenChange={(open) => {
          setStepPickerOpen(open);
          if (!open) {
            setStepPickerView("root");
            setInsertAfterId(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="automation-step-picker">
          <DialogHeader>
            <DialogTitle>
              {stepPickerView === "trigger"
                ? t("dashboard.automationsChooseTrigger") || "Choose trigger"
                : stepPickerView === "actions"
                  ? t("dashboard.automationsActions") || "Actions"
                  : t("dashboard.automationsAddStep") || "Add step"}
            </DialogTitle>
            <DialogDescription>
              {stepPickerView === "trigger"
                ? t("dashboard.automationsChooseTriggerHint") ||
                  "When should this automation start?"
                : t("dashboard.automationsAddStepHint") ||
                  "Pick what happens next. It will connect automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto py-1">
            {stepPickerView === "root" && (
              <>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() => setStepPickerView("actions")}
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-medium">
                      {t("dashboard.automationsAction") || "Action"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("dashboard.automationsActionHint") ||
                        "Email, notify, tags, coupon, webhook…"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() => addStep("delay")}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-medium">
                      {t("dashboard.automationsDelay") || "Wait / Delay"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("dashboard.automationsDelayHint") || "Pause before the next step"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() => addStep("condition")}
                >
                  <GitBranch className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-medium">
                      {t("dashboard.automationsIfElse") || "If / Else"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("dashboard.automationsConditionPickerHint") ||
                        "Branch based on rules"}
                    </span>
                  </span>
                </button>
              </>
            )}

            {stepPickerView === "actions" && (
              <>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground mb-1"
                  onClick={() => setStepPickerView("root")}
                >
                  ← {t("dashboard.back") || "Back"}
                </button>
                {actionItems.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className={pickerButtonClass}
                    onClick={() => addStep(item.kind)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </>
            )}

            {stepPickerView === "trigger" && (
              <>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground pt-1">
                  {uiUpper(t("dashboard.automationsTriggersForms") || "Forms", uiLang)}
                </p>
                {forms.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">
                    {t("dashboard.automationsEmptyDescription") ||
                      "No forms in site config yet."}
                  </p>
                ) : (
                  forms.map((form) => (
                    <button
                      key={form.id}
                      type="button"
                      className={pickerButtonClass}
                      onClick={() => addFormTrigger(form)}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      {form.name}
                    </button>
                  ))
                )}

                <p className="text-xs font-semibold tracking-wide text-muted-foreground pt-3">
                  {uiUpper(
                    t("dashboard.automationsTriggersContacts") || "Contacts",
                    uiLang,
                  )}
                </p>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() =>
                    addEventTrigger(
                      "contact.created",
                      t("dashboard.automationsTriggerContactCreated") || "New contact",
                    )
                  }
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  {t("dashboard.automationsTriggerContactCreated") || "New contact"}
                </button>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() =>
                    addEventTrigger(
                      "contact.tag_added",
                      t("dashboard.automationsTriggerTagAdded") || "Tag added",
                      { tag: "lead" },
                    )
                  }
                >
                  <Tag className="h-4 w-4 shrink-0" />
                  {t("dashboard.automationsTriggerTagAdded") || "Tag added"}
                </button>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() =>
                    addEventTrigger(
                      "newsletter.subscribed",
                      t("dashboard.automationsTriggerNewsletter") ||
                        "Newsletter subscribed",
                    )
                  }
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed"}
                </button>

                <p className="text-xs font-semibold tracking-wide text-muted-foreground pt-3">
                  {uiUpper(
                    t("dashboard.automationsTriggersBooking") || "Bookings",
                    uiLang,
                  )}
                </p>
                {(
                  [
                    [
                      "booking.completed",
                      t("dashboard.automationsTriggerBookingDone") ||
                        "Appointment completed",
                    ],
                    [
                      "booking.created",
                      t("dashboard.automationsTriggerBookingCreated") || "Booking created",
                    ],
                    [
                      "booking.cancelled",
                      t("dashboard.automationsTriggerBookingCancelled") ||
                        "Booking cancelled",
                    ],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={pickerButtonClass}
                    onClick={() => addEventTrigger(type, label)}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}

                <p className="text-xs font-semibold tracking-wide text-muted-foreground pt-3">
                  {uiUpper(t("dashboard.automationsTriggersTime") || "Time", uiLang)}
                </p>
                <button
                  type="button"
                  className={pickerButtonClass}
                  onClick={() =>
                    addEventTrigger(
                      "schedule.date_offset",
                      t("dashboard.automationsTriggerDateOffset") ||
                        "X days after a date",
                      { dateSource: "last_booking", offsetDays: 180, yearly: false },
                    )
                  }
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {t("dashboard.automationsTriggerDateOffset") || "X days after a date"}
                </button>
              </>
            )}
          </div>
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dashboard.automationsDeleteTitle") || "Delete workflow?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.automationsDeleteConfirm", { name: workflowName }) ||
                `Delete “${workflowName}”? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("dashboard.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
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
