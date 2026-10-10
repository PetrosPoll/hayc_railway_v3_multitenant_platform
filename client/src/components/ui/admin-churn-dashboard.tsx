import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type PlanFilter = "all" | "basic" | "essential" | "pro";

type MonthlyChurnMetrics = {
  month: string;
  isPartial: boolean;
  isApproximate: boolean;
  customersStart: number;
  customersEnd: number;
  churnedCount: number;
  logoChurnPct: number | null;
  logoChurnT3mPct: number | null;
  smallSample: boolean;
};

type SeriesResponse = {
  from: string;
  to: string;
  plan: PlanFilter;
  eventsCutoverAt: string | null;
  series: MonthlyChurnMetrics[];
  kpiMonth: MonthlyChurnMetrics | null;
  prevMonth: MonthlyChurnMetrics | null;
  period?: {
    from: string;
    to: string;
    distinctChurned: number;
    mrrLostCents: number;
    isApproximate: boolean;
  };
  pendingSummary: { count: number; mrrAtRiskCents: number };
  live?: {
    activeCustomers: number;
    mrrCents: number;
    arpaCents: number;
    activeFromSubscriptions: number;
  };
};

type PendingRow = {
  customerId: number;
  email: string;
  planTier: string | null;
  mrrCents: number;
  accessUntil: string | null;
  daysLeft: number | null;
  reasonCode: string | null;
  subscriptionId: number;
};

type ChurnedRow = {
  eventId: number;
  customerId: number;
  email: string;
  planTier: string | null;
  tenureBucket: string;
  mrrLostCents: number;
  churnKind: string | null;
  reasonCode: string | null;
  reasonNote: string | null;
  churnDate: string;
};

const REASON_LABELS: Record<string, string> = {
  price: "Τιμή / κόστος",
  not_using: "Δεν το χρησιμοποιεί",
  closed_business: "Έκλεισε η επιχείρηση",
  switched_competitor: "Άλλη λύση",
  diy: "Μόνος του",
  service_issue: "Εξυπηρέτηση",
  missing_feature: "Λείπει λειτουργία",
  payment_failed: "Αποτυχία πληρωμής",
  terminated_by_hayc: "Διακοπή HAYC",
  other: "Άλλο",
  unknown: "Άγνωστο",
};

const REASON_CODES = Object.keys(REASON_LABELS);

const TIER_LABEL: Record<string, string> = {
  basic: "€44",
  essential: "€49",
  pro: "€200",
};

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return (
    new Intl.NumberFormat("el-GR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + "%"
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR");
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("el-GR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function defaultFromTo(): { from: string; to: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const last = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const to = `${last.y}-${String(last.m).padStart(2, "0")}`;
  let fy = last.y;
  let fm = last.m - 11;
  while (fm <= 0) {
    fm += 12;
    fy -= 1;
  }
  return { from: `${fy}-${String(fm).padStart(2, "0")}`, to };
}

export function AdminChurnDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const defaults = useMemo(() => defaultFromTo(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [includePartial, setIncludePartial] = useState(false);
  const [includeApproximate, setIncludeApproximate] = useState(true);

  const seriesQuery = useQuery<SeriesResponse>({
    queryKey: [
      "/api/admin/churn/series",
      from,
      to,
      plan,
      includePartial,
      includeApproximate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        from,
        to,
        plan,
        includePartial: includePartial ? "1" : "0",
        includeApproximate: includeApproximate ? "1" : "0",
      });
      const res = await fetch(`/api/admin/churn/series?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Αποτυχία φόρτωσης");
      return res.json();
    },
  });

  const pendingQuery = useQuery<{ rows: PendingRow[] }>({
    queryKey: ["/api/admin/churn/pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/churn/pending", { credentials: "include" });
      if (!res.ok) throw new Error("Αποτυχία εκκρεμών");
      return res.json();
    },
  });

  const churnedQuery = useQuery<{ rows: ChurnedRow[] }>({
    queryKey: ["/api/admin/churn/churned", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/churn/churned?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Αποτυχία λίστας");
      return res.json();
    },
  });

  const updateReason = useMutation({
    mutationFn: async (input: {
      eventId: number;
      reasonCode: string;
      reasonNote: string | null;
    }) => {
      const res = await fetch(`/api/admin/churn/events/${input.eventId}/reason`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Αποτυχία ενημέρωσης");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/churn/churned"] });
      toast({ title: "Αποθηκεύτηκε ο λόγος" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Σφάλμα", description: e.message });
    },
  });

  const kpi = seriesQuery.data?.kpiMonth ?? null;
  const series = seriesQuery.data?.series ?? [];
  const period = seriesQuery.data?.period;

  const logoChart = series.map((m) => ({
    month: formatMonthLabel(m.month),
    ym: m.month,
    logo: m.logoChurnPct ?? 0,
    t3m: m.logoChurnT3mPct ?? 0,
    approximate: m.isApproximate,
    partial: m.isPartial,
  }));

  function exportChurnedCsv() {
    const rows = churnedQuery.data?.rows ?? [];
    const lines = [
      ["customerId", "email", "plan", "mrrLost", "reason", "churnDate"].join(","),
      ...rows.map((r) =>
        [
          r.customerId,
          JSON.stringify(r.email),
          r.planTier ?? "",
          (r.mrrLostCents / 100).toFixed(2),
          r.reasonCode ?? "",
          r.churnDate,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `churned-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (seriesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Φόρτωση churn…
      </div>
    );
  }

  if (seriesQuery.isError) {
    return (
      <div className="text-sm text-destructive py-8">Αποτυχία φόρτωσης στατιστικών.</div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Churn πελατών</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Πόσοι πελάτες έφυγαν στην περίοδο που διάλεξες. Μετράμε όταν τελειώνει η πρόσβαση,
            όχι όταν πατάνε cancel.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Από</Label>
            <Input
              type="month"
              className="w-[150px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Έως</Label>
            <Input
              type="month"
              className="w-[150px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Πλάνο</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                <SelectItem value="basic">€44</SelectItem>
                <SelectItem value="essential">€49</SelectItem>
                <SelectItem value="pro">€200</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="partial-month"
              checked={includePartial}
              onCheckedChange={setIncludePartial}
            />
            <Label htmlFor="partial-month" className="text-xs">
              Τρέχων μήνας
            </Label>
          </div>
        </div>
      </div>

      {period?.isApproximate && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Τα δεδομένα πριν τις{" "}
          <strong>
            {seriesQuery.data?.eventsCutoverAt
              ? formatDate(seriesQuery.data.eventsCutoverAt)
              : "cutover"}
          </strong>{" "}
          είναι <strong>προσεγγιστικά</strong> (ανακατασκευή από παλιές συνδρομές). Χρήσιμα για
          τάση, όχι για ακριβές %. Από το cutover και μετά μετράμε σωστά από Stripe webhooks.
        </div>
      )}

      {seriesQuery.data?.live && (
        <Card>
          <CardContent className="py-4 flex flex-wrap gap-8 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Ζωντανά τώρα</div>
              <div className="text-lg font-semibold tabular-nums">
                {seriesQuery.data.live.activeCustomers} ενεργοί ·{" "}
                {formatEuro(seriesQuery.data.live.mrrCents)} MRR
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Εκκρεμείς ακυρώσεις</div>
              <div className="text-lg font-semibold tabular-nums">
                {seriesQuery.data.pendingSummary.count} ·{" "}
                {formatEuro(seriesQuery.data.pendingSummary.mrrAtRiskCents)} at risk
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardDescription>Έφυγαν στην περίοδο</CardDescription>
              {period?.isApproximate && (
                <Badge variant="secondary" className="text-[10px]">
                  προσεγγιστικό
                </Badge>
              )}
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {period?.distinctChurned ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div>
              {formatMonthLabel(from)} → {formatMonthLabel(to)}
            </div>
            <div>
              MRR lost (άθροισμα):{" "}
              {period ? formatEuro(period.mrrLostCents) : "—"}
            </div>
            <p>Μοναδικοί πελάτες που έχασαν όλα τα πλάνα στην περίοδο.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardDescription>Churn % τελευταίου μήνα</CardDescription>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Από τους ενεργούς στην αρχή του μήνα, πόσοι % έφυγαν μέχρι το τέλος.
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {kpi ? formatPct(kpi.logoChurnPct) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            {kpi ? (
              <>
                <div className="flex items-center gap-2">
                  {formatMonthLabel(kpi.month)}: {kpi.churnedCount}/{kpi.customersStart}
                  {kpi.isApproximate && (
                    <Badge variant="secondary" className="text-[10px]">
                      προσεγγιστικό
                    </Badge>
                  )}
                </div>
                {kpi.smallSample && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Μικρό δείγμα
                  </Badge>
                )}
              </>
            ) : (
              <p>Δεν υπάρχει μήνας με δεδομένα στο εύρος.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>At risk τώρα</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {seriesQuery.data?.pendingSummary.count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Πάτησαν cancel· η πρόσβαση δεν έχει τελειώσει ακόμα.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Εκκρεμείς ακυρώσεις</CardTitle>
          <CardDescription>Θα γίνουν churn όταν λήξει η περίοδος.</CardDescription>
        </CardHeader>
        <CardContent>
          {(pendingQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Καμία εκκρεμής ακύρωση.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>Πλάνο</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Λήξη</TableHead>
                  <TableHead>Ημέρες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingQuery.data!.rows.map((r) => (
                  <TableRow key={r.subscriptionId}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-muted-foreground">#{r.customerId}</div>
                    </TableCell>
                    <TableCell>
                      {r.planTier ? TIER_LABEL[r.planTier] || r.planTier : "—"}
                    </TableCell>
                    <TableCell>{formatEuro(r.mrrCents)}</TableCell>
                    <TableCell>{formatDate(r.accessUntil)}</TableCell>
                    <TableCell>{r.daysLeft ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Churn % ανά μήνα</CardTitle>
          <CardDescription>
            Γκρι μπάρα = προσεγγιστικό ιστορικό. Πράσινη = μετά το cutover (αξιόπιστο).
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {logoChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Δεν υπάρχουν μήνες με δεδομένα στο εύρος.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={logoChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="logo" name="Churn %" radius={[2, 2, 0, 0]}>
                  {logoChart.map((entry) => (
                    <Cell
                      key={entry.ym}
                      fill={
                        entry.approximate || entry.partial ? "#94a3b8" : "#0f766e"
                      }
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="t3m"
                  name="T3M %"
                  stroke="#b45309"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ποιοι έφυγαν στην περίοδο</CardTitle>
            <CardDescription>
              {formatMonthLabel(from)} → {formatMonthLabel(to)} · ένας πελάτης = μία γραμμή
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportChurnedCsv}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          {churnedQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Φόρτωση…
            </div>
          ) : (churnedQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Κανένας churn σε αυτή την περίοδο.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>Πλάνο</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>MRR lost</TableHead>
                  <TableHead>Είδος</TableHead>
                  <TableHead>Λόγος</TableHead>
                  <TableHead>Ημ/νία</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churnedQuery.data!.rows.map((r) => (
                  <TableRow key={`${r.customerId}-${r.eventId}`}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-muted-foreground">#{r.customerId}</div>
                    </TableCell>
                    <TableCell>
                      {r.planTier ? TIER_LABEL[r.planTier] || r.planTier : "—"}
                    </TableCell>
                    <TableCell>{r.tenureBucket}</TableCell>
                    <TableCell>{formatEuro(r.mrrLostCents)}</TableCell>
                    <TableCell>
                      {r.churnKind === "involuntary" ? "Ακούσιο" : "Εθελοντικό"}
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={r.reasonCode || "unknown"}
                        onValueChange={(code) =>
                          updateReason.mutate({
                            eventId: r.eventId,
                            reasonCode: code,
                            reasonNote: r.reasonNote,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REASON_CODES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {REASON_LABELS[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatDate(r.churnDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
