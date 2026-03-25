import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
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

interface Props {
  siteId: string;
  mode: "new" | "edit";
  courseId?: string;
  products: Product[];
  onBack: () => void;
  onCreated: (newCourseId?: string, createdCourse?: Record<string, unknown>) => void;
  onUpdated: () => void;
}

export function CourseEditorView({ siteId, mode, courseId, products, onBack, onCreated, onUpdated }: Props) {
  const { toast } = useToast();
  const isEditMode = mode === "edit";

  const [form, setForm] = useState<CourseFormState>(DEFAULT_FORM);
  const [originalPayload, setOriginalPayload] = useState<Record<string, unknown>>(toPayload(DEFAULT_FORM));
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [resolvedTitle, setResolvedTitle] = useState("New Course");

  useEffect(() => {
    if (!isEditMode) {
      const createPayload = toPayload(DEFAULT_FORM);
      setForm(DEFAULT_FORM);
      setOriginalPayload(createPayload);
      setResolvedTitle("New Course");
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
            setResolvedTitle(mapped.title || "Course");
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
          setResolvedTitle(mapped.title || "Course");
        }
      } catch (_error) {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load course",
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
  }, [isEditMode, courseId, siteId, products, toast]);

  const currentPayload = useMemo(() => toPayload(form), [form]);
  const changedFields = useMemo(() => {
    const keys = Object.keys(currentPayload) as Array<keyof typeof currentPayload>;
    const changes: Partial<typeof currentPayload> = {};
    for (const key of keys) {
      if (currentPayload[key] !== (originalPayload as typeof currentPayload)[key]) {
        changes[key] = currentPayload[key];
      }
    }
    return changes;
  }, [currentPayload, originalPayload]);

  const hasUnsavedChanges = Object.keys(changedFields).length > 0;
  const canSave = !!siteId && form.title.trim().length > 0 && hasUnsavedChanges && !isSaving && !isLoading;

  const onSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const url = isEditMode && courseId
        ? `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(courseId)}`
        : `/api/hdp/products/${encodeURIComponent(siteId)}/courses`;
      const method = isEditMode ? "PATCH" : "POST";
      const body = isEditMode ? changedFields : currentPayload;

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error("Failed to save course");
      }

      if (!isEditMode) {
        const created = response.status === 204 ? null : await response.json();
        const newId = created?.id ? String(created.id) : undefined;
        const mapped = toPayload(form);
        setOriginalPayload(mapped);
        toast({ title: "Success", description: "Course created successfully" });
        onCreated(newId, created ?? undefined);
      } else {
        setOriginalPayload(currentPayload);
        toast({ title: "Success", description: "Course updated successfully" });
        onUpdated();
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: isEditMode ? "Failed to update course" : "Failed to create course",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={onBack}
          >
            ← Digital Products
          </button>
          <h1 className="text-2xl font-semibold">{isEditMode ? resolvedTitle : "New Course"}</h1>
        </div>
        <Button type="button" onClick={onSave} disabled={!canSave}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="certificate">Certificate</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input
              id="course-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-thumbnail">Thumbnail URL</Label>
            <Input
              id="course-thumbnail"
              value={form.thumbnail}
              onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-preview-video-url">Preview Video URL</Label>
            <Input
              id="course-preview-video-url"
              value={form.previewVideoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, previewVideoUrl: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-language">Language</Label>
            <Select
              value={form.language}
              onValueChange={(value) => setForm((prev) => ({ ...prev, language: value as CourseLanguage }))}
            >
              <SelectTrigger id="course-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="el">Greek</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-duration">Estimated Duration (minutes)</Label>
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
            <Label htmlFor="course-price">Price (€)</Label>
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
            <Label htmlFor="course-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ProductStatus }))}
            >
              <SelectTrigger id="course-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="curriculum" className="pt-4">
          <CourseCurriculumTab siteId={siteId} courseId={courseId} />
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
            <Label htmlFor="course-certificate-enabled">Issue certificate on completion</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            When enabled, students will receive a certificate after completing all lessons.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
