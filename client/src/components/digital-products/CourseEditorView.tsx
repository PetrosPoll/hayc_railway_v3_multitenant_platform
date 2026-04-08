import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product, ProductStatus } from "@/types/digital-products";
import { CourseCurriculumTab } from "@/components/digital-products/CourseCurriculumTab";
import { PickImageFromMediaDialog } from "@/components/ui/pick-image-from-media-dialog";

type CourseLanguage = "el" | "en";

interface CourseFormState {
  title: string;
  description: string;
  thumbnail: string;
  previewVideoUrl: string;
  language: CourseLanguage;
  estimatedDurationMinutes: string;
  price: string;
  certificateEnabled: boolean;
  status: ProductStatus;
}

const DEFAULT_FORM: CourseFormState = {
  title: "",
  description: "",
  thumbnail: "",
  previewVideoUrl: "",
  language: "el",
  estimatedDurationMinutes: "",
  price: "0.00",
  certificateEnabled: false,
  status: "draft",
};

function toForm(source: Record<string, unknown> | null | undefined): CourseFormState {
  if (!source) return DEFAULT_FORM;
  const priceRaw = source.price;
  const parsedPrice =
    typeof priceRaw === "string"
      ? Number.parseFloat(priceRaw)
      : typeof priceRaw === "number"
        ? priceRaw
        : 0;

  return {
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    thumbnail: typeof source.thumbnail === "string" ? source.thumbnail : "",
    previewVideoUrl: typeof source.previewVideoUrl === "string" ? source.previewVideoUrl : "",
    language: source.language === "en" ? "en" : "el",
    estimatedDurationMinutes:
      typeof source.estimatedDurationMinutes === "number"
        ? String(source.estimatedDurationMinutes)
        : "",
    price: Number.isFinite(parsedPrice) ? parsedPrice.toString() : "0.00",
    certificateEnabled: source.certificateEnabled === true,
    status: source.status === "published" ? "published" : "draft",
  };
}

function toPayload(form: CourseFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    thumbnail: form.thumbnail.trim(),
    previewVideoUrl: form.previewVideoUrl.trim(),
    language: form.language,
    estimatedDurationMinutes:
      form.estimatedDurationMinutes.trim().length > 0 ? Number(form.estimatedDurationMinutes) : null,
    price: Number(Number(form.price).toFixed(2)),
    certificateEnabled: form.certificateEnabled,
    status: form.status,
  };
}

export interface CourseEditorViewProps {
  siteId: string;
  websiteId: string | number;
  mode: "new" | "edit";
  courseId?: string;
  products: Product[];
  onBack: () => void;
  onCreated: (newCourseId?: string, createdCourse?: Record<string, unknown>) => void;
  onUpdated: () => void;
}

export function CourseEditorView({
  siteId,
  websiteId,
  mode,
  courseId,
  products,
  onBack,
  onCreated,
  onUpdated,
}: CourseEditorViewProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const isEditMode = mode === "edit";

  const [form, setForm] = useState<CourseFormState>(DEFAULT_FORM);
  const [originalPayload, setOriginalPayload] = useState<Record<string, unknown>>(toPayload(DEFAULT_FORM));
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [resolvedTitle, setResolvedTitle] = useState(t("digitalProductsManagement.courseEditor.defaultNewCourseTitle"));

  useEffect(() => {
    if (!isEditMode) {
      const createPayload = toPayload(DEFAULT_FORM);
      setForm(DEFAULT_FORM);
      setOriginalPayload(createPayload);
      setResolvedTitle(t("digitalProductsManagement.courseEditor.defaultNewCourseTitle"));
      setIsLoading(false);
      return;
    }

    if (!courseId || !siteId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      setIsLoading(true);
      try {
        const source = products.find((p) => p.id === courseId) as unknown as Record<string, unknown> | undefined;

        if (source) {
          const mapped = toForm(source);
          if (!cancelled) {
            setForm(mapped);
            setOriginalPayload(toPayload(mapped));
            setResolvedTitle(mapped.title || t("digitalProductsManagement.courseEditor.defaultCourseTitle"));
          }
          return;
        }

        const response = await fetch(`/api/hdp/products/${encodeURIComponent(siteId)}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to load course");
        }

        const data = await response.json();
        const allProducts = Array.isArray(data)
          ? data
          : Array.isArray((data as { products?: unknown[] }).products)
            ? (data as { products: unknown[] }).products
            : [];
        const found = allProducts.find((p) => {
          const candidate = p as Record<string, unknown>;
          return candidate.id === courseId && candidate.type === "course";
        }) as Record<string, unknown> | undefined;

        if (found && !cancelled) {
          const mapped = toForm(found);
          setForm(mapped);
          setOriginalPayload(toPayload(mapped));
          setResolvedTitle(mapped.title || t("digitalProductsManagement.courseEditor.defaultCourseTitle"));
        }
      } catch (_error) {
        if (!cancelled) {
          toast({
            title: t("digitalProductsManagement.toasts.errorTitle"),
            description: t("digitalProductsManagement.courseEditor.toasts.failedToLoadCourse"),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, courseId, siteId, products, toast, t]);

  const currentPayload = useMemo(() => toPayload(form), [form]);
  const changedFields = useMemo(() => {
    const keys = Object.keys(currentPayload) as Array<keyof typeof currentPayload>;
    const changes: Partial<typeof currentPayload> = {};
    for (const key of keys) {
      if (currentPayload[key] !== (originalPayload as typeof currentPayload)[key]) {
        (changes as Record<keyof typeof currentPayload, (typeof currentPayload)[keyof typeof currentPayload]>)[key] =
          currentPayload[key];
      }
    }
    return changes;
  }, [currentPayload, originalPayload]);

  const hasUnsavedChanges = Object.keys(changedFields).length > 0;
  const canSave = !!siteId && form.title.trim().length > 0 && hasUnsavedChanges && !isSaving && !isLoading;

  const onTotalLessonMinutesChange = useCallback((totalMinutes: number) => {
    setForm((prev) => ({
      ...prev,
      estimatedDurationMinutes: String(Math.round(totalMinutes)),
    }));
  }, []);

  const onCourseEstimatedMinutesSynced = useCallback((minutes: number) => {
    setForm((prev) => ({ ...prev, estimatedDurationMinutes: String(minutes) }));
    setOriginalPayload((prev) => ({
      ...prev,
      estimatedDurationMinutes: minutes,
    }));
  }, []);

  const onSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const url = isEditMode && courseId
        ? `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(courseId)}`
        : `/api/hdp/products/${encodeURIComponent(siteId)}/courses`;
      const method = isEditMode ? "PATCH" : "POST";
      const body = isEditMode
        ? {
            ...changedFields,
            ...("estimatedDurationMinutes" in changedFields
              ? {
                  estimatedDurationMinutes:
                    changedFields.estimatedDurationMinutes === null || changedFields.estimatedDurationMinutes === undefined
                      ? changedFields.estimatedDurationMinutes
                      : Math.round(parseFloat(String(changedFields.estimatedDurationMinutes))),
                }
              : {}),
          }
        : {
            ...currentPayload,
            estimatedDurationMinutes:
              currentPayload.estimatedDurationMinutes === null
                ? null
                : Math.round(parseFloat(String(currentPayload.estimatedDurationMinutes))),
          };

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(t("digitalProductsManagement.courseEditor.toasts.failedToSaveCourse"));
      }

      if (!isEditMode) {
        const created = response.status === 204 ? null : await response.json();
        const newId = created?.id ? String(created.id) : undefined;
        const mapped = toPayload(form);
        setOriginalPayload(mapped);
        toast({
          title: t("digitalProductsManagement.toasts.successTitle"),
          description: t("digitalProductsManagement.toasts.courseCreated"),
        });
        onCreated(newId, created ?? undefined);
      } else {
        setOriginalPayload(currentPayload);
        toast({
          title: t("digitalProductsManagement.toasts.successTitle"),
          description: t("digitalProductsManagement.toasts.courseUpdated"),
        });
        onUpdated();
      }
    } catch (_error) {
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
    <>
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={onBack}
          >
            ← {t("digitalProductsManagement.title")}
          </button>
          <h1 className="text-2xl font-semibold">
            {isEditMode ? resolvedTitle : t("digitalProductsManagement.courseEditor.defaultNewCourseTitle")}
          </h1>
        </div>
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? t("digitalProductsManagement.common.saving") : t("digitalProductsManagement.common.save")}
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("digitalProductsManagement.courseEditor.tabs.details")}</TabsTrigger>
          <TabsTrigger value="curriculum">{t("digitalProductsManagement.courseEditor.tabs.curriculum")}</TabsTrigger>
          <TabsTrigger value="certificate">{t("digitalProductsManagement.courseEditor.tabs.certificate")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">{t("digitalProductsManagement.courseEditor.fields.title")}</Label>
            <Input
              id="course-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">{t("digitalProductsManagement.courseEditor.fields.description")}</Label>
            <Textarea
              id="course-description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-thumbnail">{t("digitalProductsManagement.courseEditor.fields.thumbnailUrl")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="course-thumbnail"
                value={form.thumbnail}
                readOnly
                placeholder="No image selected"
                className="w-full bg-muted/50"
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsPickingImage(true)}>
                Pick Image
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-preview-video-url">{t("digitalProductsManagement.courseEditor.fields.previewVideoUrl")}</Label>
            <Input
              id="course-preview-video-url"
              value={form.previewVideoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, previewVideoUrl: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-language">{t("digitalProductsManagement.courseEditor.fields.language")}</Label>
            <Select
              value={form.language}
              onValueChange={(value) => setForm((prev) => ({ ...prev, language: value as CourseLanguage }))}
            >
              <SelectTrigger id="course-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="el">{t("onboarding.greek")}</SelectItem>
                <SelectItem value="en">{t("onboarding.english")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-duration">{t("digitalProductsManagement.courseEditor.fields.estimatedDurationMinutes")}</Label>
            <Input
              id="course-duration"
              type="number"
              min={0}
              step={1}
              value={form.estimatedDurationMinutes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, estimatedDurationMinutes: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-price">{t("digitalProductsManagement.courseEditor.fields.priceEuro")}</Label>
            <Input
              id="course-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-status">{t("digitalProductsManagement.table.status")}</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ProductStatus }))}
            >
              <SelectTrigger id="course-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("digitalProductsManagement.status.draft")}</SelectItem>
                <SelectItem value="published">{t("digitalProductsManagement.status.published")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="curriculum" className="pt-4">
          <CourseCurriculumTab
            siteId={siteId}
            courseId={courseId}
            onTotalLessonMinutesChange={onTotalLessonMinutesChange}
            onCourseEstimatedMinutesSynced={onCourseEstimatedMinutesSynced}
          />
        </TabsContent>

        <TabsContent value="certificate" className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="course-certificate-enabled"
              checked={form.certificateEnabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, certificateEnabled: checked === true }))
              }
            />
            <Label htmlFor="course-certificate-enabled">
              {t("digitalProductsManagement.courseEditor.certificate.issueOnCompletion")}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("digitalProductsManagement.courseEditor.certificate.description")}
          </p>
        </TabsContent>
      </Tabs>
    </div>
    <PickImageFromMediaDialog
      open={isPickingImage}
      onClose={() => setIsPickingImage(false)}
      onSelect={(url) => {
        setForm((f) => ({ ...f, thumbnail: url }));
        setIsPickingImage(false);
      }}
      websiteId={websiteId}
      currentFieldUrl={form.thumbnail}
    />
    </>
  );
}
