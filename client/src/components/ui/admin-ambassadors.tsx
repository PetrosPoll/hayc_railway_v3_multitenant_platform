import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Ambassador = {
  id: number;
  name: string;
  email: string | null;
  notes: string | null;
  active: boolean;
};

type PromoCodeRow = {
  id: number;
  ambassadorId: number;
  ambassadorName: string;
  code: string;
  discountType: string;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  active: boolean;
  label?: string;
};

type Stats = {
  redemptions: number;
  uniqueUsers: number;
  revenueCents: number;
  revenueEuros: number;
  transactionCount: number;
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return response.json();
}

export default function AdminAmbassadors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ambassadorName, setAmbassadorName] = useState("");
  const [ambassadorEmail, setAmbassadorEmail] = useState("");
  const [ambassadorNotes, setAmbassadorNotes] = useState("");

  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string>("");
  const [promoCode, setPromoCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [percentOff, setPercentOff] = useState("20");
  const [amountOffEuros, setAmountOffEuros] = useState("10");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationInMonths, setDurationInMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");

  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const [statsTarget, setStatsTarget] = useState<{
    type: "ambassador" | "promo";
    id: number;
    label: string;
  } | null>(null);

  const { data: ambassadors = [], isLoading: loadingAmbassadors } = useQuery<
    Ambassador[]
  >({
    queryKey: ["/api/admin/ambassadors"],
    queryFn: () => apiJson("/api/admin/ambassadors"),
  });

  const { data: promoCodes = [], isLoading: loadingCodes } = useQuery<
    PromoCodeRow[]
  >({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => apiJson("/api/admin/promo-codes"),
  });

  const statsQueryKey = useMemo(() => {
    if (!statsTarget) return null;
    const base =
      statsTarget.type === "ambassador"
        ? `/api/admin/ambassadors/${statsTarget.id}/stats`
        : `/api/admin/promo-codes/${statsTarget.id}/stats`;
    const params = new URLSearchParams();
    if (statsFrom) params.set("from", new Date(statsFrom).toISOString());
    if (statsTo) params.set("to", new Date(statsTo).toISOString());
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [statsTarget, statsFrom, statsTo]);

  const { data: stats, isFetching: loadingStats } = useQuery<Stats>({
    queryKey: [statsQueryKey],
    queryFn: () => apiJson(statsQueryKey!),
    enabled: !!statsQueryKey,
  });

  const createAmbassador = useMutation({
    mutationFn: () =>
      apiJson("/api/admin/ambassadors", {
        method: "POST",
        body: JSON.stringify({
          name: ambassadorName,
          email: ambassadorEmail || null,
          notes: ambassadorNotes || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ambassadors"] });
      setAmbassadorName("");
      setAmbassadorEmail("");
      setAmbassadorNotes("");
      toast({ title: "Ambassador created" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createPromo = useMutation({
    mutationFn: () =>
      apiJson("/api/admin/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          ambassadorId: Number(selectedAmbassadorId),
          code: promoCode,
          ...(discountType === "percent"
            ? { percentOff: Number(percentOff) }
            : { amountOff: Math.round(Number(amountOffEuros) * 100) }),
          duration,
          durationInMonths:
            duration === "repeating" ? Number(durationInMonths) : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoCode("");
      setMaxRedemptions("");
      toast({ title: "Promo code created in Stripe + local DB" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const togglePromo = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiJson(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleAmbassador = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiJson(`/api/admin/ambassadors/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ambassadors"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Ambassadors & promo codes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create ambassadors, issue Stripe promotion codes, and track attributed
          signups and revenue.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New ambassador</CardTitle>
            <CardDescription>Who will promote Hayc with a code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="amb-name">Name</Label>
              <Input
                id="amb-name"
                value={ambassadorName}
                onChange={(e) => setAmbassadorName(e.target.value)}
                placeholder="Nikos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amb-email">Email (optional)</Label>
              <Input
                id="amb-email"
                type="email"
                value={ambassadorEmail}
                onChange={(e) => setAmbassadorEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amb-notes">Notes</Label>
              <Input
                id="amb-notes"
                value={ambassadorNotes}
                onChange={(e) => setAmbassadorNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={() => createAmbassador.mutate()}
              disabled={!ambassadorName.trim() || createAmbassador.isPending}
            >
              {createAmbassador.isPending ? "Saving..." : "Create ambassador"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New promo code</CardTitle>
            <CardDescription>
              Creates a Stripe Coupon + Promotion Code (discount on hosting plan
              only — not setup fee or add-ons) and stores attribution locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ambassador</Label>
              <Select
                value={selectedAmbassadorId}
                onValueChange={setSelectedAmbassadorId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ambassador" />
                </SelectTrigger>
                <SelectContent>
                  {ambassadors.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                      {!a.active ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="AMBASSADOR_NIKOS"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount type</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                {discountType === "percent" ? (
                  <>
                    <Label htmlFor="percent-off">Percent off</Label>
                    <Input
                      id="percent-off"
                      type="number"
                      min={1}
                      max={100}
                      value={percentOff}
                      onChange={(e) => setPercentOff(e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <Label htmlFor="amount-off">Amount off (€)</Label>
                    <Input
                      id="amount-off"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={amountOffEuros}
                      onChange={(e) => setAmountOffEuros(e.target.value)}
                      placeholder="10"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(v) =>
                    setDuration(v as "once" | "repeating" | "forever")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">First invoice only</SelectItem>
                    <SelectItem value="repeating">Repeating months</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {duration === "repeating" && (
              <div className="space-y-1.5">
                <Label htmlFor="duration-months">Months</Label>
                <Input
                  id="duration-months"
                  type="number"
                  min={1}
                  value={durationInMonths}
                  onChange={(e) => setDurationInMonths(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="max-redemptions">Max redemptions (optional)</Label>
              <Input
                id="max-redemptions"
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <Button
              onClick={() => createPromo.mutate()}
              disabled={
                !selectedAmbassadorId ||
                promoCode.trim().length < 3 ||
                (discountType === "percent"
                  ? !percentOff || Number(percentOff) < 1 || Number(percentOff) > 100
                  : !amountOffEuros || Number(amountOffEuros) <= 0) ||
                createPromo.isPending
              }
            >
              {createPromo.isPending ? "Creating..." : "Create promo code"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ambassadors</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAmbassadors ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambassadors.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.email || "—"}</TableCell>
                    <TableCell>{a.active ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatsTarget({
                            type: "ambassador",
                            id: a.id,
                            label: a.name,
                          })
                        }
                      >
                        Stats
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          toggleAmbassador.mutate({
                            id: a.id,
                            active: !a.active,
                          })
                        }
                      >
                        {a.active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo codes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCodes ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.code}</TableCell>
                    <TableCell>{p.ambassadorName}</TableCell>
                    <TableCell>
                      {p.discountType === "fixed" && p.amountOff != null
                        ? `${(p.amountOff / 100).toFixed(2)}€`
                        : p.percentOff != null
                          ? `${p.percentOff}%`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {p.duration}
                      {p.duration === "repeating" && p.durationInMonths
                        ? ` (${p.durationInMonths} mo)`
                        : ""}
                    </TableCell>
                    <TableCell>{p.active ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatsTarget({
                            type: "promo",
                            id: p.id,
                            label: p.code,
                          })
                        }
                      >
                        Stats
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          togglePromo.mutate({ id: p.id, active: !p.active })
                        }
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {statsTarget && (
        <Card>
          <CardHeader>
            <CardTitle>Attribution: {statsTarget.label}</CardTitle>
            <CardDescription>
              Signups from this {statsTarget.type} and revenue from attributed
              customers in the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="stats-from">From</Label>
                <Input
                  id="stats-from"
                  type="date"
                  value={statsFrom}
                  onChange={(e) => setStatsFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stats-to">To</Label>
                <Input
                  id="stats-to"
                  type="date"
                  value={statsTo}
                  onChange={(e) => setStatsTo(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => setStatsTarget(null)}>
                Close
              </Button>
            </div>
            {loadingStats ? (
              <p className="text-sm text-muted-foreground">Loading stats...</p>
            ) : stats ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Signups</div>
                  <div className="text-2xl font-semibold">{stats.uniqueUsers}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Redemptions</div>
                  <div className="text-2xl font-semibold">{stats.redemptions}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">
                    Attributed revenue
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.revenueEuros.toFixed(2)}€
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.transactionCount} payments
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
