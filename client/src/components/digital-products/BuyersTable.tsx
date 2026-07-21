import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  formatCoursesCell,
  formatTotalSpent,
  type NormalizedBuyer,
} from "@/components/digital-products/buyersTableUtils";
import { cn } from "@/lib/utils";

interface Props {
  buyers: NormalizedBuyer[];
  demoBuyerEmail?: string | null;
  onManageEnrollments: (buyer: NormalizedBuyer) => void;
}

function isDemoBuyer(buyer: NormalizedBuyer, demoBuyerEmail?: string | null) {
  if (!demoBuyerEmail || !buyer.email) return false;
  return buyer.email.trim().toLowerCase() === demoBuyerEmail.trim().toLowerCase();
}

export function BuyersTable({ buyers, demoBuyerEmail, onManageEnrollments }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border">
      {/* Mobile: card layout */}
      <div className="divide-y sm:hidden">
        {buyers.map((buyer, index) => {
          const demo = isDemoBuyer(buyer, demoBuyerEmail);
          return (
            <div
              key={`${buyer.id || buyer.email}-${index}`}
              className={cn(
                "p-4 space-y-1.5",
                demo && "bg-amber-50 border-l-4 border-l-amber-400"
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{buyer.name?.trim() ? buyer.name : "—"}</p>
                {demo ? (
                  <span className="text-xs font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    {t("digitalProductsManagement.buyers.demoBadge")}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground break-all">{buyer.email || "—"}</p>
              <p className="text-sm">
                {formatCoursesCell(buyer.enrolledCourses, (count) =>
                  t("digitalProductsManagement.buyers.coursesCount", { count })
                )}
              </p>
              <div className="flex items-center justify-between gap-4 pt-1 text-sm text-muted-foreground">
                <span>
                  {demo
                    ? "—"
                    : formatTotalSpent(buyer.totalSpent, t("digitalProductsManagement.buyers.free"))}
                </span>
                <span>
                  {buyer.memberSince
                    ? buyer.memberSince.toLocaleDateString(undefined, { dateStyle: "medium" })
                    : "—"}
                </span>
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!buyer.id}
                  onClick={() => onManageEnrollments(buyer)}
                >
                  {t("digitalProductsManagement.buyers.enrollments.manage")}
                </Button>
              </div>
            </div>
          );
        })}
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
              <TableHead className="text-right">
                {t("digitalProductsManagement.buyers.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buyers.map((buyer, index) => {
              const demo = isDemoBuyer(buyer, demoBuyerEmail);
              return (
                <TableRow
                  key={`${buyer.id || buyer.email}-${index}`}
                  className={cn(demo && "bg-amber-50 hover:bg-amber-50/90")}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{buyer.name?.trim() ? buyer.name : "—"}</span>
                      {demo ? (
                        <span className="text-xs font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          {t("digitalProductsManagement.buyers.demoBadge")}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{buyer.email || "—"}</TableCell>
                  <TableCell className="max-w-[min(28rem,50vw)] break-words">
                    {formatCoursesCell(buyer.enrolledCourses, (count) =>
                      t("digitalProductsManagement.buyers.coursesCount", { count })
                    )}
                  </TableCell>
                  <TableCell>
                    {demo
                      ? "—"
                      : formatTotalSpent(buyer.totalSpent, t("digitalProductsManagement.buyers.free"))}
                  </TableCell>
                  <TableCell>
                    {buyer.memberSince
                      ? buyer.memberSince.toLocaleDateString(undefined, { dateStyle: "medium" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!buyer.id}
                      onClick={() => onManageEnrollments(buyer)}
                    >
                      {t("digitalProductsManagement.buyers.enrollments.manage")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
