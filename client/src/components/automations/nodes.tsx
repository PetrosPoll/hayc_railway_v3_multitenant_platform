import type { ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Bell,
  Clock,
  FileText,
  Gift,
  GitBranch,
  Globe,
  Mail,
  Star,
  Tag,
  BadgeMinus,
} from "lucide-react";

function NodeShell({
  selected,
  children,
  minWidth = 160,
}: {
  selected?: boolean;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div
      className={`rounded-lg border bg-background px-3 py-2 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
      style={{ minWidth }}
    >
      {children}
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps) {
  const formName = (data?.formName as string) || (data?.formId as string) || "Form";
  return (
    <NodeShell selected={selected}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <FileText className="h-3 w-3" />
        Trigger
      </div>
      <div className="text-sm font-semibold truncate">{formName}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function EmailNode({ data, selected }: NodeProps) {
  const label =
    (data?.templateName as string) ||
    (data?.subject as string) ||
    "Send email";
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Mail className="h-3 w-3" />
        Email
      </div>
      <div className="text-sm font-semibold truncate">{label}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const amount = Number(data?.amount ?? data?.delayMinutes ?? 10) || 10;
  const unit = (data?.unit as string) || "minutes";
  return (
    <NodeShell selected={selected} minWidth={140}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Clock className="h-3 w-3" />
        Wait
      </div>
      <div className="text-sm font-semibold">
        {amount} {unit}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function NotifyOwnerNode({ data, selected }: NodeProps) {
  const label = (data?.subject as string) || "Notify me";
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Bell className="h-3 w-3" />
        Notify
      </div>
      <div className="text-sm font-semibold truncate">{label}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function OwnerReminderNode({ data, selected }: NodeProps) {
  const amount = Number(data?.amount ?? 2) || 2;
  const unit = (data?.unit as string) || "hours";
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Bell className="h-3 w-3" />
        Reminder
      </div>
      <div className="text-sm font-semibold">
        in {amount} {unit}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function AddTagNode({ data, selected }: NodeProps) {
  const tag = (data?.tag as string) || "tag";
  return (
    <NodeShell selected={selected} minWidth={140}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Tag className="h-3 w-3" />
        Add tag
      </div>
      <div className="text-sm font-semibold truncate">{tag}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function RemoveTagNode({ data, selected }: NodeProps) {
  const tag = (data?.tag as string) || "tag";
  return (
    <NodeShell selected={selected} minWidth={140}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <BadgeMinus className="h-3 w-3" />
        Remove tag
      </div>
      <div className="text-sm font-semibold truncate">{tag}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const rules = Array.isArray(data?.rules) ? data.rules.length : 0;
  return (
    <NodeShell selected={selected} minWidth={168}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <GitBranch className="h-3 w-3" />
        If / Else
      </div>
      <div className="text-sm font-semibold mb-2">
        {rules ? `${rules} rule(s)` : "Condition"}
      </div>
      {/* Yes = green (right). No = red (bottom). Labels sit next to the matching handle. */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 pr-1">
        <span>Yes</span>
      </div>
      <Handle
        type="source"
        id="yes"
        position={Position.Right}
        style={{ top: "62%" }}
        className="!bg-emerald-500 !w-2.5 !h-2.5"
      />
      <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-rose-700 dark:text-rose-400">
        <span>No</span>
      </div>
      <Handle
        type="source"
        id="no"
        position={Position.Bottom}
        className="!bg-rose-500 !w-2.5 !h-2.5"
      />
    </NodeShell>
  );
}

export function WebhookNode({ data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Globe className="h-3 w-3" />
        Webhook
      </div>
      <div className="text-sm font-semibold truncate">
        {(data?.url as string) || "HTTPS POST"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function ReviewRequestNode({ data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Star className="h-3 w-3" />
        Review
      </div>
      <div className="text-sm font-semibold truncate">
        {(data?.subject as string) || "Google review"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export function SendCouponNode({ data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Gift className="h-3 w-3" />
        Coupon
      </div>
      <div className="text-sm font-semibold truncate">
        {(data?.couponCode as string) || "Coupon"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
    </NodeShell>
  );
}

export const automationNodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  delay: DelayNode,
  notify_owner: NotifyOwnerNode,
  owner_reminder: OwnerReminderNode,
  add_tag: AddTagNode,
  remove_tag: RemoveTagNode,
  condition: ConditionNode,
  webhook: WebhookNode,
  review_request: ReviewRequestNode,
  send_coupon: SendCouponNode,
};
