import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import {
  formatCoursesCell,
  formatTotalSpent,
  type NormalizedBuyer,
} from "@/components/digital-products/buyersTableUtils";

interface Props {
  buyers: NormalizedBuyer[];
}

export function BuyersTable({ buyers }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border">
      {/* Mobile: card layout */}
      <div className="divide-y sm:hidden">
        {buyers.map((buyer, index) => (
          <div key={`${buyer.email}-${index}`} className="p-4 space-y-1.5">
            <p className="font-medium">{buyer.name?.trim() ? buyer.name : "—"}</p>
            <p className="text-sm text-muted-foreground break-all">{buyer.email || "—"}</p>
            <p className="text-sm">
              {formatCoursesCell(buyer.courseTitles, (count) =>
                t("digitalProductsManagement.buyers.coursesCount", { count })
              )}
            </p>
            <div className="flex items-center justify-between gap-4 pt-1 text-sm text-muted-foreground">
              <span>{formatTotalSpent(buyer.totalSpent, t("digitalProductsManagement.buyers.free"))}</span>
              <span>
                {buyer.memberSince
                  ? buyer.memberSince.toLocaleDateString(undefined, { dateStyle: "medium" })
                  : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>{t("digitalProductsManagement.buyers.table.name")}</TableHead>
              <TableHead>{t("digitalProductsManagement.buyers.table.email")}</TableHead>
              <TableHead>{t("digitalProductsManagement.buyers.table.coursesEnrolled")}</TableHead>
              <TableHead>{t("digitalProductsManagement.buyers.table.totalSpent")}</TableHead>
              <TableHead>{t("digitalProductsManagement.buyers.table.memberSince")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buyers.map((buyer, index) => (
              <TableRow key={`${buyer.email}-${index}`}>
                <TableCell className="font-medium">{buyer.name?.trim() ? buyer.name : "—"}</TableCell>
                <TableCell>{buyer.email || "—"}</TableCell>
                <TableCell className="max-w-[min(28rem,50vw)] break-words">
                  {formatCoursesCell(buyer.courseTitles, (count) =>
                    t("digitalProductsManagement.buyers.coursesCount", { count })
                  )}
                </TableCell>
                <TableCell>{formatTotalSpent(buyer.totalSpent, t("digitalProductsManagement.buyers.free"))}</TableCell>
                <TableCell>
                  {buyer.memberSince
                    ? buyer.memberSince.toLocaleDateString(undefined, { dateStyle: "medium" })
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
