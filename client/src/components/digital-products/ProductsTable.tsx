import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, EyeOff, Globe, Loader2, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Product, ProductStatus } from "@/types/digital-products";

interface Props {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, currentStatus: ProductStatus) => void;
  onPreviewCourse: (product: Product) => void;
  deletingId: string | null;
}

function formatPrice(price: number | string, currency: string): string {
  const amount = typeof price === "string" ? Number.parseFloat(price) : price;
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatusBadge({ status, t }: { status: ProductStatus; t: (k: string) => string }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === "published"
          ? "shrink-0 bg-green-100 text-green-800 hover:bg-green-100"
          : "shrink-0 bg-gray-100 text-gray-700 hover:bg-gray-100"
      }
    >
      {status === "published"
        ? t("digitalProductsManagement.status.published")
        : t("digitalProductsManagement.status.draft")}
    </Badge>
  );
}

export function ProductsTable({
  products,
  onEdit,
  onDelete,
  onStatusToggle,
  onPreviewCourse,
  deletingId,
}: Props) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <div className="rounded-lg border">
        {/* Mobile: card layout */}
        <div className="divide-y sm:hidden">
          {products.map((product) => (
            <div key={product.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{product.title}</p>
                <StatusBadge status={product.status} t={t} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatPrice(product.price, product.currency)}
              </p>
              <div className="flex items-center gap-1">
                {product.type === "course" ? (
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={t("digitalProductsManagement.actions.preview", { defaultValue: "Preview" })}
                    onClick={() => onPreviewCourse(product)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  aria-label={t("digitalProductsManagement.actions.edit")}
                  onClick={() => onEdit(product)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  aria-label={
                    product.status === "published"
                      ? t("digitalProductsManagement.actions.unpublish")
                      : t("digitalProductsManagement.actions.publish")
                  }
                  onClick={() => onStatusToggle(product.id, product.status)}
                >
                  {product.status === "published"
                    ? <EyeOff className="h-4 w-4" />
                    : <Globe className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={t("digitalProductsManagement.actions.delete")}
                  onClick={() => onDelete(product.id)}
                  disabled={deletingId === product.id}
                >
                  {deletingId === product.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table with icon buttons */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>{t("digitalProductsManagement.table.title")}</TableHead>
                <TableHead>{t("digitalProductsManagement.table.price")}</TableHead>
                <TableHead>{t("digitalProductsManagement.table.status")}</TableHead>
                <TableHead className="text-right">{t("digitalProductsManagement.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.title}</TableCell>
                  <TableCell>{formatPrice(product.price, product.currency)}</TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} t={t} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {product.type === "course" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => onPreviewCourse(product)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("digitalProductsManagement.actions.preview", { defaultValue: "Preview" })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => onEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("digitalProductsManagement.actions.edit")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => onStatusToggle(product.id, product.status)}
                          >
                            {product.status === "published"
                              ? <EyeOff className="h-4 w-4" />
                              : <Globe className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {product.status === "published"
                            ? t("digitalProductsManagement.actions.unpublish")
                            : t("digitalProductsManagement.actions.publish")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDelete(product.id)}
                            disabled={deletingId === product.id}
                          >
                            {deletingId === product.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("digitalProductsManagement.actions.delete")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
