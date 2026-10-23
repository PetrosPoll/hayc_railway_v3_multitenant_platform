import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FormattedTextarea } from "@/components/ui/formatted-textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, RefreshCw, AlertCircle, ChevronDown, X, Monitor, Smartphone, History, RotateCcw, Loader2, SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PickImageFromMediaDialog } from "@/components/ui/pick-image-from-media-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

/** Strip technical size suffixes like P500 / p1080 before display. */
function formatLabel(key: string): string {
  return key
    .replace(/[Pp]\d{3,4}$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/** bannerImageP500 → { base: "bannerImage", width: 500 } */
const IMAGE_SIZE_SUFFIX_RE = /^(.*?)[Pp](\d{3,4})$/;

function parseImageSizeSuffix(key: string): { base: string; width: number } | null {
  const m = IMAGE_SIZE_SUFFIX_RE.exec(key);
  if (!m?.[1]) return null;
  return { base: m[1], width: Number(m[2]) };
}

function isAltFieldKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === "alt" || k === "alttext" || k.endsWith("alt") || k.endsWith("alttext");
}

/** Inject / replace c_limit,w_N on Cloudinary delivery URLs; otherwise return url as-is. */
function withCloudinaryWidth(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("cloudinary.com")) return url;
    const parts = u.pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return url;
    const after = parts.slice(uploadIdx + 1);
    if (after.length === 0) return url;
    const looksLikeTransform =
      /[,_/]/.test(after[0]) ||
      /^(c_|w_|h_|f_|q_|g_|ar_|e_|dpr_|fl_)/.test(after[0]);
    let rest = after;
    if (looksLikeTransform) {
      const kept = after[0]
        .split(",")
        .filter((p) => p && !/^w_\d+$/.test(p) && p !== "c_limit" && p !== "c_scale" && p !== "c_fit");
      rest = [`c_limit,w_${width}${kept.length ? `,${kept.join(",")}` : ""}`, ...after.slice(1)];
    } else {
      rest = [`c_limit,w_${width}`, ...after];
    }
    u.pathname = [...parts.slice(0, uploadIdx + 1), ...rest].join("/");
    return u.toString();
  } catch {
    return url;
  }
}

function setValueAtPath(obj: Record<string, unknown>, path: string, newValue: unknown) {
  const keys = path.split(".");
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = Number.isNaN(Number(keys[i])) ? keys[i] : Number(keys[i]);
    current = current[k];
  }
  const last = Number.isNaN(Number(keys[keys.length - 1]))
    ? keys[keys.length - 1]
    : Number(keys[keys.length - 1]);
  current[last] = newValue;
}

type ImageVariant = { key: string; path: string; width: number; value: string };
type ImagePickTarget = {
  primaryPath: string;
  variants: { path: string; width: number | null }[];
};

type FieldRenderItem =
  | { type: "field"; key: string; value: unknown }
  | {
      type: "image-group";
      baseKey: string;
      variants: ImageVariant[];
      altKey?: string;
      altValue?: unknown;
    };

function collectImageVariants(
  obj: Record<string, unknown>,
  baseKey: string,
  parentPath: string,
): ImageVariant[] {
  const variants: ImageVariant[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "string") continue;
    if (!isFileFieldKey(key)) continue;
    const parsed = parseImageSizeSuffix(key);
    if (!parsed || parsed.base !== baseKey) continue;
    variants.push({
      key,
      path: parentPath ? `${parentPath}.${key}` : key,
      width: parsed.width,
      value,
    });
  }
  variants.sort((a, b) => a.width - b.width);
  return variants;
}

function buildFieldRenderItems(
  obj: Record<string, unknown>,
  parentPath: string,
): FieldRenderItem[] {
  const entries = Object.entries(obj).filter(([key, val]) => !shouldHideField(key, val));
  const used = new Set<string>();
  const items: FieldRenderItem[] = [];
  const baseToKeys = new Map<string, string[]>();

  for (const [key, value] of entries) {
    if (typeof value !== "string" || !isFileFieldKey(key)) continue;
    const parsed = parseImageSizeSuffix(key);
    if (!parsed) continue;
    const list = baseToKeys.get(parsed.base) ?? [];
    list.push(key);
    baseToKeys.set(parsed.base, list);
  }

  for (const [baseKey, keys] of baseToKeys) {
    if (keys.length < 2) continue;
    const variants = collectImageVariants(obj, baseKey, parentPath);
    if (variants.length < 2) continue;
    keys.forEach((k) => used.add(k));

    const altKey = entries.find(([k]) => {
      if (used.has(k) || !isAltFieldKey(k)) return false;
      const lower = k.toLowerCase();
      const baseLower = baseKey.toLowerCase();
      return (
        lower === `${baseLower}alt` ||
        lower === `${baseLower}alttext` ||
        lower === "alt" ||
        lower === "alttext"
      );
    })?.[0];

    let altValue: unknown;
    if (altKey) {
      used.add(altKey);
      altValue = obj[altKey];
    }

    items.push({ type: "image-group", baseKey, variants, altKey, altValue });
  }

  for (const [key, value] of entries) {
    if (used.has(key)) continue;
    items.push({ type: "field", key, value });
  }

  return items;
}

function findImageEditTarget(
  focusPath: string,
  config: Record<string, unknown>,
): ImagePickTarget | null {
  const path = normalizeEditablePath(focusPath);
  const parts = path.split(".");
  const fieldKey = parts[parts.length - 1] ?? "";
  const parentPath = parts.slice(0, -1).join(".");
  const parentRaw = parentPath ? getValueAtPath(config, parentPath) : config;
  const parentObj =
    parentRaw && typeof parentRaw === "object" && !Array.isArray(parentRaw)
      ? (parentRaw as Record<string, unknown>)
      : null;

  const variantsForBase = (base: string): ImagePickTarget | null => {
    if (!parentObj) return null;
    const variants = collectImageVariants(parentObj, base, parentPath);
    if (variants.length >= 2) {
      return {
        primaryPath: variants[Math.floor(variants.length / 2)]?.path ?? variants[0].path,
        variants: variants.map((v) => ({ path: v.path, width: v.width })),
      };
    }
    return null;
  };

  if (parentObj && isAltFieldKey(fieldKey)) {
    const baseFromAlt = fieldKey.replace(/alttext$/i, "").replace(/alt$/i, "");
    if (baseFromAlt) {
      const grouped = variantsForBase(baseFromAlt);
      if (grouped) return grouped;
    }
    for (const [key, value] of Object.entries(parentObj)) {
      if (typeof value !== "string" || !isFileFieldKey(key)) continue;
      const parsed = parseImageSizeSuffix(key);
      if (parsed) {
        const grouped = variantsForBase(parsed.base);
        if (grouped) return grouped;
      }
      return {
        primaryPath: parentPath ? `${parentPath}.${key}` : key,
        variants: [{ path: parentPath ? `${parentPath}.${key}` : key, width: null }],
      };
    }
  }

  const directVal = getValueAtPath(config, path);
  if (typeof directVal === "string" && isFileField(fieldKey, directVal)) {
    const parsed = parseImageSizeSuffix(fieldKey);
    if (parsed) {
      const grouped = variantsForBase(parsed.base);
      if (grouped) return grouped;
    }
    return {
      primaryPath: path,
      variants: [{ path, width: parsed?.width ?? null }],
    };
  }

  if (parentObj && isFileFieldKey(fieldKey)) {
    const parsed = parseImageSizeSuffix(fieldKey);
    if (parsed) {
      const grouped = variantsForBase(parsed.base);
      if (grouped) return grouped;
    }
    return {
      primaryPath: path,
      variants: [{ path, width: parsed?.width ?? null }],
    };
  }

  return null;
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

function normalizeEditablePath(path: string): string {
  const parts = path.split(".");
  const last = parts[parts.length - 1];
  if ((last === "el" || last === "en") && parts.length > 1) {
    return parts.slice(0, -1).join(".");
  }
  return path;
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
  onRequestPickImageGroup?: (target: ImagePickTarget) => void;
}

function ImageGroupField({
  baseKey,
  variants,
  altKey,
  altValue,
  parentPath,
  onChange,
  highlightedPath,
  websiteLanguage,
  onRequestPickImageGroup,
  readOnly,
}: {
  baseKey: string;
  variants: ImageVariant[];
  altKey?: string;
  altValue?: unknown;
  parentPath: string;
  onChange: (path: string, value: unknown) => void;
  highlightedPath?: string | null;
  websiteLanguage?: string;
  onRequestPickImageGroup?: (target: ImagePickTarget) => void;
  readOnly?: boolean;
}) {
  const previewUrl =
    variants.find((v) => v.value.trim())?.value ||
    variants[Math.floor(variants.length / 2)]?.value ||
    "";
  const primary = variants[Math.floor(variants.length / 2)] ?? variants[0];
  const highlightClass = variants.some((v) => highlightedPath === v.path)
    ? "hayc-field-highlighted"
    : "";
  const altPath = altKey ? (parentPath ? `${parentPath}.${altKey}` : altKey) : null;

  return (
    <div
      data-field-path={primary.path}
      className={`rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3 ${highlightClass}`.trim()}
    >
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">{formatLabel(baseKey)}</p>
            <p className="text-xs text-muted-foreground">
              One upload · {variants.map((v) => `P${v.width}`).join(" / ")} generated automatically
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={readOnly}
            onClick={() =>
              onRequestPickImageGroup?.({
                primaryPath: primary.path,
                variants: variants.map((v) => ({ path: v.path, width: v.width })),
              })
            }
          >
            Change image
          </Button>
        </div>
      </div>
      {altPath && altValue !== undefined && (
        <div className="border-t border-border/50 pt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Alt text</p>
          <ConfigField
            path={altPath}
            fieldKey={altKey!}
            value={altValue}
            onChange={onChange}
            highlightedPath={highlightedPath}
            websiteLanguage={websiteLanguage}
          />
        </div>
      )}
    </div>
  );
}

function ObjectFields({
  obj,
  parentPath,
  onChange,
  focusedPath,
  highlightedPath,
  websiteLanguage,
  onRequestPickImage,
  onRequestPickImageGroup,
  readOnlyFields,
}: {
  obj: Record<string, unknown>;
  parentPath: string;
  onChange: (path: string, value: unknown) => void;
  focusedPath?: string | null;
  highlightedPath?: string | null;
  websiteLanguage?: string;
  onRequestPickImage?: (path: string) => void;
  onRequestPickImageGroup?: (target: ImagePickTarget) => void;
  readOnlyFields?: string[];
}) {
  const items = buildFieldRenderItems(obj, parentPath);
  return (
    <>
      {items.map((item) => {
        if (item.type === "image-group") {
          return (
            <div key={`img:${item.baseKey}`} className="mb-3">
              <ImageGroupField
                baseKey={item.baseKey}
                variants={item.variants}
                altKey={item.altKey}
                altValue={item.altValue}
                parentPath={parentPath}
                onChange={onChange}
                highlightedPath={highlightedPath}
                websiteLanguage={websiteLanguage}
                onRequestPickImageGroup={onRequestPickImageGroup}
                readOnly={readOnlyFields?.includes(item.baseKey)}
              />
            </div>
          );
        }
        return (
          <div key={item.key} className="mb-3">
            <ConfigField
              path={parentPath ? `${parentPath}.${item.key}` : item.key}
              fieldKey={item.key}
              value={item.value}
              onChange={onChange}
              focusedPath={focusedPath}
              highlightedPath={highlightedPath}
              readOnlyFields={readOnlyFields}
              websiteLanguage={websiteLanguage}
              onRequestPickImage={onRequestPickImage}
              onRequestPickImageGroup={onRequestPickImageGroup}
            />
          </div>
        );
      })}
    </>
  );
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

const FILE_FIELD_KEYWORDS = [
  ...IMAGE_FIELD_KEYWORDS,
  "icon",
  "favicon",
  "asset",
  "file",
  "pdf",
  "document",
  "attachment",
  "video",
  "audio",
  "media",
];

const FILE_PATH_EXTENSION = /\.(svg|png|jpe?g|gif|webp|bmp|ico|pdf|mp4|webm|mp3|wav|woff2?|ttf|eot)(\?.*)?$/i;

function isFileFieldKey(fieldKey: string): boolean {
  const key = fieldKey.toLowerCase();
  return FILE_FIELD_KEYWORDS.some((keyword) => key.includes(keyword));
}

function looksLikeFilePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (FILE_PATH_EXTENSION.test(trimmed)) return true;
  if (/^\/[\w./-]+$/.test(trimmed) && trimmed.includes(".")) return true;
  return false;
}

function isFileField(fieldKey: string, value: string): boolean {
  return isFileFieldKey(fieldKey) || looksLikeFilePath(value);
}

function ConfigField({ path, fieldKey, value, onChange, focusedPath, highlightedPath, readOnlyFields, websiteLanguage, onRequestPickImage, onRequestPickImageGroup }: ConfigFieldProps) {
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
            <FormattedTextarea
              data-path={`${path}.el`}
              value={localeVal.el}
              onChange={(e) => onChange(path, { ...localeVal, el: e.target.value })}
              readOnly={isReadOnly}
              className={isReadOnly ? "bg-muted/50" : undefined}
            />
          </div>
        )}
        {showEn && (
          <div className="flex gap-2 items-start">
            <span className="text-xs text-muted-foreground w-6 shrink-0 pt-2">EN</span>
            <FormattedTextarea
              data-path={`${path}.en`}
              value={localeVal.en}
              onChange={(e) => onChange(path, { ...localeVal, en: e.target.value })}
              readOnly={isReadOnly}
              className={isReadOnly ? "bg-muted/50" : undefined}
            />
          </div>
        )}
      </div>
    );
  }

  if (typeof value === "string") {
    const isFile = isFileField(fieldKey, value);
    const isImage =
      isFile &&
      IMAGE_FIELD_KEYWORDS.some((k) => fieldKey.toLowerCase().includes(k)) &&
      !/\.(pdf|mp4|webm|mp3|wav|svg)(\?|$)/i.test(value);

    return (
      <div data-field-path={path} className={highlightClass}>
        <label className="text-sm font-medium mb-1 block">{formatLabel(fieldKey)}</label>
        {isFile ? (
          <div className="flex items-center gap-3">
            {isImage && (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
                {value.trim() ? (
                  <img src={value} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                data-path={path}
                value={value}
                readOnly
                placeholder="No file selected"
                className="w-full bg-muted/50 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (onRequestPickImageGroup) {
                    onRequestPickImageGroup({
                      primaryPath: path,
                      variants: [
                        {
                          path,
                          width: parseImageSizeSuffix(fieldKey)?.width ?? null,
                        },
                      ],
                    });
                  } else {
                    onRequestPickImage?.(path);
                  }
                }}
                disabled={isReadOnly}
              >
                {isImage ? "Change image" : "Choose File"}
              </Button>
            </div>
          </div>
        ) : isReadOnly ? (
          <Input data-path={path} value={value} readOnly className="bg-muted/50" />
        ) : (
          <FormattedTextarea data-path={path} value={value} onChange={(e) => onChange(path, e.target.value)} />
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
            onRequestPickImageGroup={onRequestPickImageGroup}
          />
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    const items = buildFieldRenderItems(value as Record<string, unknown>, path);
    if (items.length === 0) return null;

    return (
      <div data-field-path={path} className={`pl-3 border-l-2 ml-1 mt-1 ${highlightClass}`.trim()}>
        <label className="text-sm font-medium mb-2 block">{formatLabel(fieldKey)}</label>
        <ObjectFields
          obj={value as Record<string, unknown>}
          parentPath={path}
          onChange={onChange}
          focusedPath={focusedPath}
          highlightedPath={highlightedPath}
          websiteLanguage={websiteLanguage}
          onRequestPickImage={onRequestPickImage}
          onRequestPickImageGroup={onRequestPickImageGroup}
        />
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
  onRequestPickImageGroup?: (target: ImagePickTarget) => void;
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
  onRequestPickImageGroup,
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
              <ObjectFields
                obj={item as Record<string, unknown>}
                parentPath={`${path}.${index}`}
                onChange={onChange}
                focusedPath={focusedPath}
                highlightedPath={highlightedPath}
                readOnlyFields={["path"]}
                websiteLanguage={websiteLanguage}
                onRequestPickImage={onRequestPickImage}
                onRequestPickImageGroup={onRequestPickImageGroup}
              />
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
                onRequestPickImageGroup={onRequestPickImageGroup}
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
  onRequestPickImageGroup?: (target: ImagePickTarget) => void;
}

const HIDDEN_KEYS = ["version", "exportedAt", "exported_at", "siteConfig", "site_config", "digitalProductsConfig", "forms"];

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

function ConfigSection({ sectionKey, value, onChange, forceOpen, focusedPath, highlightedPath, websiteLanguage, onRequestPickImage, onRequestPickImageGroup }: ConfigSectionProps) {
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
            onRequestPickImageGroup={onRequestPickImageGroup}
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
              <span className="text-sm font-semibold">{formatLabel(sectionKey).replace(/ Config$/i, "")}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            <ObjectFields
              obj={value as Record<string, unknown>}
              parentPath={sectionKey}
              onChange={onChange}
              focusedPath={focusedPath}
              highlightedPath={highlightedPath}
              websiteLanguage={websiteLanguage}
              onRequestPickImage={onRequestPickImage}
              onRequestPickImageGroup={onRequestPickImageGroup}
            />
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
  /** Always-current edit mode for message handlers / iframe load (avoids stale closures). */
  const editModeRef = useRef(false);
  const isMobile = useIsMobile();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown> | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<string | null>(null);
  const [pickImageTarget, setPickImageTarget] = useState<ImagePickTarget | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false);
  const [fieldDrawerPath, setFieldDrawerPath] = useState<string | null>(null);
  const localConfigRef = useRef<Record<string, unknown> | null>(null);

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
    localConfigRef.current = localConfig;
  }, [localConfig]);

  useEffect(() => {
    if (websiteLanguage && previewLanguage === null) {
      const langs = websiteLanguage === "both"
        ? ["el", "en"]
        : websiteLanguage.split(",").map((l) => l.trim()).filter(Boolean);
      if (langs.length > 0) setPreviewLanguage(langs[0]);
    }
  }, [websiteLanguage, previewLanguage]);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 10000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const postEditModeToIframe = useCallback((enabled: boolean) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const message = { type: "HAYC_EDIT_MODE", payload: { enabled } };
    // Safari often drops the first postMessage if the iframe just navigated /
    // listeners are not attached yet — retry a few times.
    win.postMessage(message, "*");
    window.setTimeout(() => win.postMessage(message, "*"), 50);
    window.setTimeout(() => win.postMessage(message, "*"), 250);
    window.setTimeout(() => win.postMessage(message, "*"), 800);
  }, []);

  const clearEditFocusUi = useCallback(() => {
    setFocusedSection(null);
    setFocusedPath(null);
    setHighlightedPath(null);
    setFieldDrawerPath(null);
    setFieldDrawerOpen(false);
  }, []);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    if (open) {
      setEditMode(false);
      editModeRef.current = false;
      clearEditFocusUi();
    }
    // Always push OFF to the iframe — on close this resets the site's edit
    // mode while the iframe is still mounted; on open it enforces false before
    // onLoad (needed because ?hayc-edit=true may boot the site in edit mode).
    postEditModeToIframe(false);
  }, [open, clearEditFocusUi, postEditModeToIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "HAYC_FIELD_FOCUS") return;
      // Parent Switch is source of truth. Safari can leave the iframe still
      // emitting focus events after Edit mode OFF — ignore them.
      if (!editModeRef.current) return;

      const path = event.data?.path as string;
      if (!path) return;

      const sectionKey = path.split(".")[0];
      setFocusedSection(sectionKey);
      setFocusedPath(path);

      const cfg = localConfigRef.current;
      const imageTarget = cfg ? findImageEditTarget(path, cfg) : null;
      if (imageTarget) {
        setHighlightedPath(imageTarget.primaryPath);
        setPickImageTarget(imageTarget);
        setFieldDrawerPath(imageTarget.primaryPath);
        if (isMobile) {
          setFieldDrawerOpen(true);
          setConfigDrawerOpen(false);
        } else {
          setTimeout(() => {
            const el = document.querySelector(`[data-field-path="${imageTarget.primaryPath}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      } else {
        setHighlightedPath(path);
        const normalized = normalizeEditablePath(path);
        setFieldDrawerPath(normalized);
        if (isMobile) {
          setFieldDrawerOpen(true);
          setConfigDrawerOpen(false);
        } else {
          setTimeout(() => {
            const el =
              document.querySelector(`[data-path="${path}"]`) ??
              document.querySelector(`[data-field-path="${normalized}"]`) ??
              document.querySelector(`[data-field-path="${path}"]`) ??
              document.querySelector(`[data-path="${path}.el"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }

      setTimeout(() => {
        setFocusedSection(null);
        setFocusedPath(null);
      }, 100);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isMobile]);

  const isDirty =
    localConfig !== null && JSON.stringify(localConfig) !== JSON.stringify(queryData);

  const requestClose = () => {
    if (isDirty) {
      setCloseConfirmOpen(true);
      return;
    }
    setConfigDrawerOpen(false);
    setFieldDrawerOpen(false);
    onOpenChange(false);
  };

  const discardAndClose = () => {
    if (queryData) setLocalConfig(queryData);
    setCloseConfirmOpen(false);
    setConfigDrawerOpen(false);
    setFieldDrawerOpen(false);
    onOpenChange(false);
  };

  const handleLanguageChange = (lang: string) => {
    setPreviewLanguage(lang);
  };

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
      setValueAtPath(updated, path, newValue);

      iframeRef.current?.contentWindow?.postMessage(
        { type: "HAYC_CONFIG_UPDATE", payload: { config: updated } },
        "*"
      );

      return updated;
    });
  };

  const handleImageGroupSelect = (url: string) => {
    if (!pickImageTarget) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      for (const variant of pickImageTarget.variants) {
        const nextUrl =
          variant.width != null ? withCloudinaryWidth(url, variant.width) : url;
        setValueAtPath(updated, variant.path, nextUrl);
      }
      iframeRef.current?.contentWindow?.postMessage(
        { type: "HAYC_CONFIG_UPDATE", payload: { config: updated } },
        "*"
      );
      return updated;
    });
    setPickImageTarget(null);
  };

  const openImagePicker = (target: ImagePickTarget) => setPickImageTarget(target);

  const configPanelContent = (
    <>
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
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
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
                websiteLanguage={previewLanguage ?? websiteLanguage}
                onRequestPickImage={(path) =>
                  openImagePicker({ primaryPath: path, variants: [{ path, width: null }] })
                }
                onRequestPickImageGroup={openImagePicker}
              />
            ))}
        </div>
      )}
    </>
  );

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          requestClose();
          return;
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-none w-screen h-screen h-dvh p-0 rounded-none border-0 gap-0 [&>button]:hidden" style={{ height: '100dvh' }}>
        <VisuallyHidden.Root>
          <DialogTitle>Content Editor</DialogTitle>
        </VisuallyHidden.Root>
        <div className="flex flex-col h-full overflow-hidden relative">

          {/* Header */}
          <div className="border-b px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={requestClose}
              className="mr-1 sm:mr-2 px-2 sm:px-3"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Close</span>
            </Button>

            <Badge variant="outline" className="hidden sm:flex items-center gap-1">
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
              <span className="hidden sm:inline ml-auto text-sm text-green-600">
                ✓ Changes live within 60 seconds
              </span>
            )}

            <div className={`ml-auto ${savedAt !== null ? "sm:ml-0" : ""} flex items-center gap-1 sm:gap-2`}>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Switch
                  checked={editMode}
                  onCheckedChange={(checked) => {
                    editModeRef.current = checked;
                    setEditMode(checked);
                    if (!checked) clearEditFocusUi();
                    postEditModeToIframe(checked);
                  }}
                />
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                  <span className="sm:hidden">Edit: </span>
                  <span className="hidden sm:inline">Edit mode: </span>
                  {editMode ? "ON" : "OFF"}
                </span>
                {websiteLanguage && (() => {
                  const langs = websiteLanguage === "both"
                    ? ["el", "en"]
                    : websiteLanguage.split(",").map(l => l.trim()).filter(Boolean);
                  if (langs.length <= 1) return null;
                  return (
                    <div className="flex items-center border rounded-md">
                      {langs.map((lang, i) => (
                        <Button
                          key={lang}
                          variant={previewLanguage === lang ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => handleLanguageChange(lang)}
                          className={`uppercase font-mono text-xs px-2.5 ${i === 0 ? "rounded-r-none" : "rounded-l-none"}`}
                        >
                          {lang}
                        </Button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="hidden sm:flex items-center border rounded-md">
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
              <Button variant="outline" size="sm" onClick={handleReloadIframe} className="flex">
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

          {/* Body */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Iframe */}
            <div className="w-full sm:w-3/4 h-full border-r overflow-hidden bg-muted/30 flex items-center justify-center">
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
                  // Prefer ref so a late Safari onLoad cannot re-enable edit
                  // with a stale React closure from when the iframe started loading.
                  postEditModeToIframe(editModeRef.current);
                }}
              />
            </div>

            {/* Config panel — desktop only */}
            <div className="hidden sm:flex sm:w-1/4 h-full min-h-0 flex-col border-l bg-background">
              {fieldDrawerPath && localConfig && highlightedPath ? (
                <div className="shrink-0 border-b bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Editing field</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setFieldDrawerPath(null);
                        setHighlightedPath(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                  <ConfigField
                    path={fieldDrawerPath}
                    fieldKey={fieldDrawerPath.split(".").pop() ?? ""}
                    value={getValueAtPath(localConfig, fieldDrawerPath)}
                    onChange={handleFieldChange}
                    highlightedPath={highlightedPath}
                    websiteLanguage={previewLanguage ?? websiteLanguage}
                    onRequestPickImage={(path) =>
                      openImagePicker({ primaryPath: path, variants: [{ path, width: null }] })
                    }
                    onRequestPickImageGroup={openImagePicker}
                  />
                </div>
              ) : (
                <div className="shrink-0 border-b px-4 py-2">
                  <p className="text-xs text-muted-foreground">
                    Turn Edit Mode on, then click text or an image on the preview to edit it here.
                  </p>
                </div>
              )}
              <div
                className="min-h-0 flex-1 overflow-y-auto p-4"
                onClick={() => setHighlightedPath(null)}
              >
                {configPanelContent}
              </div>
            </div>
          </div>

          {/* Mobile: backdrop (shared) */}
          <div
            className={`sm:hidden absolute inset-0 z-10 bg-black/40 transition-opacity duration-300 ${
              configDrawerOpen || fieldDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => { setConfigDrawerOpen(false); setFieldDrawerOpen(false); }}
          />

          {/* Mobile: FAB — hidden while field drawer is open */}
          <button
            className={`sm:hidden absolute bottom-5 right-4 z-20 bg-primary text-primary-foreground rounded-full shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-medium transition-opacity duration-200 ${
              fieldDrawerOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            onClick={() => { setFieldDrawerOpen(false); setConfigDrawerOpen(true); }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Edit Content
          </button>

          {/* Mobile: full config drawer (FAB) */}
          <div
            className={`sm:hidden absolute bottom-0 left-0 right-0 z-30 bg-background border-t rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
              configDrawerOpen ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ maxHeight: "78vh" }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <span className="font-semibold text-base">Edit Content</span>
              <Button variant="ghost" size="sm" onClick={() => setConfigDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0" onClick={() => setHighlightedPath(null)}>
              {configPanelContent}
            </div>
            <div className="p-4 border-t shrink-0">
              <Button
                className="w-full"
                disabled={!isDirty || mutation.isPending}
                onClick={handleSave}
              >
                {mutation.isPending ? "Saving..." : isDirty ? "Save Changes" : "No changes"}
              </Button>
            </div>
          </div>

          {/* Mobile: focused single-field mini-drawer (click-to-edit) */}
          <div
            className={`sm:hidden absolute bottom-0 left-0 right-0 z-30 bg-background border-t rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
              fieldDrawerOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setFieldDrawerOpen(false); setConfigDrawerOpen(true); }}
              >
                <SlidersHorizontal className="h-3 w-3" />
                Edit Content
              </button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFieldDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-4 pb-5">
              {fieldDrawerPath && localConfig && (() => {
                const fieldKey = fieldDrawerPath.split('.').pop() ?? '';
                const fieldValue = getValueAtPath(localConfig, fieldDrawerPath);
                return (
                  <>
                    <ConfigField
                      path={fieldDrawerPath}
                      fieldKey={fieldKey}
                      value={fieldValue}
                      onChange={handleFieldChange}
                      highlightedPath={highlightedPath}
                      websiteLanguage={previewLanguage ?? websiteLanguage}
                      onRequestPickImage={(path) =>
                        openImagePicker({ primaryPath: path, variants: [{ path, width: null }] })
                      }
                      onRequestPickImageGroup={openImagePicker}
                    />
                    <Button
                      className="w-full mt-4"
                      disabled={!isDirty || mutation.isPending}
                      onClick={() => { handleSave(); setFieldDrawerOpen(false); }}
                    >
                      {mutation.isPending ? "Saving..." : isDirty ? "Save" : "Done"}
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
    <PickImageFromMediaDialog
      open={pickImageTarget !== null}
      onClose={() => setPickImageTarget(null)}
      onSelect={handleImageGroupSelect}
      websiteId={websiteId}
      currentFieldUrl={
        pickImageTarget && localConfig
          ? String(getValueAtPath(localConfig, pickImageTarget.primaryPath) ?? "")
          : ""
      }
      accept={(() => {
        if (!pickImageTarget) return undefined;
        const key = pickImageTarget.primaryPath.toLowerCase();
        if (["video", "audio"].some((k) => key.includes(k))) return "media";
        if (["pdf", "document", "attachment"].some((k) => key.includes(k))) return "file";
        if (IMAGE_FIELD_KEYWORDS.some((k) => key.includes(k))) return "image";
        return "image";
      })()}
    />
    <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have edits that are not saved yet. If you close now, those changes will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={discardAndClose}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard & close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
