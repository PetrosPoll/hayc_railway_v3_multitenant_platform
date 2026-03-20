import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { Product, ProductStatus, ProductType } from "@/types/digital-products";
import { ProductTypeFilter } from "@/components/digital-products/ProductTypeFilter";
import { ProductsTable } from "@/components/digital-products/ProductsTable";
import { CreateProductButton } from "@/components/digital-products/CreateProductButton";
import { HdpBrandModal } from "@/components/HdpBrandModal";
import { CourseEditorView } from "@/components/digital-products/CourseEditorView";

interface Props {
  siteId: string;
}

function typeLabel(type: ProductType): string {
  if (type === "course") return "course";
  return type;
}

export function DigitalProductsTab({ siteId }: Props) {
  const { t } = useTranslation();
  const HDP_URL = import.meta.env.VITE_HDP_INTERNAL_URL as string | undefined;
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "course-new" | "course-edit">("list");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeType, setActiveType] = useState<ProductType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hdp/products/${encodeURIComponent(siteId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load products");
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data as Product[]);
      } else if (Array.isArray((data as { products?: Product[] }).products)) {
        setProducts((data as { products: Product[] }).products);
      } else {
        setProducts([]);
      }
    } catch (_err) {
      setError(t("digitalProductsManagement.toasts.failedToLoadProducts"));
    } finally {
      setIsLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const types = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.type)));
  }, [products]);

  useEffect(() => {
    if (types.length === 0) {
      setActiveType(null);
      return;
    }
    if (!activeType || !types.includes(activeType)) {
      setActiveType(types[0]);
    }
  }, [types, activeType]);

  const filteredProducts = useMemo(() => {
    if (!activeType) return products;
    return products.filter((product) => product.type === activeType);
  }, [products, activeType]);

  const handleEdit = (product: Product) => {
    setSelectedCourseId(product.id);
    setView("course-edit");
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    try {
      const response = await fetch(
        `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(confirmDeleteId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      await fetchProducts();
      toast({
        title: t("digitalProductsManagement.toasts.successTitle"),
        description: t("digitalProductsManagement.toasts.productDeleted"),
      });
    } catch (_err) {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: t("digitalProductsManagement.toasts.failedToDeleteProduct"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: ProductStatus) => {
    const nextStatus: ProductStatus = currentStatus === "published" ? "draft" : "published";

    try {
      const response = await fetch(
        `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      await fetchProducts();
      toast({
        title: t("digitalProductsManagement.toasts.successTitle"),
        description: t("digitalProductsManagement.toasts.statusUpdated"),
      });
    } catch (_err) {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: t("digitalProductsManagement.toasts.failedToUpdateStatus"),
        variant: "destructive",
      });
    }
  };

  const handleCreateSelect = (type: ProductType) => {
    if (type === "course") {
      setSelectedCourseId(null);
      setView("course-new");
    }
  };

  if (view === "course-new" || view === "course-edit") {
    return (
      <div>
        <CourseEditorView
          siteId={siteId}
          mode={view === "course-new" ? "new" : "edit"}
          courseId={selectedCourseId ?? undefined}
          products={products}
          onBack={() => setView("list")}
          onCreated={(newCourseId) => {
            if (newCourseId) {
              setSelectedCourseId(newCourseId);
              setView("course-edit");
            } else {
              setView("list");
            }
            fetchProducts();
          }}
          onUpdated={() => {
            fetchProducts();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">{t("digitalProductsManagement.title")}</h2>

      <div className="flex items-center justify-between mb-6 gap-4">
        <ProductTypeFilter
          types={types}
          active={activeType}
          onChange={setActiveType}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setBrandModalOpen(true)}
            data-testid="button-configure-look-feel"
          >
            {t("digitalProductsManagement.configureLookAndFeel")}
          </Button>
          <CreateProductButton onSelect={handleCreateSelect} />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Button type="button" variant="outline" onClick={fetchProducts}>
              {t("digitalProductsManagement.common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("digitalProductsManagement.empty.noProducts")}
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {activeType
              ? t("digitalProductsManagement.empty.noTypeFound", {
                  type: t(`digitalProductsManagement.types.${typeLabel(activeType)}`),
                })
              : t("digitalProductsManagement.empty.noProductsFound")}
          </CardContent>
        </Card>
      ) : (
        <ProductsTable
          products={filteredProducts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusToggle={handleStatusToggle}
          deletingId={deletingId}
        />
      )}

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setConfirmDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("digitalProductsManagement.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("digitalProductsManagement.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>
              {t("digitalProductsManagement.common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={!!deletingId}
            >
              {deletingId
                ? t("digitalProductsManagement.actions.deleting")
                : t("digitalProductsManagement.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HdpBrandModal
        open={brandModalOpen}
        onOpenChange={setBrandModalOpen}
        siteId={siteId}
        previewUrl={HDP_URL ? `${HDP_URL}?siteId=${encodeURIComponent(siteId)}` : undefined}
      />
    </div>
  );
}
