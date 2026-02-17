import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Template } from "@shared/schema";

interface TemplatePreviewModalProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatePreviewModal({ template, open, onOpenChange }: TemplatePreviewModalProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        {template ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-background">
              <h2 className="text-2xl font-bold">{template.name}</h2>
              {/* <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="rounded-full"
                data-testid="button-close-modal"
              >
                <X className="h-5 w-5" />
              </Button> */}
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative bg-muted">
              {template.externalUrl ? (
                <iframe
                  src={template.externalUrl}
                  className="w-full h-full border-0"
                  title={`${template.name} preview`}
                  sandbox="allow-same-origin allow-scripts"
                  data-testid="iframe-template-preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No preview URL available for this template</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <p className="text-muted-foreground">No template selected</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
