import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, RefreshCw, AlertCircle, ChevronDown, Trash2 } from "lucide-react";

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

function ConfigField({ path, fieldKey, value, onChange }: ConfigFieldProps) {
  if (isLocaleString(value)) {
    const localeVal = value as { el: string; en: string };
    return (
      <div data-field-path={path}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        <div className="flex gap-2 items-center mb-1">
          <span className="text-xs text-muted-foreground w-6 shrink-0">EL</span>
          <Input
            value={localeVal.el}
            onChange={(e) => onChange(path, { ...localeVal, el: e.target.value })}
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground w-6 shrink-0">EN</span>
          <Input
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
        <Input value={value} onChange={(e) => onChange(path, e.target.value)} />
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
          type="number"
          value={value}
          onChange={(e) => onChange(path, Number(e.target.value))}
        />
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div data-field-path={path} className="flex items-center justify-between">
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
    return (
      <div data-field-path={path} className="pl-3 border-l-2 ml-1 mt-1">
        <label className="text-sm font-medium mb-2 block">{formatLabel(fieldKey)}</label>
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
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
            {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
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
}

export function ContentEditor({ websiteId, siteId }: ContentEditorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [localConfig, setLocalConfig] = useState<Record<string, unknown> | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      const el = document.querySelector(`[data-field-path="${path}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("hayc-field-highlight");
      setTimeout(() => el.classList.remove("hayc-field-highlight"), 1000);
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
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="border-b px-4 py-2 flex items-center gap-4">
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 h-full border-r">
          <iframe
            ref={iframeRef}
            src={`https://${siteId}.hayc.gr?hayc-edit=true`}
            className="w-full h-full border-0"
            title="Site preview"
          />
        </div>

        <div className="w-1/2 h-full overflow-y-auto p-4">
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
              {Object.entries(localConfig).map(([key, value]) => (
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
  );
}
