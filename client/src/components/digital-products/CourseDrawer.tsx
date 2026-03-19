import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { Product, ProductStatus } from "@/types/digital-products";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  siteId: string;
  product?: Product;
}

interface FormState {
  title: string;
  description: string;
  priceEuros: string;
  thumbnailUrl: string;
  status: ProductStatus;
}

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  priceEuros: "",
  thumbnailUrl: "",
  status: "draft",
};

export function CourseDrawer({ open, onClose, onSuccess, siteId, product }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!product;

  useEffect(() => {
    if (!open) return;

    if (product) {
      const productLike = product as Product & {
        description?: string | null;
        thumbnailUrl?: string | null;
      };
      setForm({
        title: product.title ?? "",
        description: productLike.description ?? "",
        priceEuros: (typeof product.price === "number" ? product.price / 100 : 0).toString(),
        thumbnailUrl: productLike.thumbnailUrl ?? "",
        status: product.status ?? "draft",
      });
      return;
    }

    setForm(DEFAULT_FORM);
  }, [open, product]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const canSubmit = useMemo(() => {
    const price = Number(form.priceEuros);
    return form.title.trim().length > 0 && Number.isFinite(price) && price >= 0 && !isSaving;
  }, [form.title, form.priceEuros, isSaving]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const priceCents = Math.round(Number(form.priceEuros) * 100);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: priceCents,
      thumbnailUrl: form.thumbnailUrl.trim(),
      status: form.status,
    };

    setIsSaving(true);
    try {
      const url = isEditMode
        ? `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(product!.id)}`
        : `/api/hdp/products/${encodeURIComponent(siteId)}/courses`;
      const method = isEditMode ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(isEditMode ? "Failed to update course" : "Failed to create course");
      }

      onSuccess();
      onClose();
      toast({
        title: t("digitalProductsManagement.toasts.successTitle"),
        description: isEditMode
          ? t("digitalProductsManagement.toasts.courseUpdated")
          : t("digitalProductsManagement.toasts.courseCreated"),
      });
    } catch (_err) {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: isEditMode
          ? t("digitalProductsManagement.toasts.failedToUpdateCourse")
          : t("digitalProductsManagement.toasts.failedToCreateCourse"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label={t("digitalProductsManagement.courseDrawer.closeDrawerAria")}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-2xl transform bg-background shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={
          isEditMode
            ? t("digitalProductsManagement.courseDrawer.editTitle")
            : t("digitalProductsManagement.courseDrawer.newTitle")
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-xl font-semibold">
              {isEditMode
                ? t("digitalProductsManagement.courseDrawer.editTitle")
                : t("digitalProductsManagement.courseDrawer.newTitle")}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSaving}
              aria-label={t("digitalProductsManagement.common.close")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="course-title">{t("digitalProductsManagement.courseDrawer.fields.title")}</Label>
                <Input
                  id="course-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={t("digitalProductsManagement.courseDrawer.placeholders.courseTitle")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-description">
                  {t("digitalProductsManagement.courseDrawer.fields.description")}
                </Label>
                <Textarea
                  id="course-description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("digitalProductsManagement.courseDrawer.placeholders.optionalDescription")}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-price">{t("digitalProductsManagement.courseDrawer.fields.priceEur")}</Label>
                <Input
                  id="course-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.priceEuros}
                  onChange={(e) => setForm((prev) => ({ ...prev, priceEuros: e.target.value }))}
                  placeholder="49"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-thumbnail-url">
                  {t("digitalProductsManagement.courseDrawer.fields.thumbnailUrl")}
                </Label>
                <Input
                  id="course-thumbnail-url"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>{t("digitalProductsManagement.courseDrawer.fields.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as ProductStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("digitalProductsManagement.courseDrawer.placeholders.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("digitalProductsManagement.status.draft")}</SelectItem>
                    <SelectItem value="published">{t("digitalProductsManagement.status.published")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {t("digitalProductsManagement.common.cancel")}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving
                ? t("digitalProductsManagement.common.saving")
                : isEditMode
                  ? t("digitalProductsManagement.common.saveChanges")
                  : t("digitalProductsManagement.common.save")}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
