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
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  SiteFormConfig,
  WebsiteAutomationWorkflow,
  WebsiteEmailTemplate,
} from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { automationNodeTypes } from "./nodes";

type Props = {
  websiteId: number;
  websiteLanguage?: string | null;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AutomationBuilder({ websiteId, websiteLanguage }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formsOpen, setFormsOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowName, setWorkflowName] = useState("New automation");
  const [enabled, setEnabled] = useState(true);
  const [triggerFormId, setTriggerFormId] = useState("");
  const [didInitialLoad, setDidInitialLoad] = useState(false);

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

  const forms = formsData?.forms ?? [];
  const workflows = workflowsData?.workflows ?? [];
  const templates = templatesData?.templates ?? [];

  const startNewWorkflow = useCallback(() => {
    setWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName("New automation");
    setEnabled(true);
    setTriggerFormId(forms[0]?.id || "");
    setSelectedNodeId(null);
  }, [forms]);

  const loadWorkflow = useCallback((wf: WebsiteAutomationWorkflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setEnabled(wf.enabled);
    setTriggerFormId(wf.triggerFormId);
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

  const updateSelectedData = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
  };

  const addNodeFromPalette = (kind: "trigger" | "email" | "delay", form?: SiteFormConfig) => {
    const id = uid(kind);
    const baseX = 80 + nodes.length * 40;
    const baseY = 80 + (nodes.length % 4) * 80;
    if (kind === "trigger") {
      if (!form) return;
      // Only one trigger
      setNodes((nds) => {
        const without = nds.filter((n) => n.type !== "trigger");
        return [
          ...without,
          {
            id,
            type: "trigger",
            position: { x: 40, y: 160 },
            data: { formId: form.id, formName: form.name },
          },
        ];
      });
      setTriggerFormId(form.id);
      return;
    }
    if (kind === "email") {
      const firstTpl = templates[0];
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "email",
          position: { x: baseX + 200, y: baseY },
          data: {
            templateId: firstTpl?.id,
            templateName: firstTpl?.name,
            subject: firstTpl?.subject,
            body: firstTpl?.body,
          },
        },
      ]);
      return;
    }
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "delay",
        position: { x: baseX + 120, y: baseY },
        data: { amount: 10, unit: "minutes" },
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
        kind: "trigger" | "email" | "delay";
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
      const formId =
        (trigger?.data?.formId as string) || triggerFormId || forms[0]?.id;
      if (!formId) throw new Error("Add a form trigger first");

      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as "trigger" | "email" | "delay",
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

      const body = {
        name: workflowName.trim() || "Automation",
        enabled,
        triggerFormId: formId,
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

  if (workflowsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="automation-builder">
      <p className="text-sm text-muted-foreground max-w-3xl">
        {t("dashboard.automationsHelp") ||
          "A workflow is the journey (form → wait → email). A template is reusable email content you can attach to email steps."}
      </p>
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
        <div className="flex items-center gap-3">
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
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
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
        </div>
      </div>

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
              {t("dashboard.automationsForms") || "Forms"}
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
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, JSON.stringify({ kind: "email" }))}
                  onClick={() => addNodeFromPalette("email")}
                  className="cursor-grab rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Mail className="h-3.5 w-3.5" />
                    {t("dashboard.automationsSendEmail") || "Send email"}
                  </div>
                </div>
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, JSON.stringify({ kind: "delay" }))}
                  onClick={() => addNodeFromPalette("delay")}
                  className="cursor-grab rounded-md border bg-background px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {t("dashboard.automationsDelay") || "Wait / Delay"}
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
          className="rounded-lg border bg-muted/20 overflow-hidden h-[560px]"
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
        </div>

        {/* Editor */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="border-b px-3 py-2 text-sm font-medium">
            {t("dashboard.automationsEditor") || "Edit"}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                  {(selectedNode.data.formName as string) || "Form"}
                </p>
                <p className="text-muted-foreground text-xs">
                  id: {String(selectedNode.data.formId || "")}
                </p>
              </div>
            ) : selectedNode.type === "delay" ? (
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
                  {t("dashboard.automationsPlaceholdersHint", {
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
    </div>
  );
}
