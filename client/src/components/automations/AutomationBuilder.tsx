import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Gift,
  GitBranch,
  Globe,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Play,
  Save,
  Star,
  Tag,
  BadgeMinus,
  Trash2,
  UserPlus,
  Zap,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { automationNodeTypes } from "./nodes";

type Props = {
  websiteId: number;
  websiteLanguage?: string | null;
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

export function AutomationBuilder({ websiteId, websiteLanguage }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formsOpen, setFormsOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState<"canvas" | "history">("canvas");
  const [presetOpen, setPresetOpen] = useState(false);

  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowName, setWorkflowName] = useState("New automation");
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<AutomationFrequency>("every_time");
  const [triggerFormId, setTriggerFormId] = useState("");
  const [triggerType, setTriggerType] = useState<string>("form.submitted");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(true);
  const [timeOpen, setTimeOpen] = useState(true);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [editingTplId, setEditingTplId] = useState<number | null>(null);

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
      formType: string;
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
    setWorkflowName("New automation");
    setEnabled(true);
    setFrequency("every_time");
    setTriggerFormId(forms[0]?.id || "");
    setTriggerType("form.submitted");
    setTriggerConfig({});
    setSelectedNodeId(null);
    setBuilderTab("canvas");
  }, [forms]);

  const loadWorkflow = useCallback((wf: WebsiteAutomationWorkflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setEnabled(wf.enabled);
    setFrequency((wf.frequency as AutomationFrequency) || "every_time");
    setTriggerFormId(wf.triggerFormId);
    setTriggerType(wf.triggerType || "form.submitted");
    setTriggerConfig((wf.triggerConfig as Record<string, unknown>) || {});
    const g = wf.graph || { nodes: [], edges: [] };
    setNodes(
      (g.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data || {},
      })),
    );
    setEdges(
      (g.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })),
    );
    setSelectedNodeId(null);
  }, []);

  // Load first saved workflow only once on mount — do not re-run when user chooses "New".
  useEffect(() => {
    if (didInitialLoad || workflowsLoading) return;
    setDidInitialLoad(true);
    if (workflows.length > 0) {
      loadWorkflow(workflows[0]);
    } else if (forms.length > 0) {
      setTriggerFormId(forms[0].id);
    }
  }, [didInitialLoad, workflowsLoading, workflows, forms, loadWorkflow]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, id: uid("e") }, eds));
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

  const addEventTrigger = (eventType: string, label: string, config: Record<string, unknown> = {}) => {
    const id = uid("trigger");
    setNodes((nds) => {
      const without = nds.filter((n) => n.type !== "trigger");
      return [
        ...without,
        {
          id,
          type: "trigger",
          position: { x: 40, y: 160 },
          data: { eventType, formName: label, triggerType: eventType, ...config },
        },
      ];
    });
    setTriggerType(eventType);
    setTriggerFormId(eventType);
    setTriggerConfig(config);
  };

  const addNodeFromPalette = (
    kind: AutomationNodeType,
    form?: SiteFormConfig,
  ) => {
    const id = uid(kind);
    const baseX = 80 + nodes.length * 40;
    const baseY = 80 + (nodes.length % 4) * 80;
    if (kind === "trigger") {
      if (!form) return;
      setNodes((nds) => {
        const without = nds.filter((n) => n.type !== "trigger");
        return [
          ...without,
          {
            id,
            type: "trigger",
            position: { x: 40, y: 160 },
            data: {
              formId: form.id,
              formName: form.name,
              eventType: "form.submitted",
            },
          },
        ];
      });
      setTriggerFormId(form.id);
      setTriggerType("form.submitted");
      setTriggerConfig({ formId: form.id });
      return;
    }
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
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: kind,
        position: { x: baseX + 160, y: baseY },
        data: defaults[kind] || {},
      },
    ]);
  };

  const onDragStart = (e: React.DragEvent, payload: string) => {
    e.dataTransfer.setData("application/automation-node", payload);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/automation-node");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        kind: AutomationNodeType;
        form?: SiteFormConfig;
      };
      addNodeFromPalette(parsed.kind, parsed.form);
    } catch {
      /* ignore */
    }
  };

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
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "automation-workflows"],
      });
      toast({ title: t("dashboard.automationsDeleted") || "Automation deleted" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: tplName.trim() || "Email template",
        subject: tplSubject.trim(),
        body: tplBody.trim(),
      };
      if (!body.subject || !body.body) throw new Error("Subject and body required");
      if (editingTplId) {
        const res = await fetch(
          `/api/websites/${websiteId}/email-templates/${editingTplId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) throw new Error("Failed to update template");
        return res.json();
      }
      const res = await fetch(`/api/websites/${websiteId}/email-templates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "email-templates"],
      });
      setTplName("");
      setTplSubject("");
      setTplBody("");
      setEditingTplId(null);
      toast({ title: t("dashboard.automationsTemplateSaved") || "Template saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new Error("Save the workflow first");
      const res = await fetch(
        `/api/websites/${websiteId}/automation-workflows/${workflowId}/test`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Test failed");
      }
      return res.json();
    },
    onSuccess: () => {
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
      const form =
        forms.find((f) => f.id === triggerFormId) || forms[0];
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
      setPresetOpen(false);
      if (data?.workflow) loadWorkflow(data.workflow);
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

  return (
    <div className="space-y-3" data-testid="automation-builder">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-5 w-5 shrink-0" />
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="max-w-xs h-9"
            data-testid="automation-workflow-name"
          />
          <Select
            value={workflowId != null ? String(workflowId) : "new"}
            onValueChange={(v) => {
              if (v === "new") {
                startNewWorkflow();
                return;
              }
              const wf = workflows.find((w) => w.id === Number(v));
              if (wf) loadWorkflow(wf);
            }}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                {t("dashboard.automationsNewWorkflow") || "New workflow"}
              </SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="automation-test-button"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              {t("dashboard.automationsTest") || "Test"}
            </Button>
          )}
          <Button
            size="sm"
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
                  className="px-2"
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
        </div>
      </div>

      <Tabs
        value={builderTab}
        onValueChange={(v) => setBuilderTab(v as "canvas" | "history")}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="canvas">
            {t("dashboard.automationsTabCanvas") || "Builder"}
          </TabsTrigger>
          <TabsTrigger value="history" disabled={workflowId == null}>
            {t("dashboard.automationsTabHistory") || "History"}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-3">
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (historyData?.runs?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              {t("dashboard.automationsHistoryEmpty") || "No runs yet."}
            </p>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
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
                      <span className="text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 text-muted-foreground">
                        {t("dashboard.automationsHistoryTest") || "Test"}
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
        <TabsContent value="canvas" className="mt-3">

      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_280px] gap-3 min-h-[560px]">
        {/* Palette */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="border-b px-3 py-2 text-sm font-medium">
            {t("dashboard.automationsPalette") || "Palette"}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"
              onClick={() => setFormsOpen((v) => !v)}
            >
              {formsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsTriggersForms") || "Forms"}
            </button>
            {formsOpen && (
              <div className="space-y-1 pl-1">
                {forms.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    {t("dashboard.automationsEmptyDescription") || "No forms in site config yet."}
                  </p>
                ) : (
                  forms.map((form) => (
                    <div
                      key={form.id}
                      draggable
                      onDragStart={(e) =>
                        onDragStart(e, JSON.stringify({ kind: "trigger", form }))
                      }
                      onClick={() => addNodeFromPalette("trigger", form)}
                      className="cursor-grab rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {form.name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setActionsOpen((v) => !v)}
            >
              {actionsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsActions") || "Actions"}
            </button>
            {actionsOpen && (
              <div className="space-y-1 pl-1">
                {(
                  [
                    { kind: "email" as const, icon: Mail, label: t("dashboard.automationsSendEmail") || "Send email" },
                    { kind: "delay" as const, icon: Clock, label: t("dashboard.automationsDelay") || "Wait / Delay" },
                    { kind: "notify_owner" as const, icon: Bell, label: t("dashboard.automationsNotifyOwner") || "Notify me" },
                    { kind: "owner_reminder" as const, icon: Bell, label: t("dashboard.automationsOwnerReminder") || "Remind me later" },
                    { kind: "add_tag" as const, icon: Tag, label: t("dashboard.automationsAddTag") || "Add tag" },
                    { kind: "remove_tag" as const, icon: BadgeMinus, label: t("dashboard.automationsRemoveTag") || "Remove tag" },
                    { kind: "review_request" as const, icon: Star, label: t("dashboard.automationsReviewRequest") || "Google review" },
                    { kind: "send_coupon" as const, icon: Gift, label: t("dashboard.automationsSendCoupon") || "Send coupon" },
                    { kind: "webhook" as const, icon: Globe, label: t("dashboard.automationsWebhook") || "Webhook" },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.kind}
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, JSON.stringify({ kind: item.kind }))
                    }
                    onClick={() => addNodeFromPalette(item.kind)}
                    className="cursor-grab rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setContactsOpen((v) => !v)}
            >
              {contactsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsTriggersContacts") || "Contacts"}
            </button>
            {contactsOpen && (
              <div className="space-y-1 pl-1">
                <div
                  className="cursor-pointer rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() =>
                    addEventTrigger(
                      "contact.created",
                      t("dashboard.automationsTriggerContactCreated") || "New contact",
                    )
                  }
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("dashboard.automationsTriggerContactCreated") || "New contact"}
                  </div>
                </div>
                <div
                  className="cursor-pointer rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() =>
                    addEventTrigger(
                      "contact.tag_added",
                      t("dashboard.automationsTriggerTagAdded") || "Tag added",
                      { tag: "lead" },
                    )
                  }
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Tag className="h-3.5 w-3.5" />
                    {t("dashboard.automationsTriggerTagAdded") || "Tag added"}
                  </div>
                </div>
                <div
                  className="cursor-pointer rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() =>
                    addEventTrigger(
                      "newsletter.subscribed",
                      t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed",
                    )
                  }
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Mail className="h-3.5 w-3.5" />
                    {t("dashboard.automationsTriggerNewsletter") || "Newsletter subscribed"}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setBookingOpen((v) => !v)}
            >
              {bookingOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsTriggersBooking") || "Bookings"}
            </button>
            {bookingOpen && (
              <div className="space-y-1 pl-1">
                {(
                  [
                    ["booking.completed", t("dashboard.automationsTriggerBookingDone") || "Appointment completed"],
                    ["booking.created", t("dashboard.automationsTriggerBookingCreated") || "Booking created"],
                    ["booking.cancelled", t("dashboard.automationsTriggerBookingCancelled") || "Booking cancelled"],
                  ] as const
                ).map(([type, label]) => (
                  <div
                    key={type}
                    className="cursor-pointer rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                    onClick={() => addEventTrigger(type, label)}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setTimeOpen((v) => !v)}
            >
              {timeOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsTriggersTime") || "Time"}
            </button>
            {timeOpen && (
              <div className="space-y-1 pl-1">
                <div
                  className="cursor-pointer rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() =>
                    addEventTrigger(
                      "schedule.date_offset",
                      t("dashboard.automationsTriggerDateOffset") || "X days after a date",
                      { dateSource: "last_booking", offsetDays: 180, yearly: false },
                    )
                  }
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {t("dashboard.automationsTriggerDateOffset") || "X days after a date"}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setConditionsOpen((v) => !v)}
            >
              {conditionsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsConditions") || "Conditions"}
            </button>
            {conditionsOpen && (
              <div className="space-y-1 pl-1">
                <div
                  draggable
                  onDragStart={(e) =>
                    onDragStart(e, JSON.stringify({ kind: "condition" }))
                  }
                  onClick={() => addNodeFromPalette("condition")}
                  className="cursor-grab rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <GitBranch className="h-3.5 w-3.5" />
                    {t("dashboard.automationsIfElse") || "If / Else"}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground pt-2"
              onClick={() => setTemplatesOpen((v) => !v)}
            >
              {templatesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("dashboard.automationsTemplates") || "Email templates"}
            </button>
            {templatesOpen && (
              <div className="space-y-2 pl-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="w-full text-left rounded-md border px-2 py-1.5 text-xs hover:bg-muted"
                    onClick={() => {
                      setEditingTplId(tpl.id);
                      setTplName(tpl.name);
                      setTplSubject(tpl.subject);
                      setTplBody(tpl.body);
                    }}
                  >
                    {tpl.name}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingTplId(null);
                    setTplName("");
                    setTplSubject(
                      websiteLanguage === "gr"
                        ? "Λάβαμε το μήνυμά σας — {{siteLabel}}"
                        : "We received your message — {{siteLabel}}",
                    );
                    setTplBody(
                      websiteLanguage === "gr"
                        ? "Γεια σου {{name}},\n\nΕυχαριστούμε!"
                        : "Hi {{name}},\n\nThank you!",
                    );
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("dashboard.automationsNewTemplate") || "New template"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative rounded-lg border bg-muted/20 overflow-hidden h-[560px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={automationNodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-lg border bg-card/95 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
                <p className="text-sm font-medium">
                  {t("dashboard.automationsEmptyCanvasTitle") ||
                    "Build your automation"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("dashboard.automationsEmptyCanvasHint") ||
                    "Drag a trigger from the palette, or start from a ready template."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setPresetOpen(true)}
                  disabled={forms.length === 0 || presets.length === 0}
                  data-testid="automation-preset-button"
                >
                  {t("dashboard.automationsStartPreset") || "Ready template"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="border-b px-3 py-2 text-sm font-medium">
            {t("dashboard.automationsEditor") || "Edit"}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                {t("dashboard.automationsWorkflowSettings") || "Workflow settings"}
              </Label>
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

            {(editingTplId != null || tplSubject || tplBody || tplName) && templatesOpen ? (
              <div className="space-y-2">
                <Label>{t("dashboard.automationsTemplateName") || "Template name"}</Label>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
                <Label>{t("dashboard.automationsSubject") || "Subject"}</Label>
                <Input value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} />
                <Label>{t("dashboard.automationsBody") || "Body"}</Label>
                <FormattedTextarea
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  rows={8}
                  showPreview
                />
                <Button
                  size="sm"
                  onClick={() => saveTemplateMutation.mutate()}
                  disabled={saveTemplateMutation.isPending}
                >
                  {t("dashboard.automationsSaveTemplate") || "Save template"}
                </Button>
              </div>
            ) : !selectedNode ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.automationsSelectNode") ||
                  "Drag items from the palette onto the canvas, connect them, then click a node to edit."}
              </p>
            ) : selectedNode.type === "trigger" ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {(selectedNode.data.formName as string) ||
                    (selectedNode.data.eventType as string) ||
                    "Trigger"}
                </p>
                {selectedNode.data.formId ? (
                  <p className="text-muted-foreground text-xs">
                    form id: {String(selectedNode.data.formId)}
                  </p>
                ) : null}
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
                    updateSelectedData({ amount: Math.max(1, Number(e.target.value) || 1) })
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
                      onChange={(e) => updateSelectedData({ subject: e.target.value })}
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

            {selectedNode && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) =>
                    eds.filter(
                      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id,
                    ),
                  );
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

      <AlertDialog open={presetOpen} onOpenChange={setPresetOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dashboard.automationsStartPreset") || "Ready template"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.automationsPresetHint") ||
                "Creates an editable copy for the selected form."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted"
                disabled={presetMutation.isPending || forms.length === 0}
                onClick={() => presetMutation.mutate(p.key)}
              >
                <div className="font-medium text-sm">
                  {websiteLanguage === "gr" ? p.nameGr : p.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {websiteLanguage === "gr" ? p.descriptionGr : p.description}
                </div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.cancel") || "Cancel"}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
