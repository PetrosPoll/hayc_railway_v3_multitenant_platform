import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, File, Film, Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { loadCloudinaryWidget } from "@/lib/load-cloudinary-widget";
import { useToast } from "@/hooks/use-toast";

export interface PickImageFromMediaDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, meta?: { name?: string }) => void;
  websiteId: string | number;
  /** When provided, preselects the matching media item in the grid */
  currentFieldUrl?: string;
  /**
   * When set, only matching items are selectable.
   * - image: images only
   * - video: videos only
   * - media: images or videos (CMS hero/background slots)
   * - file / attachment: documents (+ images for attachment)
   */
  accept?: "image" | "video" | "media" | "file" | "attachment";
  /** Show Upload New (Cloudinary → website media). Defaults to true. */
  allowUpload?: boolean;
}

type MediaItem = {
  url: string;
  publicId: string;
  name: string;
  previewUrl?: string | null;
  format?: string | null;
  resourceType?: "image" | "video" | "raw";
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "heic",
  "heif",
]);

function extFromPathOrUrl(s: string): string {
  const base = (s.split("?")[0] ?? "").split("/").pop() ?? "";
  const m = /\.([a-z0-9]+)$/i.exec(base);
  return m ? m[1].toLowerCase() : "";
}

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "avi",
  "mkv",
  "ogv",
]);

const IMAGE_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "heic",
  "heif",
];

const VIDEO_FORMATS = ["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv"];

function isAccepted(
  item: MediaItem,
  accept: PickImageFromMediaDialogProps["accept"],
): boolean {
  if (!accept) return true;
  if (accept === "image") return item.resourceType === "image" || isImageMediaItem(item);
  if (accept === "video") return item.resourceType === "video" || isVideoMediaItem(item);
  if (accept === "media") {
    return (
      item.resourceType === "image" ||
      item.resourceType === "video" ||
      isImageMediaItem(item) ||
      isVideoMediaItem(item)
    );
  }
  if (accept === "file") return item.resourceType === "raw";
  if (accept === "attachment") {
    return item.resourceType === "raw" || item.resourceType === "image" || isImageMediaItem(item);
  }
  return true;
}

function isImageMediaItem(m: MediaItem): boolean {
  if (m.resourceType === "image") return true;
  if (m.resourceType === "video" || m.resourceType === "raw") return false;
  const ex = extFromPathOrUrl(m.name) || extFromPathOrUrl(m.url);
  return IMAGE_EXTENSIONS.has(ex);
}

function isVideoMediaItem(m: MediaItem): boolean {
  if (m.resourceType === "video") return true;
  if (m.resourceType === "image" || m.resourceType === "raw") return false;
  const ex = extFromPathOrUrl(m.name) || extFromPathOrUrl(m.url);
  return VIDEO_EXTENSIONS.has(ex);
}

function uploadConfigForAccept(accept: PickImageFromMediaDialogProps["accept"]): {
  resourceType: "image" | "video" | "auto" | "raw";
  clientAllowedFormats: string[];
} {
  if (accept === "image") {
    return { resourceType: "image", clientAllowedFormats: [...IMAGE_FORMATS] };
  }
  if (accept === "video") {
    return { resourceType: "video", clientAllowedFormats: [...VIDEO_FORMATS] };
  }
  if (accept === "media") {
    return {
      resourceType: "auto",
      clientAllowedFormats: [...IMAGE_FORMATS, ...VIDEO_FORMATS],
    };
  }
  if (accept === "file") {
    return {
      resourceType: "raw",
      clientAllowedFormats: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip"],
    };
  }
  if (accept === "attachment") {
    return {
      resourceType: "auto",
      clientAllowedFormats: [
        "pdf",
        "doc",
        "docx",
        "ppt",
        "pptx",
        "xls",
        "xlsx",
        "zip",
        ...IMAGE_FORMATS,
      ],
    };
  }
  return {
    resourceType: "auto",
    clientAllowedFormats: [...IMAGE_FORMATS, ...VIDEO_FORMATS, "pdf", "doc", "docx", "zip"],
  };
}

type CloudinaryWidget = { open: () => void; close?: () => void; destroy?: () => void };

export function PickImageFromMediaDialog({
  open,
  onClose,
  onSelect,
  websiteId,
  currentFieldUrl = "",
  accept,
  allowUpload,
}: PickImageFromMediaDialogProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inlineUploadOpen, setInlineUploadOpen] = useState(false);
  const inlineHostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CloudinaryWidget | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canUpload = allowUpload ?? true;

  const { data, isLoading, refetch } = useQuery<{ media: MediaItem[] }>({
    queryKey: ["/api/websites", websiteId, "media"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/media`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch media");
      return res.json();
    },
    enabled: open && websiteId !== "" && websiteId != null,
    staleTime: 0,
    gcTime: 0,
  });

  const mediaItems = useMemo(() => data?.media ?? [], [data?.media]);

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      setIsUploading(false);
      setInlineUploadOpen(false);
      try {
        widgetRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
      return;
    }
    if (currentFieldUrl && mediaItems.some((m) => m.url === currentFieldUrl)) {
      setSelectedUrl(currentFieldUrl);
    } else {
      setSelectedUrl(null);
    }
  }, [open, currentFieldUrl, mediaItems]);

  const handleSelect = () => {
    if (!selectedUrl) return;
    const item = mediaItems.find((m) => m.url === selectedUrl);
    onSelect(selectedUrl, item?.name ? { name: item.name } : undefined);
  };

  const resolveUploadFolder = async (): Promise<string> => {
    const [sessionRes, websiteRes] = await Promise.all([
      fetch("/api/auth/session", { credentials: "include" }),
      fetch(`/api/admin/websites/${websiteId}`, { credentials: "include" }),
    ]);
    if (!sessionRes.ok) throw new Error("Failed to load session");
    if (!websiteRes.ok) throw new Error("Failed to load website");
    const session = await sessionRes.json();
    const website = await websiteRes.json();
    const email = session?.user?.email;
    if (!email || typeof email !== "string") throw new Error("Missing user email");
    const domain = String(website.domain ?? "").replace(/\.pending-onboarding$/i, "");
    if (!domain) throw new Error("Missing website domain");
    return `Website Media/${email}/${domain}`;
  };

  const persistMediaItem = async (info: {
    secure_url?: string;
    public_id?: string;
    original_filename?: string;
    resource_type?: string;
  }) => {
    const url = info.secure_url ?? "";
    const publicId = info.public_id ?? "";
    if (!url || !publicId) throw new Error("Missing upload result");
    const rt = info.resource_type;
    const resourceType =
      rt === "image" || rt === "video" || rt === "raw" ? rt : undefined;
    const response = await fetch(`/api/websites/${websiteId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        url,
        publicId,
        name: info.original_filename || "Untitled",
        ...(resourceType ? { resourceType } : {}),
      }),
    });
    if (!response.ok) throw new Error("Failed to save media");
    return url;
  };

  const finishInlineUpload = () => {
    setIsUploading(false);
    setInlineUploadOpen(false);
    try {
      widgetRef.current?.destroy?.();
    } catch {
      /* ignore */
    }
    widgetRef.current = null;
    if (inlineHostRef.current) inlineHostRef.current.innerHTML = "";
  };

  const openUploadWidget = async () => {
    if (!canUpload || isUploading) return;
    setIsUploading(true);
    setInlineUploadOpen(true);

    try {
      await loadCloudinaryWidget();
      // Wait for the inline host to mount
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const host = inlineHostRef.current;
      if (!host) throw new Error("Upload container not ready");
      host.innerHTML = "";

      const folder = await resolveUploadFolder();
      const uploadCfg = uploadConfigForAccept(accept);

      const configResponse = await fetch("/api/cloudinary/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paramsToSign: { folder } }),
        credentials: "include",
      });
      if (!configResponse.ok) throw new Error("Failed to get upload configuration");
      const configData = await configResponse.json();

      const widget = window.cloudinary!.createUploadWidget(
        {
          cloudName: configData.cloudName,
          apiKey: configData.apiKey,
          // Render inside our dialog — never as a body overlay that fights Radix/CMS
          inlineContainer: host,
          uploadSignature: async (
            callback: (args: { signature: string; timestamp: number }) => void,
            paramsToSign: Record<string, unknown>,
          ) => {
            try {
              const response = await fetch("/api/cloudinary/signature", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
                credentials: "include",
              });
              if (!response.ok) throw new Error("Failed to get upload signature");
              const data = await response.json();
              callback({ signature: data.signature, timestamp: data.timestamp });
            } catch {
              toast({
                title: "Error",
                description: "Failed to prepare upload. Please try again.",
                variant: "destructive",
              });
            }
          },
          folder,
          sources: ["local", "url", "camera"],
          multiple: false,
          maxFileSize: 52428800,
          resourceType: uploadCfg.resourceType,
          clientAllowedFormats: uploadCfg.clientAllowedFormats,
        },
        (error: unknown, result: { event?: string; info?: Record<string, unknown> }) => {
          if (error) {
            toast({
              title: "Upload Error",
              description: "Failed to upload file. Please try again.",
              variant: "destructive",
            });
            finishInlineUpload();
            return;
          }
          if (result?.event === "success" && result.info) {
            const info = result.info as {
              secure_url?: string;
              public_id?: string;
              original_filename?: string;
              resource_type?: string;
            };
            void persistMediaItem(info)
              .then(async (url) => {
                await queryClient.invalidateQueries({
                  queryKey: ["/api/websites", websiteId, "media"],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["/api/admin/websites", String(websiteId)],
                });
                await refetch();
                setSelectedUrl(url);
                toast({
                  title: "Uploaded",
                  description: "File uploaded and added to Media.",
                });
                const originalName = info.original_filename?.trim();
                onSelect(url, originalName ? { name: originalName } : undefined);
              })
              .catch(() => {
                toast({
                  title: "Error",
                  description: "Upload succeeded but saving to Media failed.",
                  variant: "destructive",
                });
              })
              .finally(() => finishInlineUpload());
            return;
          }
          if (result?.event === "close" || result?.event === "abort") {
            finishInlineUpload();
          }
        },
      ) as CloudinaryWidget;

      widgetRef.current = widget;
      widget.open();
    } catch (err) {
      console.error("Upload init error:", err);
      toast({
        title: "Error",
        description: "Failed to initialize upload. Please try again.",
        variant: "destructive",
      });
      finishInlineUpload();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && inlineUploadOpen) {
          finishInlineUpload();
        }
        if (!next) onClose();
      }}
    >
      <DialogPortal
        container={typeof document !== "undefined" ? document.body : undefined}
      >
        <DialogOverlay className="z-[100]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] flex max-h-[85vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col gap-0 border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
            "relative w-[min(100vw-2rem,56rem)] max-w-3xl overflow-hidden",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              {inlineUploadOpen ? "Upload New" : "Choose File"}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              {canUpload && !inlineUploadOpen ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => void openUploadWidget()}
                >
                  {isUploading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  Upload New
                </Button>
              ) : null}
              {inlineUploadOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => finishInlineUpload()}
                >
                  Back
                </Button>
              ) : null}
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={cn(
                "h-full max-h-[min(60vh,28rem)] overflow-y-auto px-6 py-4 [scrollbar-gutter:stable]",
                inlineUploadOpen && "invisible pointer-events-none absolute inset-0",
              )}
            >
              {isLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-md" />
                  ))}
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No files found yet.</p>
                  {canUpload ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => void openUploadWidget()}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-1.5 h-4 w-4" />
                      )}
                      Upload New
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload files in the Media tab first.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {mediaItems.map((item) => {
                    const isSelected = selectedUrl === item.url;
                    const accepted = isAccepted(item, accept);
                    const showImagePreview =
                      item.resourceType === "image" || isImageMediaItem(item);
                    return (
                      <button
                        key={item.publicId}
                        type="button"
                        disabled={!accepted}
                        onClick={() => accepted && setSelectedUrl(item.url)}
                        className={cn(
                          "group relative flex flex-col overflow-hidden rounded-md border-2 bg-muted/30 text-left transition-colors",
                          accepted
                            ? "hover:bg-muted/50 cursor-pointer"
                            : "pointer-events-none opacity-40 cursor-not-allowed",
                          isSelected
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "border-transparent",
                        )}
                      >
                        {isSelected && (
                          <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div className="aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                          {showImagePreview ? (
                            <img
                              src={item.previewUrl || item.url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : item.resourceType === "video" ? (
                            <Film className="h-10 w-10 text-muted-foreground" />
                          ) : (
                            <File className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        <span className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {inlineUploadOpen ? (
              <div className="flex h-full min-h-[min(60vh,28rem)] flex-col px-2 py-2">
                <div
                  ref={inlineHostRef}
                  className="min-h-[min(55vh,24rem)] w-full flex-1 overflow-auto"
                />
              </div>
            ) : null}
          </div>

          {!inlineUploadOpen ? (
            <DialogFooter className="border-t px-6 py-4 sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSelect} disabled={!selectedUrl}>
                Select
              </Button>
            </DialogFooter>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
