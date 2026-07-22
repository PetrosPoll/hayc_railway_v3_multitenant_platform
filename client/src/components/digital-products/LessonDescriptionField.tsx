import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function LessonDescriptionField({ id, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const previewEmpty = value.trim().length === 0;

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
        <TabsContent value="write" className="mt-2">
          <Textarea
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
          <p className="mt-1.5 text-xs text-muted-foreground">
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
              <div className="whitespace-pre-wrap break-words text-foreground">{value}</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
