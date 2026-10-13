import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  AlertTriangle,
  ListOrdered,
  Check,
  X,
  Undo2,
  CalendarDays,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { toLocalDateKey, toObligationDateKey } from "@shared/billing-recurrence";

type CalendarEntry = {
  id: number;
  dueDate: string;
  status: string;
  statusLabel: string;
  statusGroup: string;
  urgency: number;
  origin: string;
  clientName: string;
  customerId: number | null;
  customerEmail: string | null;
  amountDueCents: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  currency: string;
  vatIncluded: boolean;
  riskFlags: string[];
  attemptCount: number | null;
  nextAttemptAt: string | null;
  assumedPaid: boolean;
  customPaymentId: number | null;
  subscriptionId: number | null;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
  notes: string | null;
};

type CalendarTotals = {
  collectedCents: number;
  expectedCents: number;
  outstandingCents: number;
  canceledCents?: number;
  lostCents?: number;
  monthTotalCents: number;
  atRiskCount: number;
  atRiskCents: number;
  vatIncluded: boolean;
};

type CalendarResponse = {
  from: string;
  to: string;
  entries: CalendarEntry[];
  totals: CalendarTotals;
  needsAction: CalendarEntry[];
};

function monthRange(d: Date): { from: string; to: string } {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toLocalDateKey(from), to: toLocalDateKey(to) };
}

function euros(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Display obligation due day matching calendar bucketing (Stripe = UTC day). */
function formatObligationDay(dueDate: string | Date, origin?: string | null) {
  const key = toObligationDateKey(dueDate, origin);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("el-GR");
}

function statusChipClass(status: string, risk: boolean) {
  if (["grace", "action_required", "retrying", "delinquent", "disputed"].includes(status)) {
    return "bg-amber-100 text-amber-900";
  }
  if (["settled", "partially_paid"].includes(status)) return "bg-emerald-100 text-emerald-900";
  if (["refunded", "partially_refunded"].includes(status)) {
    return "bg-rose-100 text-rose-900";
  }
  if (["written_off", "stopped"].includes(status)) {
    return "bg-rose-100 text-rose-900 line-through";
  }
  if (["will_not_renew", "paused"].includes(status)) {
    return "bg-gray-200 text-gray-700";
  }
  if (risk) return "bg-orange-100 text-orange-900";
  return "bg-blue-100 text-blue-900";
}

export function SubscriptionCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [originFilter, setOriginFilter] = useState<"all" | "stripe" | "custom">("all");
  const [groupFilter, setGroupFilter] = useState<"all" | "collected" | "expected" | "outstanding" | "canceled">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [settleEntry, setSettleEntry] = useState<CalendarEntry | null>(null);
  const [settleForm, setSettleForm] = useState({
    amount: "",
    method: "cash",
    paidAt: "",
    reference: "",
    note: "",
  });
  const [newPayment, setNewPayment] = useState({
    clientName: "",
    amount: "",
    startDate: "",
    frequency: "monthly",
    description: "",
    paymentType: "cash",
    userId: "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();
  const range = monthRange(currentMonth);

  const { data, isLoading, isError, error, refetch } = useQuery<CalendarResponse>({
    queryKey: ["/api/admin/billing-calendar", range.from, range.to],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/billing-calendar?from=${range.from}&to=${range.to}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Failed to load calendar (${res.status})`);
      }
      return res.json();
    },
  });

  const { data: usersData } = useQuery<{ users: { id: number; username: string; email: string }[] }>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return { users: [] };
      const json = await res.json();
      return { users: json.users || json || [] };
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["/api/admin/billing-calendar"] });
    await refetch();
  };

  const syncMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/sync-invoices", { mode: "last_2_months" }),
    onSuccess: async (res) => {
      const body = await res.json();
      toast({ title: "Sync complete", description: body.message });
      await invalidate();
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const addCustomMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/admin/custom-payments", {
        clientName: newPayment.clientName,
        amount: parseFloat(newPayment.amount),
        startDate: newPayment.startDate,
        frequency: newPayment.frequency,
        description: newPayment.description || undefined,
        paymentType: newPayment.paymentType,
        currency: "eur",
        userId: newPayment.userId ? parseInt(newPayment.userId) : undefined,
      }),
    onSuccess: () => {
      toast({ title: "Custom payment added" });
      setIsDialogOpen(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!settleEntry) return;
      return apiRequest("POST", `/api/admin/payment-obligations/${settleEntry.id}/settle`, {
        amountPaid: parseFloat(settleForm.amount || String(settleEntry.amountDueCents / 100)),
        paymentMethod: settleForm.method,
        paidAt: settleForm.paidAt || undefined,
        reference: settleForm.reference || undefined,
        notes: settleForm.note || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Πληρώθηκε" });
      setSettleEntry(null);
      invalidate();
    },
  });

  const unsettleMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("POST", `/api/admin/payment-obligations/${id}/unsettle`, {}),
    onSuccess: () => {
      toast({ title: "Επαναφορά σε απλήρωτο" });
      invalidate();
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("POST", `/api/admin/payment-obligations/${id}/write-off`, {
        notes: "Written off by admin",
      }),
    onSuccess: () => {
      toast({ title: "Write off" });
      invalidate();
    },
  });

  const stripePayMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("POST", `/api/admin/billing-calendar/obligations/${id}/pay-invoice`, {}),
    onSuccess: () => {
      toast({ title: "Stripe pay requested" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Pay failed", description: e.message, variant: "destructive" }),
  });

  const uncollectibleMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("POST", `/api/admin/billing-calendar/obligations/${id}/mark-uncollectible`, {}),
    onSuccess: () => {
      toast({ title: "Marked uncollectible (may auto-cancel subscription)" });
      invalidate();
    },
  });

  const entries = useMemo(() => {
    let list = data?.entries || [];
    if (originFilter !== "all") list = list.filter((e) => e.origin === originFilter);
    if (groupFilter !== "all") list = list.filter((e) => e.statusGroup === groupFilter);
    return list;
  }, [data, originFilter, groupFilter]);

  const selectedKey = selectedDate ? toLocalDateKey(selectedDate) : null;
  const dayEntries = entries.filter(
    (e) => e.dueDate && toObligationDateKey(e.dueDate, e.origin) === selectedKey,
  );

  /** Day color priority: any entry marks the day (incl. canceled / paused). */
  const dayUrgency = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.dueDate) continue;
      // Stripe days use UTC so they match Stripe Dashboard (not Athens shift).
      const key = toObligationDateKey(e.dueDate, e.origin);
      let p = e.urgency || 0;
      if (p <= 0) {
        if (e.statusGroup === "canceled") p = 5;
        else if (e.statusGroup === "collected") p = 10;
        else if (e.statusGroup === "expected") p = 20;
        else if (e.statusGroup === "outstanding") p = 40;
        else p = 3; // paused / other — still show a mark
      }
      map.set(key, Math.max(map.get(key) || 0, p));
    }
    return map;
  }, [entries]);

  const outstandingDates: Date[] = [];
  const riskDates: Date[] = [];
  const expectedDates: Date[] = [];
  const collectedDates: Date[] = [];
  const canceledDates: Date[] = [];
  Array.from(dayUrgency.entries()).forEach(([key, urg]) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (urg >= 40) outstandingDates.push(dt);
    else if (urg >= 30) riskDates.push(dt);
    else if (urg >= 20) expectedDates.push(dt);
    else if (urg >= 10) collectedDates.push(dt);
    else if (urg >= 3) canceledDates.push(dt);
  });

  const totals = data?.totals;
  const monthLabel = currentMonth.toLocaleDateString("el-GR", {
    month: "long",
    year: "numeric",
  });
  const navigateMonth = (dir: "prev" | "next") => {
    const n = new Date(currentMonth);
    n.setMonth(n.getMonth() + (dir === "next" ? 1 : -1));
    setCurrentMonth(n);
    setSelectedDate(n);
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  return (
    <div className="space-y-4">
      {isError && (
        <div className="p-3 rounded border border-rose-300 bg-rose-50 text-rose-900 text-sm">
          Αποτυχία φόρτωσης calendar: {(error as Error)?.message || "unknown error"}
        </div>
      )}
      {!isLoading && !isError && (data?.entries?.length ?? 0) === 0 && (
        <div className="p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          Δεν υπάρχουν εγγραφές για {monthLabel} ({range.from} → {range.to}). Πάτα Sync για να
          τραβήξεις παλιές πληρωμές και upcoming.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
          <p className="font-semibold text-emerald-800">Εισπράχθηκαν</p>
          <p className="text-[11px] text-emerald-700/80 capitalize">{monthLabel}</p>
          <p className="text-lg font-bold text-emerald-700">€{euros(totals?.collectedCents || 0)}</p>
        </div>
        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
          <p className="font-semibold text-blue-800">Upcoming</p>
          <p className="text-[11px] text-blue-700/80">να πληρωθούν · <span className="capitalize">{monthLabel}</span></p>
          <p className="text-lg font-bold text-blue-700">€{euros(totals?.expectedCents || 0)}</p>
          {(totals?.atRiskCount || 0) > 0 && (
            <p className="text-orange-700">σε κίνδυνο: {totals!.atRiskCount} (€{euros(totals!.atRiskCents)})</p>
          )}
        </div>
        <div className="p-2 bg-amber-50 border border-amber-200 rounded">
          <p className="font-semibold text-amber-800">Εκκρεμούν / Overdue</p>
          <p className="text-[11px] text-amber-700/80 capitalize">{monthLabel}</p>
          <p className="text-lg font-bold text-amber-700">€{euros(totals?.outstandingCents || 0)}</p>
        </div>
        <div className="p-2 bg-rose-50 border border-rose-200 rounded">
          <p className="font-semibold text-rose-800">Ακυρωμένα</p>
          <p className="text-[11px] text-rose-700/80 capitalize">{monthLabel}</p>
          <p className="text-lg font-bold text-rose-700">
            €{euros(totals?.canceledCents ?? totals?.lostCents ?? 0)}
          </p>
        </div>
        <div className="p-2 bg-indigo-50 border border-indigo-200 rounded">
          <p className="font-semibold text-indigo-800">Προβολή τζίρου</p>
          <p className="text-[11px] text-indigo-700/80">αν πληρωθούν όλα · <span className="capitalize">{monthLabel}</span></p>
          <p className="text-lg font-bold text-indigo-700">€{euros(totals?.monthTotalCents || 0)}</p>
          <p className="text-indigo-700/70">εισπραχθέντα + upcoming + overdue · συμπ. ΦΠΑ</p>
        </div>
      </div>

      <div className="grid grid-cols-[auto,1fr] gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[160px] text-center">
              {currentMonth.toLocaleDateString("el-GR", { month: "long", year: "numeric" })}
            </h3>
            <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <TooltipProvider>
            <div className="flex gap-1 justify-center">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Προσθήκη offline πληρωμής</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Custom recurring payment</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label>Client name</Label>
                      <Input
                        value={newPayment.clientName}
                        onChange={(e) => setNewPayment((p) => ({ ...p, clientName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Customer (optional)</Label>
                      <Select
                        value={newPayment.userId || "none"}
                        onValueChange={(v) =>
                          setNewPayment((p) => ({ ...p, userId: v === "none" ? "" : v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Free-text only —</SelectItem>
                          {(usersData?.users || []).slice(0, 200).map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.username || u.email} (#{u.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (€)</Label>
                      <Input
                        type="number"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Start date</Label>
                      <Input
                        type="date"
                        value={newPayment.startDate}
                        onChange={(e) => setNewPayment((p) => ({ ...p, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Frequency</Label>
                      <Select
                        value={newPayment.frequency}
                        onValueChange={(v) => setNewPayment((p) => ({ ...p, frequency: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Payment type</Label>
                      <Select
                        value={newPayment.paymentType}
                        onValueChange={(v) => setNewPayment((p) => ({ ...p, paymentType: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank-transfer">Bank transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={newPayment.description}
                        onChange={(e) =>
                          setNewPayment((p) => ({ ...p, description: e.target.value }))
                        }
                      />
                    </div>
                    <Button onClick={() => addCustomMutation.mutate()}>Add</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={syncMutation.isPending}
                    onClick={() => syncMutation.mutate()}
                  >
                    <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sync / reconcile Stripe</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 gap-1"
                    onClick={goToToday}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span className="text-xs">Σήμερα</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Τρέχων μήνας / σημερινή ημερομηνία</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            modifiers={{
              outstanding: outstandingDates,
              risk: riskDates,
              expected: expectedDates,
              collected: collectedDates,
              canceled: canceledDates,
            }}
            modifiersClassNames={{
              outstanding:
                "rounded-full font-bold [&:not([aria-selected='true'])]:bg-amber-500 [&:not([aria-selected='true'])]:text-white",
              risk:
                "rounded-full font-bold [&:not([aria-selected='true'])]:bg-orange-500 [&:not([aria-selected='true'])]:text-white",
              expected:
                "rounded-full font-bold [&:not([aria-selected='true'])]:bg-blue-500 [&:not([aria-selected='true'])]:text-white",
              collected:
                "rounded-full font-bold [&:not([aria-selected='true'])]:bg-emerald-500 [&:not([aria-selected='true'])]:text-white",
              canceled:
                "rounded-full font-bold [&:not([aria-selected='true'])]:bg-rose-400 [&:not([aria-selected='true'])]:text-white",
            }}
            className="rounded-md border shadow"
          />
          <div className="text-xs space-y-1 px-1">
            <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Εκκρεμούν / Overdue</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" />Σε κίνδυνο</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Upcoming</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Εισπράχθηκαν</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1" />Ακυρωμένα</p>
          </div>

          <div className="flex gap-2">
            <Select value={originFilter} onValueChange={(v: any) => setOriginFilter(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="custom">Offline</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(v: any) => setGroupFilter(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα status</SelectItem>
                <SelectItem value="collected">Εισπράχθηκαν</SelectItem>
                <SelectItem value="expected">Upcoming</SelectItem>
                <SelectItem value="outstanding">Εκκρεμούν / Overdue</SelectItem>
                <SelectItem value="canceled">Ακυρωμένα</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? `Πληρωμές ${selectedDate.toLocaleDateString("el-GR")}`
                : "Επιλέξτε ημέρα"}
              {isLoading ? "…" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayEntries.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Καμία εγγραφή αυτή την ημέρα.</p>
            )}
            {dayEntries.map((e) => (
              <div
                key={e.id}
                className={`p-3 rounded-lg border-l-4 ${
                  e.statusGroup === "outstanding"
                    ? "border-amber-500 bg-amber-50"
                    : e.statusGroup === "collected"
                      ? "border-emerald-500 bg-emerald-50"
                      : e.statusGroup === "canceled"
                        ? "border-rose-500 bg-rose-50 opacity-80"
                        : e.status === "will_not_renew"
                          ? "border-slate-400 bg-slate-50"
                          : "border-blue-500 bg-blue-50"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{e.clientName}</p>
                    <p className="text-sm text-muted-foreground">{e.customerEmail}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200">
                        {e.origin === "stripe" ? "Stripe" : "Offline"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusChipClass(e.status, e.riskFlags.length > 0)}`}>
                        {e.statusLabel}
                      </span>
                      {e.assumedPaid && (
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                          Υποτίθεται πληρωμένο
                        </span>
                      )}
                      {e.riskFlags.map((f) => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                          {f}
                        </span>
                      ))}
                    </div>
                    {e.attemptCount ? (
                      <p className="text-xs mt-1 text-purple-700">
                        Attempt {e.attemptCount}
                        {e.nextAttemptAt
                          ? ` · next ${new Date(e.nextAttemptAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{euros(e.amountDueCents)}</p>
                    <div className="flex flex-col gap-1 mt-2 items-end">
                      {e.origin === "custom" &&
                        ["pending", "grace", "delinquent", "upcoming"].includes(e.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700"
                            onClick={() => {
                              setSettleEntry(e);
                              setSettleForm({
                                amount: String(e.amountDueCents / 100),
                                method: "cash",
                                paidAt: toLocalDateKey(new Date()),
                                reference: "",
                                note: "",
                              });
                            }}
                          >
                            <Check className="w-3 h-3 mr-1" /> Πληρώθηκε
                          </Button>
                        )}
                      {e.origin === "custom" && e.status === "settled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unsettleMutation.mutate(e.id)}
                        >
                          <Undo2 className="w-3 h-3 mr-1" /> Δεν πληρώθηκε
                        </Button>
                      )}
                      {e.origin === "custom" &&
                        ["grace", "delinquent"].includes(e.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => writeOffMutation.mutate(e.id)}
                          >
                            <X className="w-3 h-3 mr-1" /> Write off
                          </Button>
                        )}
                      {e.origin === "stripe" &&
                        ["retrying", "delinquent", "action_required"].includes(e.status) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm("Charge Stripe invoice now?")) {
                                  stripePayMutation.mutate(e.id);
                                }
                              }}
                            >
                              Επανάληψη χρέωσης
                            </Button>
                            {e.status === "delinquent" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Mark uncollectible? This auto-cancels the Stripe subscription.",
                                    )
                                  ) {
                                    uncollectibleMutation.mutate(e.id);
                                  }
                                }}
                              >
                                Mark uncollectible
                              </Button>
                            )}
                          </>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(data?.needsAction?.length || 0) > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              Χρειάζεται ενέργεια ({data!.needsAction.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {data!.needsAction.slice(0, 30).map((e) => (
              <div key={e.id} className="flex justify-between text-sm border-b py-2">
                <span>
                  {e.clientName} · {e.statusLabel}
                  {e.riskFlags.length ? ` · ${e.riskFlags.join(",")}` : ""}
                </span>
                <span className="font-medium">
                  {e.dueDate ? formatObligationDay(e.dueDate, e.origin) : ""} · €
                  {euros(e.amountDueCents)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!settleEntry} onOpenChange={(o) => !o && setSettleEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Σήμανση ως πληρωμένο</AlertDialogTitle>
            <AlertDialogDescription>
              {settleEntry?.clientName} — €{euros(settleEntry?.amountDueCents || 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <div>
              <Label>Amount (€)</Label>
              <Input
                type="number"
                value={settleForm.amount}
                onChange={(e) => setSettleForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={settleForm.method}
                onValueChange={(v) => setSettleForm((f) => ({ ...f, method: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank-transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid date</Label>
              <Input
                type="date"
                value={settleForm.paidAt}
                onChange={(e) => setSettleForm((f) => ({ ...f, paidAt: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={settleForm.reference}
                onChange={(e) => setSettleForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input
                value={settleForm.note}
                onChange={(e) => setSettleForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => settleMutation.mutate()}>Mark paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
