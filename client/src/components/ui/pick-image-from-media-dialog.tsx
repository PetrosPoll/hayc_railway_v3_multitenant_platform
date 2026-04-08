import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PickImageFromMediaDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  websiteId: string | number;
  /** When provided, preselects the matching media item in the grid */
  currentFieldUrl?: string;
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

function isImageMediaItem(m: MediaItem): boolean {
  if (m.resourceType === "image") return true;
  if (m.resourceType === "video" || m.resourceType === "raw") return false;
  const ex = extFromPathOrUrl(m.name) || extFromPathOrUrl(m.url);
  return IMAGE_EXTENSIONS.has(ex);
}

export function PickImageFromMediaDialog({
  open,
  onClose,
  onSelect,
  websiteId,
  currentFieldUrl = "",
}: PickImageFromMediaDialogProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ media: MediaItem[] }>({
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

  const imageItems = useMemo(
    () => (data?.media ?? []).filter(isImageMediaItem),
    [data?.media]
  );

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      return;
    }
    if (currentFieldUrl && imageItems.some((m) => m.url === currentFieldUrl)) {
      setSelectedUrl(currentFieldUrl);
    } else {
      setSelectedUrl(null);
    }
  }, [open, currentFieldUrl, imageItems]);

  const handleSelect = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
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
            "w-[min(100vw-2rem,56rem)] max-w-3xl overflow-hidden"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              Pick an Image
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 [scrollbar-gutter:stable]">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-md" />
                ))}
              </div>
            ) : imageItems.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No images found. Upload images in the Media tab first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {imageItems.map((item) => {
                  const isSelected = selectedUrl === item.url;
                  return (
                    <button
                      key={item.publicId}
                      type="button"
                      onClick={() => setSelectedUrl(item.url)}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-md border-2 bg-muted/30 text-left transition-colors hover:bg-muted/50",
                        isSelected
                          ? "border-primary ring-2 ring-primary ring-offset-2"
                          : "border-transparent"
                      )}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        <img
                          src={item.previewUrl || item.url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
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

          <DialogFooter className="border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSelect} disabled={!selectedUrl}>
              Select
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
