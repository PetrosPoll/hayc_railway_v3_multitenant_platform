import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  customersStart: number;
  customersEnd: number;
  churnedCount: number;
  logoChurnPct: number | null;
  logoChurnT3mPct: number | null;
  mrrStartCents: number;
  mrrEndCents: number;
  grossMrrChurnPct: number | null;
  nrrPct: number | null;
  churnedVoluntary: number;
  churnedInvoluntary: number;
  involuntarySharePct: number | null;
  newMrrCents: number;
  reactivationMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  netNewMrrCents: number;
  newCustomers: number;
  reactivatedCustomers: number;
  churnByReason: Record<string, number>;
  churnByTenure: { "0-3": number; "4-12": number; "13+": number };
  smallSample: boolean;
};

type SeriesResponse = {
  from: string;
  to: string;
  plan: PlanFilter;
  series: MonthlyChurnMetrics[];
  kpiMonth: MonthlyChurnMetrics | null;
  prevMonth: MonthlyChurnMetrics | null;
  pendingSummary: { count: number; mrrAtRiskCents: number };
  dunningCount: number;
};

type PendingRow = {
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  mrrCents: number;
  accessUntil: string | null;
  daysLeft: number | null;
  reasonCode: string | null;
  subscriptionId: number;
};

type DunningRow = {
  customerId: number;
  email: string;
  username: string;
  mrrCents: number;
  failedSince: string | null;
  accessUntil: string | null;
  subscriptionId: number;
};

type ChurnedRow = {
  eventId: number;
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  tenureBucket: string;
  tenureMonths: number | null;
  mrrLostCents: number;
  churnKind: string | null;
  reasonCode: string | null;
  reasonNote: string | null;
  preLaunch: boolean | null;
  churnDate: string;
};

type ReactivationRow = {
  eventId: number;
  customerId: number;
  email: string;
  username: string;
  churnedOn: string | null;
  returnedOn: string;
  gapDays: number | null;
  mrrCents: number;
};

type CohortRow = {
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  mrrCents: number | null;
  status: string | null;
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

function deltaPct(
  current: number | null | undefined,
  prev: number | null | undefined,
): string {
  if (current == null || prev == null) return "—";
  const d = current - prev;
  const sign = d > 0 ? "+" : "";
  return `${sign}${formatPct(d).replace("%", "")} μ.β.`;
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
  const from = `${fy}-${String(fm).padStart(2, "0")}`;
  return { from, to };
}

type CohortMetric =
  | "customers_start"
  | "customers_end"
  | "logo_churn"
  | "involuntary"
  | "voluntary"
  | "pending_cancellations"
  | "in_dunning"
  | "reactivations";

function KpiCard({
  title,
  value,
  delta,
  t3m,
  formula,
  smallSample,
  onClick,
}: {
  title: string;
  value: string;
  delta: string;
  t3m?: string;
  formula: string;
  smallSample?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer transition-colors hover:bg-muted/40" : undefined}
      onClick={onClick}
    >
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="text-xs leading-snug">{title}</CardDescription>
          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{formula}</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        </div>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        <div>Δ vs προηγ.: {delta}</div>
        {t3m != null && <div>T3M: {t3m}</div>}
        {smallSample && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Μικρό δείγμα: δες τον μέσο όρο 3 μηνών
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminChurnDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const defaults = useMemo(() => defaultFromTo(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [includePartial, setIncludePartial] = useState(false);
  const [churnedMonth, setChurnedMonth] = useState(defaults.to);
  const [reasonMode, setReasonMode] = useState<"all" | "voluntary" | "involuntary">("all");
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortMetric, setCohortMetric] = useState<CohortMetric>("logo_churn");
  const [cohortTitle, setCohortTitle] = useState("");

  const seriesQuery = useQuery<SeriesResponse>({
    queryKey: ["/api/admin/churn/series", from, to, plan, includePartial],
    queryFn: async () => {
      const params = new URLSearchParams({
        from,
        to,
        plan,
        includePartial: includePartial ? "1" : "0",
      });
      const res = await fetch(`/api/admin/churn/series?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Αποτυχία φόρτωσης σειράς");
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

  const dunningQuery = useQuery<{ rows: DunningRow[] }>({
    queryKey: ["/api/admin/churn/dunning"],
    queryFn: async () => {
      const res = await fetch("/api/admin/churn/dunning", { credentials: "include" });
      if (!res.ok) throw new Error("Αποτυχία dunning");
      return res.json();
    },
  });

  const churnedQuery = useQuery<{ rows: ChurnedRow[]; month: string }>({
    queryKey: ["/api/admin/churn/churned", churnedMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/churn/churned?month=${encodeURIComponent(churnedMonth)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Αποτυχία churned");
      return res.json();
    },
  });

  const reactivationsQuery = useQuery<{ rows: ReactivationRow[] }>({
    queryKey: ["/api/admin/churn/reactivations", churnedMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/churn/reactivations?month=${encodeURIComponent(churnedMonth)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Αποτυχία επανενεργοποιήσεων");
      return res.json();
    },
  });

  const cohortQuery = useQuery<{ rows: CohortRow[] }>({
    queryKey: ["/api/admin/churn/cohort", churnedMonth, cohortMetric, plan],
    enabled: cohortOpen,
    queryFn: async () => {
      const params = new URLSearchParams({
        month: churnedMonth,
        metric: cohortMetric,
        plan,
      });
      const res = await fetch(`/api/admin/churn/cohort?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Αποτυχία cohort");
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
  const prev = seriesQuery.data?.prevMonth ?? null;
  const series = seriesQuery.data?.series ?? [];

  const logoChart = series.map((m) => ({
    month: formatMonthLabel(m.month),
    ym: m.month,
    logo: m.logoChurnPct ?? 0,
    t3m: m.logoChurnT3mPct ?? 0,
    partial: m.isPartial,
  }));

  const mrrChart = series.map((m) => ({
    month: formatMonthLabel(m.month),
    new: m.newMrrCents / 100,
    reactivation: m.reactivationMrrCents / 100,
    expansion: m.expansionMrrCents / 100,
    contraction: Math.abs(m.contractionMrrCents) / 100,
    churn: Math.abs(m.churnedMrrCents) / 100,
    net: m.netNewMrrCents / 100,
  }));

  const reasonKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of series) {
      Object.keys(m.churnByReason || {}).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [series]);

  const reasonChart = series.map((m) => {
    const row: Record<string, string | number> = {
      month: formatMonthLabel(m.month),
    };
    for (const k of reasonKeys) {
      const count = m.churnByReason?.[k] ?? 0;
      if (reasonMode === "voluntary" && k === "payment_failed") {
        row[k] = 0;
      } else if (reasonMode === "involuntary" && k !== "payment_failed") {
        row[k] = 0;
      } else {
        row[k] = count;
      }
    }
    return row;
  });

  const tenureTotals = useMemo(() => {
    const t = { "0-3": 0, "4-12": 0, "13+": 0 };
    for (const m of series) {
      t["0-3"] += m.churnByTenure?.["0-3"] ?? 0;
      t["4-12"] += m.churnByTenure?.["4-12"] ?? 0;
      t["13+"] += m.churnByTenure?.["13+"] ?? 0;
    }
    return [
      { bucket: "0–3 μήνες", count: t["0-3"] },
      { bucket: "4–12 μήνες", count: t["4-12"] },
      { bucket: "13+ μήνες", count: t["13+"] },
    ];
  }, [series]);

  const reasonColors = [
    "#0f766e",
    "#b45309",
    "#1d4ed8",
    "#be123c",
    "#4338ca",
    "#15803d",
    "#a16207",
    "#7c3aed",
    "#0e7490",
    "#854d0e",
    "#64748b",
  ];

  function openCohort(metric: CohortMetric, title: string) {
    if (kpi?.month) setChurnedMonth(kpi.month);
    setCohortMetric(metric);
    setCohortTitle(title);
    setCohortOpen(true);
  }

  function exportChurnedCsv() {
    const rows = churnedQuery.data?.rows ?? [];
    const header = [
      "customerId",
      "email",
      "plan",
      "tenure",
      "mrrLost",
      "kind",
      "reason",
      "preLaunch",
      "churnDate",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.customerId,
          JSON.stringify(r.email),
          r.planTier ?? "",
          r.tenureBucket,
          (r.mrrLostCents / 100).toFixed(2),
          r.churnKind ?? "",
          r.reasonCode ?? "",
          r.preLaunch ? "1" : "0",
          r.churnDate,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `churned-${churnedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (seriesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Φόρτωση στατιστικών churn…
      </div>
    );
  }

  if (seriesQuery.isError) {
    return (
      <div className="text-sm text-destructive py-8">
        Αποτυχία φόρτωσης. Έλεγξε ότι το backfill έχει τρέξει.
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Στατιστικά Churn</h2>
          <p className="text-sm text-muted-foreground">
            Logo churn &amp; MRR από το event log (Europe/Athens). Κάθε νούμερο ανοίγει τη λίστα πελατών.
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
              <SelectTrigger className="w-[140px]">
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
            <Label htmlFor="partial-month" className="text-xs max-w-[160px] leading-snug">
              Συμπερίληψη τρέχοντος μήνα (μερικός)
            </Label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Logo churn %"
          value={formatPct(kpi?.logoChurnPct)}
          delta={deltaPct(kpi?.logoChurnPct, prev?.logoChurnPct)}
          t3m={formatPct(kpi?.logoChurnT3mPct)}
          formula="churned_count / customers_start — ενεργοί στην αρχή του μήνα που έγιναν churned στο τέλος."
          smallSample={kpi?.smallSample}
          onClick={() => openCohort("logo_churn", "Churned πελάτες (logo)")}
        />
        <KpiCard
          title="Gross MRR churn %"
          value={formatPct(kpi?.grossMrrChurnPct)}
          delta={deltaPct(kpi?.grossMrrChurnPct, prev?.grossMrrChurnPct)}
          formula="sum(max(mrr_start − mrr_end, 0)) / mrr_start στο cohort — churn + contraction."
          smallSample={kpi?.smallSample}
          onClick={() => openCohort("logo_churn", "MRR churn cohort")}
        />
        <KpiCard
          title="NRR %"
          value={formatPct(kpi?.nrrPct)}
          delta={deltaPct(kpi?.nrrPct, prev?.nrrPct)}
          formula="sum(mrr_end) / mrr_start στο cohort — περιλαμβάνει expansion."
          smallSample={kpi?.smallSample}
          onClick={() => openCohort("customers_start", "Cohort στην αρχή του μήνα")}
        />
        <KpiCard
          title="Ενεργοί πελάτες"
          value={
            kpi
              ? `${kpi.customersStart} → ${kpi.customersEnd}`
              : "—"
          }
          delta={
            kpi && prev
              ? `${prev.customersStart} → ${prev.customersEnd}`
              : "—"
          }
          formula="customers_start / customers_end — ενεργοί στην αρχή και στο τέλος του μήνα."
          smallSample={kpi?.smallSample}
          onClick={() => openCohort("customers_start", "Ενεργοί στην αρχή")}
        />
        <KpiCard
          title="Εκκρεμείς ακυρώσεις"
          value={
            seriesQuery.data
              ? `${seriesQuery.data.pendingSummary.count} · ${formatEuro(seriesQuery.data.pendingSummary.mrrAtRiskCents)}`
              : "—"
          }
          delta="ζωντανά"
          formula="Ενεργοί με cancel_at_period_end — count + MRR at risk."
          onClick={() => openCohort("pending_cancellations", "Εκκρεμείς ακυρώσεις")}
        />
        <KpiCard
          title="Involuntary share %"
          value={formatPct(kpi?.involuntarySharePct)}
          delta={deltaPct(kpi?.involuntarySharePct, prev?.involuntarySharePct)}
          formula="churned_involuntary / churned_count."
          smallSample={kpi?.smallSample}
          onClick={() => openCohort("involuntary", "Involuntary churn")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Εκκρεμείς ακυρώσεις</CardTitle>
          <CardDescription>Ταξινομημένο κατά ημέρες μέχρι τη λήξη.</CardDescription>
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
                  <TableHead>Λόγος</TableHead>
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
                    <TableCell>
                      {r.reasonCode
                        ? REASON_LABELS[r.reasonCode] || r.reasonCode
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Μηνιαίο logo churn</CardTitle>
            <CardDescription>Μπάρες ανά μήνα + γραμμή T3M. Μερικός μήνας σε γκρι.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={logoChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="logo" name="Logo churn %" radius={[2, 2, 0, 0]}>
                  {logoChart.map((entry) => (
                    <Cell
                      key={entry.ym}
                      fill={entry.partial ? "#94a3b8" : "#0f766e"}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Κινήσεις MRR</CardTitle>
            <CardDescription>
              Νέο / επανενεργοποίηση / expansion (+) · contraction / churn (−) · net line
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mrrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="new" stackId="pos" fill="#15803d" name="Νέο" />
                <Bar
                  dataKey="reactivation"
                  stackId="pos"
                  fill="#0e7490"
                  name="Επανενεργοποίηση"
                />
                <Bar dataKey="expansion" stackId="pos" fill="#1d4ed8" name="Expansion" />
                <Bar dataKey="contraction" stackId="neg" fill="#b45309" name="Contraction" />
                <Bar dataKey="churn" stackId="neg" fill="#be123c" name="Churn" />
                <Line type="monotone" dataKey="net" name="Net MRR" stroke="#111827" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Churn ανά λόγο</CardTitle>
              <CardDescription>Stacked counts ανά μήνα</CardDescription>
            </div>
            <Select
              value={reasonMode}
              onValueChange={(v) => setReasonMode(v as typeof reasonMode)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                <SelectItem value="voluntary">Εθελοντικό</SelectItem>
                <SelectItem value="involuntary">Ακούσιο</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {reasonKeys.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="r"
                    fill={reasonColors[i % reasonColors.length]}
                    name={REASON_LABELS[k] || k}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Churn ανά tenure</CardTitle>
            <CardDescription>Άθροισμα στο επιλεγμένο εύρος</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenureTotals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Πελάτες" fill="#4338ca" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Σε dunning</CardTitle>
          <CardDescription>past_due συνδρομές (ζωντανά)</CardDescription>
        </CardHeader>
        <CardContent>
          {(dunningQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Κανείς σε dunning.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Αποτυχία από</TableHead>
                  <TableHead>Αναμενόμενη ακύρωση</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dunningQuery.data!.rows.map((r) => (
                  <TableRow key={r.subscriptionId}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-muted-foreground">#{r.customerId}</div>
                    </TableCell>
                    <TableCell>{formatEuro(r.mrrCents)}</TableCell>
                    <TableCell>{formatDate(r.failedSince)}</TableCell>
                    <TableCell>{formatDate(r.accessUntil)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Churned στον μήνα</CardTitle>
            <CardDescription>Επεξεργασία λόγου με audit log</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              className="w-[150px]"
              value={churnedMonth}
              onChange={(e) => setChurnedMonth(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={exportChurnedCsv}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(churnedQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Κανένα churn αυτόν τον μήνα.</p>
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
                  <TableRow key={r.eventId}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        #{r.customerId}
                        {r.preLaunch && (
                          <Badge variant="outline" className="text-[10px]">
                            pre-launch
                          </Badge>
                        )}
                      </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Επανενεργοποιήσεις</CardTitle>
          <CardDescription>Μήνας: {formatMonthLabel(churnedMonth)}</CardDescription>
        </CardHeader>
        <CardContent>
          {(reactivationsQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Καμία επανενεργοποίηση.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>Churned</TableHead>
                  <TableHead>Επιστροφή</TableHead>
                  <TableHead>Κενό (ημέρες)</TableHead>
                  <TableHead>MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reactivationsQuery.data!.rows.map((r) => (
                  <TableRow key={r.eventId}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-muted-foreground">#{r.customerId}</div>
                    </TableCell>
                    <TableCell>{formatDate(r.churnedOn)}</TableCell>
                    <TableCell>{formatDate(r.returnedOn)}</TableCell>
                    <TableCell>{r.gapDays ?? "—"}</TableCell>
                    <TableCell>{formatEuro(r.mrrCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={cohortOpen} onOpenChange={setCohortOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{cohortTitle}</DialogTitle>
            <DialogDescription>
              {formatMonthLabel(churnedMonth)} · πλάνο{" "}
              {plan === "all" ? "Όλα" : TIER_LABEL[plan] || plan}
            </DialogDescription>
          </DialogHeader>
          {cohortQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Φόρτωση…
            </div>
          ) : (cohortQuery.data?.rows?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Κανένας πελάτης.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Πλάνο</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortQuery.data!.rows.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell>{r.customerId}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      {r.planTier ? TIER_LABEL[r.planTier] || r.planTier : "—"}
                    </TableCell>
                    <TableCell>
                      {r.mrrCents != null ? formatEuro(r.mrrCents) : "—"}
                    </TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
