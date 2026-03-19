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
import { Product, ProductStatus } from "@/types/digital-products";

interface Props {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, currentStatus: ProductStatus) => void;
  deletingId: string | null;
}

function formatPrice(priceInCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceInCents / 100);
}

export function ProductsTable({ products, onEdit, onDelete, onStatusToggle, deletingId }: Props) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  {product.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onEdit(product)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onStatusToggle(product.id, product.status)}
                  >
                    {product.status === "published" ? "Unpublish" : "Publish"}
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
                        Deleting...
                      </span>
                    ) : (
                      "Delete"
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
