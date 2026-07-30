import { useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { renderLessonDescription } from "@/components/digital-products/lessonDescriptionFormat";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function LessonDescriptionField({ id, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewEmpty = value.trim().length === 0;

  const wrapSelection = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el || disabled) return;

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

    const inner =
      selected.length > 0
        ? selected
        : t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.sampleText");
    const next = value.slice(0, start) + before + inner + after + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + inner.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("digitalProductsManagement.courseEditor.fields.description")}</Label>
      <Tabs defaultValue="write" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="write" className="text-xs sm:text-sm">
            {t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.write")}
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs sm:text-sm">
            {t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.preview")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={disabled}
              title={t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.bold")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrapSelection("**", "**")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={disabled}
              title={t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.italic")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrapSelection("*", "*")}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={disabled}
              title={t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.underline")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrapSelection("__", "__")}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            id={id}
            value={value}
            disabled={disabled}
            rows={8}
            className="min-h-[10rem] font-normal leading-relaxed"
            placeholder={t(
              "digitalProductsManagement.courseEditor.curriculum.descriptionEditor.placeholder"
            )}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.hint")}
          </p>
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div
            className="min-h-[10rem] rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed"
            data-testid="lesson-description-preview"
          >
            {previewEmpty ? (
              <p className="text-muted-foreground italic">
                {t("digitalProductsManagement.courseEditor.curriculum.descriptionEditor.emptyPreview")}
              </p>
            ) : (
              <div className="whitespace-pre-wrap break-words text-foreground">
                {renderLessonDescription(value)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
