import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function CourseFormModal({ open, onClose, onSuccess, siteId, product }: Props) {
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
        title: "Success",
        description: isEditMode ? "Course updated" : "Course created",
      });
    } catch (_err) {
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
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Course" : "Create Course"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input
              id="course-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Course title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-price">Price (EUR)</Label>
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
            <Label htmlFor="course-thumbnail-url">Thumbnail URL</Label>
            <Input
              id="course-thumbnail-url"
              value={form.thumbnailUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ProductStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : isEditMode ? "Save changes" : "Create course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
