import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import {
  normalizeBuyersResponse,
  type NormalizedBuyer,
} from "@/components/digital-products/buyersTableUtils";
import { BuyersTable } from "@/components/digital-products/BuyersTable";
import { Product, ProductStatus, ProductType } from "@/types/digital-products";
import { ProductTypeFilter } from "@/components/digital-products/ProductTypeFilter";
import { ProductsTable } from "@/components/digital-products/ProductsTable";
import { CreateProductButton } from "@/components/digital-products/CreateProductButton";
import { HdpBrandModal } from "@/components/HdpBrandModal";
import { CourseEditorView } from "@/components/digital-products/CourseEditorView";
import { CoursePreviewModal } from "@/components/digital-products/CoursePreviewModal";

interface Props {
  siteId: string;
  /** Website progress id — for media library API */
  websiteId: number;
  /** Courses list vs buyers — controlled by website dashboard sidebar */
  listMode?: "courses" | "buyers";
}

function typeLabel(type: ProductType): string {
  if (type === "course") return "course";
  return type;
}

const HDP_WIDGET_BASE =
  (import.meta.env.VITE_HDP_INTERNAL_URL as string | undefined)?.trim().replace(/\/$/, "") || "https://hdp.hayc.gr";

export function DigitalProductsTab({ siteId, websiteId, listMode = "courses" }: Props) {
  const { t } = useTranslation();
  const HDP_URL = import.meta.env.VITE_HDP_INTERNAL_URL as string | undefined;
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "course-new" | "course-edit">("list");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeFilter, setActiveFilter] = useState<ProductType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<NormalizedBuyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [buyersError, setBuyersError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<Product | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [productsRes, configRes] = await Promise.all([
        fetch(`/api/hdp/products/${encodeURIComponent(siteId)}`, {
          credentials: "include",
        }),
        fetch(`/api/sites/${encodeURIComponent(siteId)}/config`, {
          credentials: "include",
        }),
      ]);

      if (configRes.ok) {
        try {
          const cfg = (await configRes.json()) as Record<string, unknown>;
          const dpc = cfg.digitalProductsConfig as { lastSyncedAt?: unknown } | undefined;
          setLastSyncedAt(typeof dpc?.lastSyncedAt === "string" ? dpc.lastSyncedAt : null);
        } catch {
          setLastSyncedAt(null);
        }
      } else {
        setLastSyncedAt(null);
      }

      if (!productsRes.ok) {
        throw new Error("Failed to load products");
      }
      const data = await productsRes.json();
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

  const fetchBuyers = useCallback(async () => {
    setBuyersLoading(true);
    setBuyersError(null);
    try {
      const res = await fetch(`/api/hdp/buyers/${encodeURIComponent(siteId)}`, {
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") || "";
      let payload: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
      }
      if (!res.ok) {
        const msg =
          payload &&
          typeof payload === "object" &&
          payload !== null &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : t("digitalProductsManagement.buyers.loadError");
        setBuyersError(msg);
        setBuyers([]);
        return;
      }
      if (res.status === 204) {
        setBuyers([]);
        return;
      }
      setBuyers(normalizeBuyersResponse(payload));
    } catch {
      setBuyersError(t("digitalProductsManagement.buyers.loadError"));
      setBuyers([]);
    } finally {
      setBuyersLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => {
    if (listMode === "buyers") {
      void fetchBuyers();
    }
  }, [listMode, fetchBuyers]);

  const types = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.type)));
  }, [products]);

  useEffect(() => {
    if (listMode === "buyers") return;
    if (types.length === 0) return;
    if (activeFilter === null || !types.includes(activeFilter)) {
      setActiveFilter(types[0]);
    }
  }, [types, activeFilter, listMode]);

  const filteredProducts = useMemo(() => {
    if (!activeFilter) return [];
    return products.filter((product) => product.type === activeFilter);
  }, [products, activeFilter]);

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

  const handlePreviewCourse = useCallback((product: Product) => {
    if (product.type !== "course") return;
    setPreviewCourse(product);
  }, []);

  const previewIframeSrc = useMemo(() => {
    if (!previewCourse || previewCourse.type !== "course") return null;
    return `${HDP_WIDGET_BASE}/widget?siteId=${encodeURIComponent(siteId)}&courseId=${encodeURIComponent(previewCourse.id)}&preview=true`;
  }, [previewCourse, siteId]);

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

  const publishedCourseCount = useMemo(() => {
    return products.filter((p) => p.type === "course" && p.status === "published").length;
  }, [products]);

  const hasChangesSinceLastSync = useMemo(() => {
    if (!lastSyncedAt) return true;

    const lastSyncedDate = new Date(lastSyncedAt);
    const lastSyncedMs = lastSyncedDate.getTime();
    if (Number.isNaN(lastSyncedMs)) return true;

    return products.some((product) => {
      if (product.type !== "course" || product.status !== "published") return false;
      if (!product.updatedAt) return false;
      const updatedAtMs = new Date(product.updatedAt).getTime();
      if (Number.isNaN(updatedAtMs)) return false;
      return updatedAtMs > lastSyncedMs;
    });
  }, [lastSyncedAt, products]);

  const isSyncButtonDisabled = isSyncing || isLoading || !hasChangesSinceLastSync;

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return null;
    const d = new Date(lastSyncedAt);
    if (Number.isNaN(d.getTime())) return lastSyncedAt;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [lastSyncedAt]);

  const handleSyncToWebsite = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/hdp/products/${encodeURIComponent(siteId)}/sync`, {
        method: "POST",
        credentials: "include",
      });
      let body: Record<string, unknown> = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = (await res.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      if (!res.ok) {
        const msg =
          typeof body.error === "string"
            ? body.error
            : typeof body.details === "string"
              ? body.details
              : t("digitalProductsManagement.sync.syncFailed");
        toast({
          title: t("digitalProductsManagement.toasts.errorTitle"),
          description: msg,
          variant: "destructive",
        });
        return;
      }
      const synced = body.lastSyncedAt;
      if (typeof synced === "string") {
        setLastSyncedAt(synced);
      } else {
        setLastSyncedAt(new Date().toISOString());
      }
      toast({
        title: t("digitalProductsManagement.toasts.successTitle"),
        description: t("digitalProductsManagement.sync.syncSuccess"),
      });
    } catch {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: t("digitalProductsManagement.sync.syncFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (view === "course-new" || view === "course-edit") {
    return (
      <div>
        <CourseEditorView
          siteId={siteId}
          websiteId={websiteId}
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {listMode === "courses" ? (
            <ProductTypeFilter types={types} active={activeFilter} onChange={setActiveFilter} />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setBrandModalOpen(true)}
            data-testid="button-configure-look-feel"
          >
            {t("digitalProductsManagement.configureLookAndFeel")}
          </Button>
          {listMode === "courses" ? <CreateProductButton onSelect={handleCreateSelect} /> : null}
        </div>
      </div>

      {listMode === "courses" ? (
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSyncToWebsite}
              disabled={isSyncButtonDisabled}
              data-testid="button-sync-digital-products-to-website"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("digitalProductsManagement.sync.syncing")}
                </>
              ) : (
                t("digitalProductsManagement.sync.syncToWebsite")
              )}
            </Button>
            <span
              className={`inline-flex items-center gap-1 text-xs sm:text-sm ${
                hasChangesSinceLastSync ? "text-amber-600" : "text-green-600"
              }`}
            >
              {hasChangesSinceLastSync ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {t("digitalProductsManagement.sync.changesDetected")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("digitalProductsManagement.sync.upToDate")}
                </>
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("digitalProductsManagement.sync.coursesWillSync", { count: publishedCourseCount })}
          </p>
          {lastSyncedLabel ? (
            <p className="text-sm text-muted-foreground">
              {t("digitalProductsManagement.sync.lastSynced", { date: lastSyncedLabel })}
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {listMode === "buyers" ? (
        buyersLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : buyersError ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-red-600 mb-4">{buyersError}</p>
              <Button type="button" variant="outline" onClick={() => void fetchBuyers()}>
                {t("digitalProductsManagement.common.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : buyers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("digitalProductsManagement.buyers.empty")}
            </CardContent>
          </Card>
        ) : (
          <BuyersTable buyers={buyers} />
        )
      ) : isLoading ? (
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
            {activeFilter
              ? t("digitalProductsManagement.empty.noTypeFound", {
                  type: t(`digitalProductsManagement.types.${typeLabel(activeFilter)}`),
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
          onPreviewCourse={handlePreviewCourse}
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
        websiteId={websiteId}
        previewUrl={HDP_URL ? `${HDP_URL}?siteId=${encodeURIComponent(siteId)}` : undefined}
      />

      <CoursePreviewModal
        open={!!previewCourse}
        onOpenChange={(open) => {
          if (!open) setPreviewCourse(null);
        }}
        src={previewIframeSrc}
      />
    </div>
  );
}
