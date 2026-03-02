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
import { ExternalLink, RefreshCw, AlertCircle, ChevronDown, Trash2, X, Monitor, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface ConfigFieldProps {
  path: string;
  fieldKey: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
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

function ConfigField({ path, fieldKey, value, onChange }: ConfigFieldProps) {
  if (isLocaleString(value)) {
    const localeVal = value as { el: string; en: string };
    return (
      <div data-field-path={path}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        <div className="flex gap-2 items-start mb-1">
          <span className="text-xs text-muted-foreground w-6 shrink-0 pt-2">EL</span>
          <AutoResizeTextarea
            data-path={`${path}.el`}
            value={localeVal.el}
            onChange={(e) => onChange(path, { ...localeVal, el: e.target.value })}
          />
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-xs text-muted-foreground w-6 shrink-0 pt-2">EN</span>
          <AutoResizeTextarea
            data-path={`${path}.en`}
            value={localeVal.en}
            onChange={(e) => onChange(path, { ...localeVal, en: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (typeof value === "string") {
    const showImage = /image|photo|logo|background/i.test(fieldKey) && value !== "";
    return (
      <div data-field-path={path}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        <AutoResizeTextarea data-path={path} value={value} onChange={(e) => onChange(path, e.target.value)} />
        {showImage && (
          <img src={value} className="mt-1 max-h-20 rounded object-cover" alt="" />
        )}
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div data-field-path={path}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        <Input
          data-path={path}
          type="number"
          value={value}
          onChange={(e) => onChange(path, Number(e.target.value))}
        />
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div data-field-path={path} data-path={path} className="flex items-center justify-between">
        <label className="text-sm font-medium">{formatLabel(fieldKey)}</label>
        <Switch checked={value} onCheckedChange={(checked) => onChange(path, checked)} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div data-field-path={path}>
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
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => {
            const template = value.length > 0 ? value[0] : {};
            const newItem = createEmptyFromTemplate(template);
            onChange(path, [...value, newItem]);
          }}
        >
          Add Item
        </Button>
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    const filteredEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key, val]) => !shouldHideField(key, val));
    
    if (filteredEntries.length === 0) return null;
    
    return (
      <div data-field-path={path} className="pl-3 border-l-2 ml-1 mt-1">
        <label className="text-sm font-medium mb-2 block">{formatLabel(fieldKey)}</label>
        {filteredEntries.map(([key, val]) => (
          <div key={key} className="mb-3">
            <ConfigField
              path={`${path}.${key}`}
              fieldKey={key}
              value={val}
              onChange={onChange}
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
}

function ArrayItemCollapsible({
  path,
  index,
  item,
  array,
  onChange,
}: ArrayItemCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRemove = () => {
    const newArray = array.filter((_, i) => i !== index);
    onChange(path, newArray);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-2">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between w-full px-4 py-2 cursor-pointer">
            <span className="text-sm">Item {index + 1}</span>
            <div className="flex gap-2">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
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
                />
              ))
            ) : (
              <ConfigField
                path={`${path}.${index}`}
                fieldKey={`item`}
                value={item}
                onChange={onChange}
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

function ConfigSection({ sectionKey, value, onChange }: ConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (typeof value !== "object" || value === null) {
    return (
      <Card className="mb-4">
        <CardContent className="py-3 px-4">
          <ConfigField
            path={sectionKey}
            fieldKey={sectionKey}
            value={value}
            onChange={onChange}
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
                />
              ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
      
      // Try exact match on input first, then fall back to wrapper div
      let el = document.querySelector(`[data-path="${path}"]`);
      if (!el) {
        el = document.querySelector(`[data-field-path="${path}"]`);
      }
      console.log('[HAYC] looking for path:', path, '| element found:', el);
      if (!el) return;
      
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-flash");
      setTimeout(() => el.classList.remove("highlight-flash"), 1500);
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
              />
            </div>

            <div className="w-1/4 h-full overflow-y-auto p-4 min-h-0">
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
              {Object.entries(localConfig)
                .filter(([key, value]) => !shouldHideField(key, value))
                .map(([key, value]) => (
                  <ConfigSection
                    key={key}
                    sectionKey={key}
                    value={value}
                    onChange={handleFieldChange}
                  />
                ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
