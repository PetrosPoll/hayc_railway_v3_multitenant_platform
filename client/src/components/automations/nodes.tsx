import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock, FileText, Mail } from "lucide-react";

export function TriggerNode({ data, selected }: NodeProps) {
  const formName = (data?.formName as string) || (data?.formId as string) || "Form";
  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-background px-3 py-2 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <FileText className="h-3 w-3" />
        Trigger
      </div>
      <div className="text-sm font-semibold truncate">{formName}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </div>
  );
}

export function EmailNode({ data, selected }: NodeProps) {
  const label =
    (data?.templateName as string) ||
    (data?.subject as string) ||
    "Send email";
  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-background px-3 py-2 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Mail className="h-3 w-3" />
        Email
      </div>
      <div className="text-sm font-semibold truncate">{label}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </div>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const amount = Number(data?.amount ?? data?.delayMinutes ?? 10) || 10;
  const unit = (data?.unit as string) || "minutes";
  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-background px-3 py-2 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Clock className="h-3 w-3" />
        Wait
      </div>
      <div className="text-sm font-semibold">
        {amount} {unit}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </div>
  );
}

export const automationNodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  delay: DelayNode,
};
