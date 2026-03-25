import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CoursePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full widget URL, e.g. `{base}/widget?siteId=...&courseId=...` */
  src: string | null;
}

export function CoursePreviewModal({ open, onOpenChange, src }: CoursePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] sm:max-w-5xl p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden">
        <div className="shrink-0 px-6 pt-6 pb-2 pr-14">
          <DialogHeader className="text-left">
            <DialogTitle>Widget Preview</DialogTitle>
            <DialogDescription>This is what your buyers will see</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex w-full flex-1 flex-col min-h-0 px-6 pb-6">
          {src ? (
            <iframe
              src={src}
              title="HDP widget preview"
              className="block w-full min-h-[500px] flex-1 border-0 rounded-md bg-muted"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
