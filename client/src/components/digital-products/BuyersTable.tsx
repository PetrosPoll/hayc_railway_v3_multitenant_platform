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
      <Table>
        <TableHeader>
          <TableRow>
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
  );
}
