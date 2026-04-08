import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, RefreshCw, AlertCircle, ChevronDown, X, Monitor, Smartphone, History, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PickImageFromMediaDialog } from "@/components/ui/pick-image-from-media-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function isLocaleString(val: unknown): boolean {
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return false;
  }
  const keys = Object.keys(val as object);
  if (keys.length !== 2) return false;
  const hasEl = keys.includes("el");
  const hasEn = keys.includes("en");
  if (!hasEl || !hasEn) return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.el === "string" && typeof obj.en === "string";
}

function createEmptyFromTemplate(template: unknown): unknown {
  if (isLocaleString(template)) {
    return { el: "", en: "" };
  }
  if (typeof template === "string") return "";
  if (typeof template === "number") return 0;
  if (typeof template === "boolean") return false;
  if (Array.isArray(template)) return [];
  if (typeof template === "object" && template !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = createEmptyFromTemplate(v);
    }
    return result;
  }
  return "";
}

function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined) return undefined;
    const idx = /^\d+$/.test(k) ? Number(k) : k;
    cur =
      typeof idx === "number"
        ? (cur as unknown[])[idx]
        : (cur as Record<string, unknown>)[k as string];
  }
  return cur;
}

interface ConfigFieldProps {
  path: string;
  fieldKey: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  focusedPath?: string | null;
  highlightedPath?: string | null;
  readOnlyFields?: string[];
  websiteLanguage?: string;
  onRequestPickImage?: (path: string) => void;
}

const IMAGE_FIELD_KEYWORDS = [
  "image",
  "img",
  "photo",
  "logo",
  "banner",
  "thumbnail",
  "avatar",
  "cover",
  "picture",
];

function isImageFieldKey(fieldKey: string): boolean {
  const key = fieldKey.toLowerCase();
  return IMAGE_FIELD_KEYWORDS.some((keyword) => key.includes(keyword));
}

function AutoResizeTextarea({ 
  value, 
  onChange, 
  ...props 
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);
  
  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className="min-h-[38px] resize-none overflow-hidden"
      rows={1}
      {...props}
    />
  );
}

function ConfigField({ path, fieldKey, value, onChange, focusedPath, highlightedPath, readOnlyFields, websiteLanguage, onRequestPickImage }: ConfigFieldProps) {
  const highlightClass = highlightedPath === path ? "hayc-field-highlighted" : "";
  const isReadOnly = readOnlyFields?.includes(fieldKey) ?? false;
  if (isLocaleString(value)) {
    const localeVal = value as { el: string; en: string };
    const showEl = websiteLanguage !== "en";
    const showEn = websiteLanguage !== "el";
    return (
      <div data-field-path={path} className={highlightClass}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        {showEl && (
          <div className="flex gap-2 items-start mb-1">
            <span className="text-xs text-muted-foreground w-6 shrink-0 pt-2">EL</span>
            <AutoResizeTextarea
              data-path={`${path}.el`}
              value={localeVal.el}
              onChange={(e) => onChange(path, { ...localeVal, el: e.target.value })}
            />
          </div>
        )}
        {showEn && (
          <div className="flex gap-2 items-start">
            <span className="text-xs text-muted-foreground w-6 shrink-0 pt-2">EN</span>
            <AutoResizeTextarea
              data-path={`${path}.en`}
              value={localeVal.en}
              onChange={(e) => onChange(path, { ...localeVal, en: e.target.value })}
            />
          </div>
        )}
      </div>
    );
  }

  if (typeof value === "string") {
    const isImageField = isImageFieldKey(fieldKey);

    return (
      <div data-field-path={path} className={highlightClass}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        {isImageField ? (
          <div className="flex items-center gap-2">
            <Input
              data-path={path}
              value={value}
              readOnly
              placeholder="No image selected"
              className="w-full bg-muted/50"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onRequestPickImage?.(path)}
              disabled={isReadOnly}
            >
              Pick Image
            </Button>
          </div>
        ) : isReadOnly ? (
          <Input data-path={path} value={value} readOnly className="bg-muted/50" />
        ) : (
          <AutoResizeTextarea data-path={path} value={value} onChange={(e) => onChange(path, e.target.value)} />
        )}
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div data-field-path={path} className={highlightClass}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        <Input
          data-path={path}
          type="number"
          value={value}
          onChange={(e) => onChange(path, Number(e.target.value))}
          readOnly={isReadOnly}
          className={isReadOnly ? "bg-muted/50" : undefined}
        />
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div data-field-path={path} data-path={path} className={`flex items-center justify-between ${highlightClass}`.trim()}>
        <label className="text-sm font-medium">{formatLabel(fieldKey)}</label>
        <Switch checked={value} onCheckedChange={(checked) => onChange(path, checked)} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div data-field-path={path} className={highlightClass}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{formatLabel(fieldKey)}</span>
          <Badge variant="secondary">{value.length} items</Badge>
        </div>
        {value.map((item, index) => (
          <ArrayItemCollapsible
            key={index}
            path={path}
            index={index}
            item={item}
            array={value}
            onChange={onChange}
            forceOpen={focusedPath?.startsWith(`${path}.${index}.`) ?? false}
            focusedPath={focusedPath}
            highlightedPath={highlightedPath}
            websiteLanguage={websiteLanguage}
            onRequestPickImage={onRequestPickImage}
          />
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    const filteredEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key, val]) => !shouldHideField(key, val));
    
    if (filteredEntries.length === 0) return null;
    
    return (
      <div data-field-path={path} className={`pl-3 border-l-2 ml-1 mt-1 ${highlightClass}`.trim()}>
        <label className="text-sm font-medium mb-2 block">{formatLabel(fieldKey)}</label>
        {filteredEntries.map(([key, val]) => (
          <div key={key} className="mb-3">
            <ConfigField
              path={`${path}.${key}`}
              fieldKey={key}
              value={val}
              onChange={onChange}
              focusedPath={focusedPath}
              highlightedPath={highlightedPath}
              websiteLanguage={websiteLanguage}
              onRequestPickImage={onRequestPickImage}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

interface ArrayItemCollapsibleProps {
  path: string;
  index: number;
  item: unknown;
  array: unknown[];
  onChange: (path: string, value: unknown) => void;
  forceOpen?: boolean;
  focusedPath?: string | null;
  highlightedPath?: string | null;
  websiteLanguage?: string;
  onRequestPickImage?: (path: string) => void;
}

function ArrayItemCollapsible({
  path,
  index,
  item,
  array,
  onChange,
  forceOpen,
  focusedPath,
  highlightedPath,
  websiteLanguage,
  onRequestPickImage,
}: ArrayItemCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-2">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between w-full px-4 py-2 cursor-pointer">
            <span className="text-sm">Item {index + 1}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            {typeof item === "object" && item !== null ? (
              Object.entries(item as Record<string, unknown>).map(([key, val]) => (
                <ConfigField
                  key={key}
                  path={`${path}.${index}.${key}`}
                  fieldKey={key}
                  value={val}
                  onChange={onChange}
                  focusedPath={focusedPath}
                  highlightedPath={highlightedPath}
                  readOnlyFields={["path"]}
                  websiteLanguage={websiteLanguage}
                  onRequestPickImage={onRequestPickImage}
                />
              ))
            ) : (
              <ConfigField
                path={`${path}.${index}`}
                fieldKey={`item`}
                value={item}
                onChange={onChange}
                focusedPath={focusedPath}
                highlightedPath={highlightedPath}
                websiteLanguage={websiteLanguage}
                onRequestPickImage={onRequestPickImage}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface ConfigSectionProps {
  sectionKey: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  forceOpen?: boolean;
  focusedPath?: string | null;
  highlightedPath?: string | null;
  websiteLanguage?: string;
  onRequestPickImage?: (path: string) => void;
}

const HIDDEN_KEYS = ["version", "exportedAt", "exported_at", "siteConfig", "site_config"];

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && value !== null) {
    // Check for empty locale strings {el: "", en: ""}
    if (isLocaleString(value)) {
      const localeVal = value as { el: string; en: string };
      return localeVal.el.trim() === "" && localeVal.en.trim() === "";
    }
    // Check for empty objects
    if (Object.keys(value).length === 0) return true;
    // Check if all nested values are empty
    const entries = Object.entries(value);
    return entries.every(([k, v]) => isEmptyValue(v));
  }
  return false;
}

function shouldHideField(key: string, value: unknown): boolean {
  if (HIDDEN_KEYS.includes(key)) return true;
  return isEmptyValue(value);
}

function ConfigSection({ sectionKey, value, onChange, forceOpen, focusedPath, highlightedPath, websiteLanguage, onRequestPickImage }: ConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  if (typeof value !== "object" || value === null) {
    return (
      <Card className="mb-4">
        <CardContent className="py-3 px-4">
          <ConfigField
            path={sectionKey}
            fieldKey={sectionKey}
            value={value}
            onChange={onChange}
            focusedPath={focusedPath}
            highlightedPath={highlightedPath}
            websiteLanguage={websiteLanguage}
            onRequestPickImage={onRequestPickImage}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{formatLabel(sectionKey)}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            {Object.entries(value as Record<string, unknown>)
              .filter(([key, val]) => !shouldHideField(key, val))
              .map(([key, val]) => (
                <ConfigField
                  key={key}
                  path={`${sectionKey}.${key}`}
                  fieldKey={key}
                  value={val}
                  onChange={onChange}
                  focusedPath={focusedPath}
                  highlightedPath={highlightedPath}
                  websiteLanguage={websiteLanguage}
                  onRequestPickImage={onRequestPickImage}
                />
              ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface VersionHistoryItem {
  versionKey: string;
  timestamp: number;
  lastModified: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];
  
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lineNum = 1;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      result.push({ type: "added", content: newLines[newIdx], lineNumber: lineNum++ });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      result.push({ type: "removed", content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      result.push({ type: "unchanged", content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
      newIdx++;
    } else if (!newSet.has(oldLines[oldIdx])) {
      result.push({ type: "removed", content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    } else if (!oldSet.has(newLines[newIdx])) {
      result.push({ type: "added", content: newLines[newIdx], lineNumber: lineNum++ });
      newIdx++;
    } else {
      result.push({ type: "removed", content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    }
  }
  
  return result;
}

interface DiffHunk {
  lines: DiffLine[];
}

function getDiffHunks(diffLines: DiffLine[], contextLines: number = 2): DiffHunk[] {
  const changeIndices: number[] = [];
  diffLines.forEach((line, idx) => {
    if (line.type !== "unchanged") {
      changeIndices.push(idx);
    }
  });

  if (changeIndices.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffLine[] = [];
  let lastIncludedIdx = -1;

  for (const changeIdx of changeIndices) {
    const startCtx = Math.max(0, changeIdx - contextLines);
    const endCtx = Math.min(diffLines.length - 1, changeIdx + contextLines);

    if (lastIncludedIdx >= startCtx - 1) {
      for (let i = lastIncludedIdx + 1; i <= endCtx; i++) {
        currentHunk.push(diffLines[i]);
      }
    } else {
      if (currentHunk.length > 0) {
        hunks.push({ lines: currentHunk });
      }
      currentHunk = [];
      for (let i = startCtx; i <= endCtx; i++) {
        currentHunk.push(diffLines[i]);
      }
    }
    lastIncludedIdx = endCtx;
  }

  if (currentHunk.length > 0) {
    hunks.push({ lines: currentHunk });
  }

  return hunks;
}

interface CompareRestoreModalProps {
  siteId: string;
  versionKey: string;
  timestamp: number;
  currentConfig: Record<string, unknown>;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

function CompareRestoreModal({ siteId, versionKey, timestamp, currentConfig, onClose, onRestoreSuccess }: CompareRestoreModalProps) {
  const { toast } = useToast();
  
  const [fetchId] = useState(() => Date.now());
  
  const { data: snapshotConfig, isLoading: snapshotLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/sites", siteId, "config/snapshot", versionKey, fetchId],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/config/snapshot?versionKey=${encodeURIComponent(versionKey)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch snapshot");
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/config/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ versionKey }),
      });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Restored",
        description: "Config restored successfully",
      });
      onRestoreSuccess();
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore config",
        variant: "destructive",
      });
    },
  });

  const isLoading = snapshotLoading;
  
  const diffLines = snapshotConfig
    ? computeDiff(
        JSON.stringify(currentConfig, null, 2),
        JSON.stringify(snapshotConfig, null, 2)
      )
    : [];

  const diffHunks = getDiffHunks(diffLines, 2);
  const hasChanges = diffHunks.length > 0;

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Compare & Restore — {formatTimestamp(timestamp)}
        </DialogTitle>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasChanges ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>No differences found. The snapshot is identical to the current config.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-2 flex gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Your current edits (will be lost)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Snapshot (will be restored)
                </span>
              </div>
              <div className="flex-1 overflow-auto border rounded-md bg-muted/20 font-mono text-xs">
                {diffHunks.map((hunk, hunkIdx) => (
                  <div key={hunkIdx}>
                    {hunkIdx > 0 && (
                      <div className="px-3 py-1 text-muted-foreground bg-muted/50 border-y text-center">
                        ···
                      </div>
                    )}
                    {hunk.lines.map((line, lineIdx) => (
                      <div
                        key={lineIdx}
                        className={`px-3 py-0.5 whitespace-pre ${
                          line.type === "added"
                            ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
                            : line.type === "removed"
                            ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                            : ""
                        }`}
                      >
                        <span className="inline-block w-6 text-right mr-3 text-muted-foreground select-none">
                          {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                        </span>
                        {line.content}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => restoreMutation.mutate()} 
            disabled={isLoading || restoreMutation.isPending}
          >
            {restoreMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Finalize Restore
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VersionHistorySectionProps {
  siteId: string;
  currentConfig: Record<string, unknown>;
  onRestore: () => void;
}

function VersionHistorySection({ siteId, currentConfig, onRestore }: VersionHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [compareVersion, setCompareVersion] = useState<VersionHistoryItem | null>(null);

  const {
    data: history,
    isLoading,
    refetch,
  } = useQuery<VersionHistoryItem[]>({
    queryKey: ["/api/sites", siteId, "config/history"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/config/history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: isOpen,
  });

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleRestoreSuccess = () => {
    onRestore();
    refetch();
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="mb-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span className="text-sm font-semibold">Version History (Latest 10)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      refetch();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isLoading && (!history || history.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No version history available
                </p>
              )}
              {!isLoading && history && history.length > 0 && (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.versionKey}
                      className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/30"
                    >
                      <span className="text-sm">
                        {formatTimestamp(item.timestamp)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompareVersion(item)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {compareVersion && (
        <CompareRestoreModal
          siteId={siteId}
          versionKey={compareVersion.versionKey}
          timestamp={compareVersion.timestamp}
          currentConfig={currentConfig}
          onClose={() => setCompareVersion(null)}
          onRestoreSuccess={handleRestoreSuccess}
        />
      )}
    </>
  );
}

interface ContentEditorProps {
  websiteId: number;
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContentEditor({ websiteId, siteId, open, onOpenChange }: ContentEditorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [localConfig, setLocalConfig] = useState<Record<string, unknown> | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pickImagePath, setPickImagePath] = useState<string | null>(null);

  const { data: websiteData } = useQuery<{ websiteLanguage?: string }>({
    queryKey: ["/api/admin/websites", websiteId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/websites/${websiteId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch website");
      return res.json();
    },
    enabled: !!websiteId,
  });

  const websiteLanguage = websiteData?.websiteLanguage;

  const {
    data: queryData,
    isLoading,
    isError,
    refetch,
  } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/websites", websiteId, "site-config"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/site-config`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      return await apiRequest("PUT", `/api/websites/${websiteId}/site-config`, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "site-config"] });
      setSavedAt(Date.now());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save config",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (queryData) {
      setLocalConfig(queryData);
    }
  }, [queryData]);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 10000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "HAYC_FIELD_FOCUS") return;
      const path = event.data?.path as string;
      if (!path) return;

      const sectionKey = path.split('.')[0];
      setFocusedSection(sectionKey);
      setFocusedPath(path);
      setHighlightedPath(path);

      setTimeout(() => {
        const el = document.querySelector(`[data-path="${path}"]`)
          ?? document.querySelector(`[data-field-path="${path}"]`)
          ?? document.querySelector(`[data-path="${path}.el"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);

      setTimeout(() => {
        setFocusedSection(null);
        setFocusedPath(null);
      }, 100);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const isDirty =
    localConfig !== null && JSON.stringify(localConfig) !== JSON.stringify(queryData);

  const handleReloadIframe = () => {
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      iframeRef.current.src = src;
    }
  };

  const handleSave = () => {
    if (localConfig) {
      mutation.mutate(localConfig);
    }
  };

  const handleFieldChange = (path: string, newValue: unknown) => {
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const keys = path.split(".");
      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = isNaN(Number(keys[i])) ? keys[i] : Number(keys[i]);
        current = current[k];
      }
      const last = isNaN(Number(keys[keys.length - 1]))
        ? keys[keys.length - 1]
        : Number(keys[keys.length - 1]);
      current[last] = newValue;

      iframeRef.current?.contentWindow?.postMessage(
        { type: "HAYC_CONFIG_UPDATE", payload: { config: updated } },
        "*"
      );

      return updated;
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 rounded-none border-0 gap-0 [&>button]:hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Content Editor</DialogTitle>
        </VisuallyHidden.Root>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="border-b px-4 py-2 flex items-center gap-4 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="mr-2"
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
            
            <Badge variant="outline" className="flex items-center gap-1">
              <a
                href={`https://${siteId}.hayc.gr`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                {siteId}.hayc.gr
                <ExternalLink className="h-3 w-3" />
              </a>
            </Badge>

            {savedAt !== null && (
              <span className="ml-auto text-sm text-green-600">
                ✓ Changes live within 60 seconds
              </span>
            )}

            <div className={savedAt === null ? "ml-auto flex items-center gap-2" : "flex items-center gap-2"}>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editMode}
                  onCheckedChange={(checked) => {
                    setEditMode(checked);
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: "HAYC_EDIT_MODE", payload: { enabled: checked } },
                      "*"
                    );
                  }}
                />
                <span className="text-sm font-medium">
                  Edit mode: {editMode ? "ON" : "OFF"}
                </span>
                {websiteLanguage && (
                  <span className="text-sm text-muted-foreground">
                    · Language: {websiteLanguage === "el" ? "Greek (EL)" : websiteLanguage === "en" ? "English (EN)" : websiteLanguage === "both" ? "Both (EL + EN)" : websiteLanguage}
                  </span>
                )}
              </div>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={previewMode === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewMode("desktop")}
                  className="rounded-r-none"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewMode === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewMode("mobile")}
                  className="rounded-l-none"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleReloadIframe}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                disabled={!isDirty || mutation.isPending}
                onClick={handleSave}
              >
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="w-3/4 h-full border-r overflow-hidden bg-muted/30 flex items-center justify-center">
              <iframe
                ref={iframeRef}
                src={`https://${siteId}.hayc.gr?hayc-edit=true`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
                className={`h-full border-0 bg-white transition-all duration-300 ${
                  previewMode === "mobile" 
                    ? "w-[390px] rounded-lg shadow-xl border" 
                    : "w-full"
                }`}
                title="Site preview"
                onLoad={() => {
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: "HAYC_EDIT_MODE", payload: { enabled: editMode } },
                    "*"
                  );
                }}
              />
            </div>

            <div className="w-1/4 h-full overflow-y-auto p-4 min-h-0" onClick={() => setHighlightedPath(null)}>
              {isLoading && (
                <>
                  <Skeleton className="h-24 w-full mb-4" />
                  <Skeleton className="h-24 w-full mb-4" />
                  <Skeleton className="h-24 w-full mb-4" />
                </>
              )}

              {isError && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-muted-foreground">Failed to load config</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              )}

          {localConfig !== null && !isLoading && !isError && (
            <div className="space-y-4">
              <VersionHistorySection siteId={siteId} currentConfig={localConfig} onRestore={() => { refetch(); handleReloadIframe(); }} />
              {Object.entries(localConfig)
                .filter(([key, value]) => !shouldHideField(key, value))
                .map(([key, value]) => (
                  <ConfigSection
                    key={key}
                    sectionKey={key}
                    value={value}
                    onChange={handleFieldChange}
                    forceOpen={focusedSection === key}
                    focusedPath={focusedPath}
                    highlightedPath={highlightedPath}
                    websiteLanguage={websiteLanguage}
                    onRequestPickImage={(path) => setPickImagePath(path)}
                  />
                ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <PickImageFromMediaDialog
      open={pickImagePath !== null}
      onClose={() => setPickImagePath(null)}
      onSelect={(url) => {
        if (pickImagePath) {
          handleFieldChange(pickImagePath, url);
        }
        setPickImagePath(null);
      }}
      websiteId={websiteId}
      currentFieldUrl={
        pickImagePath && localConfig
          ? String(getValueAtPath(localConfig, pickImagePath) ?? "")
          : ""
      }
    />
    </>
  );
}
