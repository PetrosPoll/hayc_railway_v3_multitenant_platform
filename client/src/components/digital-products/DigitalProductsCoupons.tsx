import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { normalizeHdpProductsPayload } from "@/components/digital-products/hdpProductUtils";
import type { Product } from "@/types/digital-products";

type DiscountType = "percent" | "fixed";

type HdpCoupon = {
  id: string;
  siteId: string;
  code: string;
  courseId: string | null;
  discountType: DiscountType;
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type CreateForm = {
  code: string;
  discountType: DiscountType;
  percentOff: string;
  euros: string;
  courseId: string;
  maxRedemptions: string;
  expiresAt: string;
  active: boolean;
};

const EMPTY_CREATE: CreateForm = {
  code: "",
  discountType: "percent",
  percentOff: "",
  euros: "",
  courseId: "all",
  maxRedemptions: "",
  expiresAt: "",
  active: true,
};

interface Props {
  siteId: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseOptionalPositiveInt(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return "invalid";
  return n;
}

async function readApiMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    return "";
  }
  return "";
}

export function DigitalProductsCoupons({ siteId }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<HdpCoupon[]>([]);
  const [courses, setCourses] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editCoupon, setEditCoupon] = useState<HdpCoupon | null>(null);
  const [editMax, setEditMax] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deactivateCoupon, setDeactivateCoupon] = useState<HdpCoupon | null>(null);

  const courseTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      if (course.id) map.set(course.id, course.title);
    }
    return map;
  }, [courses]);

  const paidCourses = useMemo(
    () => courses.filter((course) => course.status === "published" && course.price > 0),
    [courses],
  );

  const mapApiError = useCallback(
    (raw: string) => {
      if (raw === "Coupon code already exists for this site") {
        return t("digitalProductsManagement.coupons.errors.duplicate");
      }
      if (raw === "Payments not configured for this site") {
        return t("digitalProductsManagement.coupons.errors.paymentsNotConfigured");
      }
      return raw || t("digitalProductsManagement.coupons.errors.generic");
    },
    [t],
  );

  const fetchCoupons = useCallback(async () => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [couponRes, productRes] = await Promise.all([
        fetch(`/api/hdp/coupons/${encodeURIComponent(siteId)}`, { credentials: "include" }),
        fetch(`/api/hdp/products/${encodeURIComponent(siteId)}`, { credentials: "include" }),
      ]);
      if (!couponRes.ok) {
        throw new Error(mapApiError(await readApiMessage(couponRes)));
      }
      const couponJson = (await couponRes.json()) as HdpCoupon[] | { coupons?: HdpCoupon[] };
      const list = Array.isArray(couponJson) ? couponJson : couponJson.coupons ?? [];
      setCoupons(list);
      if (productRes.ok) {
        setCourses(normalizeHdpProductsPayload(await productRes.json()));
      }
    } catch (err) {
      setCoupons([]);
      setError(err instanceof Error && err.message ? err.message : t("digitalProductsManagement.coupons.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [siteId, t, mapApiError]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const formatDiscount = (coupon: HdpCoupon) => {
    if (coupon.discountType === "percent") {
      return t("digitalProductsManagement.coupons.discountPercent", { value: coupon.percentOff ?? 0 });
    }
    const euros = (coupon.amountOffCents ?? 0) / 100;
    return new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(euros);
  };

  const formatExpires = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  };

  const openEdit = (coupon: HdpCoupon) => {
    setEditCoupon(coupon);
    setEditMax(coupon.maxRedemptions == null ? "" : String(coupon.maxRedemptions));
    setEditExpires(toLocalInput(coupon.expiresAt));
    setEditError(null);
  };

  const handleCreate = async () => {
    const code = createForm.code.trim();
    if (code.length < 2 || code.length > 40) {
      setCreateError(t("digitalProductsManagement.coupons.errors.code"));
      return;
    }
    const body: Record<string, unknown> = {
      code,
      discountType: createForm.discountType,
      courseId: createForm.courseId === "all" ? null : createForm.courseId,
      active: createForm.active,
    };
    if (createForm.discountType === "percent") {
      const percent = Number(createForm.percentOff);
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        setCreateError(t("digitalProductsManagement.coupons.errors.percent"));
        return;
      }
      body.percentOff = percent;
    } else {
      const euros = Number(createForm.euros);
      const cents = Math.round(euros * 100);
      if (!Number.isFinite(euros) || cents < 1) {
        setCreateError(t("digitalProductsManagement.coupons.errors.amount"));
        return;
      }
      body.amountOffCents = cents;
    }
    const max = parseOptionalPositiveInt(createForm.maxRedemptions);
    if (max === "invalid") {
      setCreateError(t("digitalProductsManagement.coupons.errors.maxRedemptions"));
      return;
    }
    body.maxRedemptions = max;
    if (!createForm.expiresAt.trim()) {
      body.expiresAt = null;
    } else {
      const expires = new Date(createForm.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        setCreateError(t("digitalProductsManagement.coupons.errors.expires"));
        return;
      }
      body.expiresAt = expires.toISOString();
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/hdp/coupons/${encodeURIComponent(siteId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = mapApiError(await readApiMessage(res));
        setCreateError(message);
        toast({ title: message, variant: "destructive" });
        return;
      }
      toast({ title: t("digitalProductsManagement.coupons.created") });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      await fetchCoupons();
    } catch {
      const message = t("digitalProductsManagement.coupons.errors.generic");
      setCreateError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const patchCoupon = async (couponId: string, body: Record<string, unknown>) => {
    setPendingId(couponId);
    try {
      const res = await fetch(
        `/api/hdp/coupons/${encodeURIComponent(siteId)}/${encodeURIComponent(couponId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        toast({ title: mapApiError(await readApiMessage(res)), variant: "destructive" });
        return false;
      }
      toast({ title: t("digitalProductsManagement.coupons.updated") });
      await fetchCoupons();
      return true;
    } catch {
      toast({ title: t("digitalProductsManagement.coupons.errors.generic"), variant: "destructive" });
      return false;
    } finally {
      setPendingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editCoupon) return;
    const max = parseOptionalPositiveInt(editMax);
    if (max === "invalid") {
      setEditError(t("digitalProductsManagement.coupons.errors.maxRedemptions"));
      return;
    }
    let expiresAt: string | null = null;
    if (editExpires.trim()) {
      const expires = new Date(editExpires);
      if (Number.isNaN(expires.getTime())) {
        setEditError(t("digitalProductsManagement.coupons.errors.expires"));
        return;
      }
      expiresAt = expires.toISOString();
    }
    setIsSavingEdit(true);
    setEditError(null);
    const ok = await patchCoupon(editCoupon.id, { maxRedemptions: max, expiresAt });
    setIsSavingEdit(false);
    if (ok) setEditCoupon(null);
  };

  const handleDeactivate = async () => {
    if (!deactivateCoupon) return;
    const couponId = deactivateCoupon.id;
    setPendingId(couponId);
    try {
      const res = await fetch(
        `/api/hdp/coupons/${encodeURIComponent(siteId)}/${encodeURIComponent(couponId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast({ title: mapApiError(await readApiMessage(res)), variant: "destructive" });
        return;
      }
      toast({ title: t("digitalProductsManagement.coupons.deactivated") });
      setDeactivateCoupon(null);
      await fetchCoupons();
    } catch {
      toast({ title: t("digitalProductsManagement.coupons.errors.generic"), variant: "destructive" });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div data-testid="digital-products-coupons">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{t("digitalProductsManagement.coupons.title")}</h2>
        <Button
          type="button"
          onClick={() => {
            setCreateForm(EMPTY_CREATE);
            setCreateError(null);
            setCreateOpen(true);
          }}
          data-testid="button-create-coupon"
        >
          {t("digitalProductsManagement.coupons.create")}
        </Button>
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
            <Button type="button" variant="outline" onClick={() => void fetchCoupons()}>
              {t("digitalProductsManagement.common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("digitalProductsManagement.coupons.empty")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.code")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.discount")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.scope")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.redemptions")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.expires")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.status")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.coupons.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const scope = coupon.courseId
                    ? courseTitleById.get(coupon.courseId) || t("digitalProductsManagement.coupons.scopeCourse")
                    : t("digitalProductsManagement.coupons.scopeAll");
                  const redemptions =
                    coupon.maxRedemptions == null
                      ? t("digitalProductsManagement.coupons.redemptionsUnlimited", { count: coupon.redeemedCount ?? 0 })
                      : t("digitalProductsManagement.coupons.redemptionsLimited", {
                          count: coupon.redeemedCount ?? 0,
                          max: coupon.maxRedemptions,
                        });
                  const busy = pendingId === coupon.id;
                  return (
                    <TableRow key={coupon.id} data-testid={`coupon-row-${coupon.code}`}>
                      <TableCell className="font-medium">{coupon.code}</TableCell>
                      <TableCell>{formatDiscount(coupon)}</TableCell>
                      <TableCell>{scope}</TableCell>
                      <TableCell>{redemptions}</TableCell>
                      <TableCell>{formatExpires(coupon.expiresAt)}</TableCell>
                      <TableCell>
                        <Badge variant={coupon.active ? "default" : "secondary"}>
                          {coupon.active
                            ? t("digitalProductsManagement.coupons.statusActive")
                            : t("digitalProductsManagement.coupons.statusInactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={coupon.active}
                            disabled={busy}
                            onCheckedChange={(checked) => {
                              void patchCoupon(coupon.id, { active: checked });
                            }}
                            aria-label={t("digitalProductsManagement.coupons.columns.status")}
                            data-testid={`switch-coupon-active-${coupon.code}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => openEdit(coupon)}
                          >
                            {t("digitalProductsManagement.coupons.edit")}
                          </Button>
                          {coupon.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setDeactivateCoupon(coupon)}
                            >
                              {t("digitalProductsManagement.coupons.deactivate")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("digitalProductsManagement.coupons.create")}</DialogTitle>
            <DialogDescription>{t("digitalProductsManagement.coupons.createHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">{t("digitalProductsManagement.coupons.fields.code")}</Label>
              <Input
                id="coupon-code"
                value={createForm.code}
                maxLength={40}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
                data-testid="input-coupon-code"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.coupons.fields.discountType")}</Label>
              <Select
                value={createForm.discountType}
                onValueChange={(value: DiscountType) =>
                  setCreateForm((prev) => ({ ...prev, discountType: value }))
                }
              >
                <SelectTrigger data-testid="select-coupon-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{t("digitalProductsManagement.coupons.discountTypes.percent")}</SelectItem>
                  <SelectItem value="fixed">{t("digitalProductsManagement.coupons.discountTypes.fixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createForm.discountType === "percent" ? (
              <div className="space-y-2">
                <Label htmlFor="coupon-percent">{t("digitalProductsManagement.coupons.fields.percentOff")}</Label>
                <Input
                  id="coupon-percent"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={createForm.percentOff}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, percentOff: e.target.value }))}
                  data-testid="input-coupon-percent"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="coupon-euros">{t("digitalProductsManagement.coupons.fields.amountEuros")}</Label>
                <Input
                  id="coupon-euros"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={createForm.euros}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, euros: e.target.value }))}
                  data-testid="input-coupon-euros"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.coupons.fields.scope")}</Label>
              <Select
                value={createForm.courseId}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, courseId: value }))}
              >
                <SelectTrigger data-testid="select-coupon-course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("digitalProductsManagement.coupons.scopeAll")}</SelectItem>
                  {paidCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-max">{t("digitalProductsManagement.coupons.fields.maxRedemptions")}</Label>
              <Input
                id="coupon-max"
                type="number"
                min={1}
                step={1}
                value={createForm.maxRedemptions}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, maxRedemptions: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-expires">{t("digitalProductsManagement.coupons.fields.expiresAt")}</Label>
              <Input
                id="coupon-expires"
                type="datetime-local"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={createForm.active}
                onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, active: checked }))}
                id="coupon-active"
              />
              <Label htmlFor="coupon-active">{t("digitalProductsManagement.coupons.fields.active")}</Label>
            </div>
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t("digitalProductsManagement.common.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={isCreating} data-testid="button-submit-coupon">
              {isCreating ? t("digitalProductsManagement.common.saving") : t("digitalProductsManagement.coupons.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCoupon} onOpenChange={(open) => { if (!open) setEditCoupon(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("digitalProductsManagement.coupons.editTitle")}</DialogTitle>
            <DialogDescription>
              {editCoupon
                ? t("digitalProductsManagement.coupons.editHint", { code: editCoupon.code })
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-coupon-max">{t("digitalProductsManagement.coupons.fields.maxRedemptions")}</Label>
              <Input
                id="edit-coupon-max"
                type="number"
                min={1}
                step={1}
                value={editMax}
                onChange={(e) => setEditMax(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-coupon-expires">{t("digitalProductsManagement.coupons.fields.expiresAt")}</Label>
              <Input
                id="edit-coupon-expires"
                type="datetime-local"
                value={editExpires}
                onChange={(e) => setEditExpires(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t("digitalProductsManagement.coupons.clearHint")}</p>
            {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditCoupon(null)}>
              {t("digitalProductsManagement.common.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
              {isSavingEdit ? t("digitalProductsManagement.common.saving") : t("digitalProductsManagement.common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateCoupon} onOpenChange={(open) => { if (!open) setDeactivateCoupon(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("digitalProductsManagement.coupons.deactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("digitalProductsManagement.coupons.deactivateConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("digitalProductsManagement.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()}>
              {t("digitalProductsManagement.coupons.deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
