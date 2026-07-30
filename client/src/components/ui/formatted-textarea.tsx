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

  const isItalicStar = before === "*";

  const selectionHasMarkers =
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    !(isItalicStar && selected.startsWith("**"));

  const outerHasMarkers =
    start >= before.length &&
    end + after.length <= value.length &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after &&
    !(isItalicStar && value.slice(start - 2, start) === "**") &&
    !(isItalicStar && value.slice(end, end + 2) === "**");

  // Toggle off: markers already around or inside the selection
  if (selectionHasMarkers) {
    const inner = selected.slice(before.length, selected.length - after.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + inner.length);
    });
    return;
  }

  if (outerHasMarkers) {
    const next =
      value.slice(0, start - before.length) + selected + value.slice(end + after.length);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start - before.length, end - before.length);
    });
    return;
  }

  // Toggle on
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
        target: { value: next },
        currentTarget: { value: next },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    });
  };

  return (
    <div className="w-full space-y-1.5">
      {canFormat ? (
        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1 px-2.5 font-bold"
            title="Bold"
            onClick={() => applyFormat("**", "**")}
          >
            <Bold className="h-3.5 w-3.5" />
            <span className="text-xs">Bold</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1 px-2.5 italic"
            title="Italic"
            onClick={() => applyFormat("*", "*")}
          >
            <Italic className="h-3.5 w-3.5" />
            <span className="text-xs not-italic">Italic</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1 px-2.5 underline"
            title="Underline"
            onClick={() => applyFormat("__", "__")}
          >
            <Underline className="h-3.5 w-3.5" />
            <span className="text-xs no-underline">Underline</span>
          </Button>
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
