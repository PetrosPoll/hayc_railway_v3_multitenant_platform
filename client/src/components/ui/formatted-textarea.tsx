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

type SelectionRange = { start: number; end: number };

function isItalicConflict(value: string, at: number, marker: string): boolean {
  return marker === "*" && (value.startsWith("**", at) || (at > 0 && value[at - 1] === "*"));
}

/** Find markers immediately wrapping the current selection (or collapsed caret). */
function findImmediateOuter(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): SelectionRange | null {
  if (start < before.length) return null;
  if (end + after.length > value.length) return null;
  const openAt = start - before.length;
  const closeAt = end;
  if (value.slice(openAt, start) !== before) return null;
  if (value.slice(end, end + after.length) !== after) return null;
  if (isItalicConflict(value, openAt, before)) return null;
  if (after === "*" && value.startsWith("**", end)) return null;
  return { start: openAt, end: end + after.length };
}

/**
 * If caret/selection sits inside a marked span, return the outer marker range.
 * Scans outward from the selection for a matching before/after pair.
 */
function findEnclosingMarkers(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): SelectionRange | null {
  const immediate = findImmediateOuter(value, start, end, before, after);
  if (immediate) return immediate;

  for (let openAt = start - before.length; openAt >= 0; openAt--) {
    if (value.slice(openAt, openAt + before.length) !== before) continue;
    if (isItalicConflict(value, openAt, before)) continue;

    // Find the matching closer at or after `end`
    let searchFrom = Math.max(end, openAt + before.length);
    while (searchFrom <= value.length - after.length) {
      const closeAt = value.indexOf(after, searchFrom);
      if (closeAt === -1 || closeAt < end) break;
      if (after === "*" && value.startsWith("**", closeAt)) {
        searchFrom = closeAt + 2;
        continue;
      }
      // Prefer the closest closer that still wraps the selection
      const innerStart = openAt + before.length;
      const innerEnd = closeAt;
      if (start >= innerStart && end <= innerEnd) {
        return { start: openAt, end: closeAt + after.length };
      }
      break;
    }
  }
  return null;
}

function wrapSelection(
  el: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string,
  onChange: (next: string) => void,
  rememberSelection: (range: SelectionRange) => void,
) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = value.slice(start, end);

  const selectionHasMarkers =
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    !(before === "*" && selected.startsWith("**"));

  // Toggle off: selection includes its own markers
  if (selectionHasMarkers) {
    const inner = selected.slice(before.length, selected.length - after.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    onChange(next);
    rememberSelection({ start, end: start + inner.length });
    return;
  }

  // Toggle off: markers wrap the selection / caret
  const enclosing = findEnclosingMarkers(value, start, end, before, after);
  if (enclosing) {
    const innerStart = enclosing.start + before.length;
    const innerEnd = enclosing.end - after.length;
    const inner = value.slice(innerStart, innerEnd);
    const next = value.slice(0, enclosing.start) + inner + value.slice(enclosing.end);
    onChange(next);
    rememberSelection({
      start: enclosing.start,
      end: enclosing.start + inner.length,
    });
    return;
  }

  // Toggle on
  const inner = selected.length > 0 ? selected : "text";
  const next = value.slice(0, start) + before + inner + after + value.slice(end);
  onChange(next);
  rememberSelection({
    start: start + before.length,
    end: start + before.length + inner.length,
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
  const pendingSelectionRef = useRef<SelectionRange | null>(null);
  const canFormat = !disabled && !readOnly;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  // Restore selection after React re-renders the controlled textarea
  useEffect(() => {
    const range = pendingSelectionRef.current;
    const el = textareaRef.current;
    if (!range || !el) return;
    pendingSelectionRef.current = null;
    el.focus();
    el.setSelectionRange(range.start, range.end);
  }, [value]);

  const applyFormat = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el || !canFormat) return;
    wrapSelection(el, value, before, after, (next) => {
      onChange({
        target: { value: next },
        currentTarget: { value: next },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }, (range) => {
      pendingSelectionRef.current = range;
    });
  };

  // Keep textarea selection when clicking toolbar (otherwise toggle can't see markers)
  const preserveSelection = (e: React.MouseEvent) => {
    e.preventDefault();
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
            onMouseDown={preserveSelection}
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
            onMouseDown={preserveSelection}
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
            onMouseDown={preserveSelection}
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
