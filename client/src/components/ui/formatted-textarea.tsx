import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderLessonDescription } from "@/components/digital-products/lessonDescriptionFormat";

type FormattedTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Show a live preview of markers under the field */
  showPreview?: boolean;
};

function wrapSelection(
  el: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string,
  onChange: (next: string) => void,
) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = value.slice(start, end);
  const inner = selected.length > 0 ? selected : "text";
  const next = value.slice(0, start) + before + inner + after + value.slice(end);
  onChange(next);

  requestAnimationFrame(() => {
    el.focus();
    const cursorStart = start + before.length;
    const cursorEnd = cursorStart + inner.length;
    el.setSelectionRange(cursorStart, cursorEnd);
  });
}

/**
 * Auto-resizing textarea with **bold**, *italic*, __underline__ toolbar.
 * Markers are stored in the string (same format as lesson descriptions).
 */
export function FormattedTextarea({
  value,
  onChange,
  className,
  showPreview = true,
  disabled,
  readOnly,
  ...props
}: FormattedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canFormat = !disabled && !readOnly;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const applyFormat = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el || !canFormat) return;
    wrapSelection(el, value, before, after, (next) => {
      onChange({
        ...({} as React.ChangeEvent<HTMLTextAreaElement>),
        target: { ...el, value: next },
        currentTarget: { ...el, value: next },
      });
    });
  };

  return (
    <div className="w-full space-y-1.5">
      {canFormat ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            title="Bold (**text**)"
            onClick={() => applyFormat("**", "**")}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            title="Italic (*text*)"
            onClick={() => applyFormat("*", "*")}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            title="Underline (__text__)"
            onClick={() => applyFormat("__", "__")}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground ml-1">
            Select text, then format
          </span>
        </div>
      ) : null}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        className={cn("min-h-[38px] resize-none overflow-hidden", className)}
        rows={1}
        {...props}
      />
      {showPreview && value.trim().length > 0 && /(?:\*\*|__|\*[^*])/.test(value) ? (
        <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
          <span className="mr-1.5 font-medium text-muted-foreground/80">Preview:</span>
          <span className="whitespace-pre-wrap break-words text-foreground">
            {renderLessonDescription(value)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
