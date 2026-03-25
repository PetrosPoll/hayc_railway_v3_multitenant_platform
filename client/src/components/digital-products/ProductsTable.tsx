import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
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
                <Badge
                  variant="secondary"
                  className={
                    product.status === "published"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                  }
                >
                  {product.status === "published"
                    ? t("digitalProductsManagement.status.published")
                    : t("digitalProductsManagement.status.draft")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  {product.type === "course" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => onPreviewCourse(product)}
                    >
                      {t("digitalProductsManagement.actions.preview", { defaultValue: "Preview" })}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onEdit(product)}
                  >
                    {t("digitalProductsManagement.actions.edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onStatusToggle(product.id, product.status)}
                  >
                    {product.status === "published"
                      ? t("digitalProductsManagement.actions.unpublish")
                      : t("digitalProductsManagement.actions.publish")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => onDelete(product.id)}
                    disabled={deletingId === product.id}
                  >
                    {deletingId === product.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("digitalProductsManagement.actions.deleting")}
                      </span>
                    ) : (
                      t("digitalProductsManagement.actions.delete")
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
