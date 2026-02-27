import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Plus, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, DollarSign, Check, X, CalendarDays, CalendarX, List, StopCircle, ListOrdered, Undo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Subscription, CustomPayment, PaymentObligation, PaymentSettlement } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StripePayment {
  id: string;
  type: 'stripe_invoice' | 'stripe_upcoming';
  clientName: string;
  email: string;
  amount: number;
  date: string;
  status: 'paid' | 'upcoming';
  tier?: string;
  invoiceUrl?: string;
}

const getNextBillingDate = (subscription: any) => {
  // Use the next billing date from Stripe's upcoming invoice if available
  if (subscription.nextBillingDate) {
    return new Date(subscription.nextBillingDate);
  }

  // Fallback: if Stripe data unavailable, estimate from creation date
  const date = new Date(subscription.createdAt);
  const billingPeriod = subscription.billingPeriod || 'monthly';

  if (billingPeriod === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setDate(date.getDate() + 30);
  }

  return date;
};

const getAllCustomPaymentDates = (payment: CustomPayment, startYear: number, startMonth: number, endYear: number, endMonth: number) => {
  const dates = [];
  const startDate = new Date(payment.startDate);
  const rangeStart = new Date(startYear, startMonth, 1);
  const rangeEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
  
  // Get excluded dates as a Set for O(1) lookup
  // Backend stores dates in YYYY-MM-DD format, so we just use them directly
  const excludedDatesSet = new Set((payment.excludedDates || []).map((d: string) => {
    // Handle both YYYY-MM-DD and ISO date strings
    if (d.includes('T')) {
      return d.split('T')[0]; // Extract just the date part from ISO string
    }
    return d; // Already in YYYY-MM-DD format
  }));
  
  let currentDate = new Date(startDate);
  
  // Generate all payment dates from start date to range end
  while (currentDate <= rangeEnd) {
    // Only include if within our query range
    if (currentDate >= rangeStart && currentDate <= rangeEnd) {
      // Check if this date is excluded - use local date for consistency
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      if (!excludedDatesSet.has(dateKey)) {
        dates.push({
          date: new Date(currentDate),
          isPast: currentDate < new Date()
        });
      }
    }
    
    // Move to next payment date
    if (payment.frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (payment.frequency === 'yearly') {
      currentDate.setFullYear(currentDate.getFullYear() + 1);
    } else if (payment.frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }
  
  return dates;
};

export function SubscriptionCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    clientName: '',
    amount: '',
    startDate: '',
    frequency: 'monthly' as const,
    description: '',
    paymentType: 'cash' as const
  });
  
  // Confirmation dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; payment: any | null }>({ open: false, payment: null });
  const [unpaidDialog, setUnpaidDialog] = useState<{ open: boolean; payment: any | null }>({ open: false, payment: null });
  const [writeOffDialog, setWriteOffDialog] = useState<{ open: boolean; obligation: any | null }>({ open: false, obligation: null });
  const [settleDialog, setSettleDialog] = useState<{ open: boolean; obligation: any | null }>({ open: false, obligation: null });
  const [unsettleDialog, setUnsettleDialog] = useState<{ open: boolean; obligation: any | null }>({ open: false, obligation: null });
  const [stopDialog, setStopDialog] = useState<{ open: boolean; payment: any | null }>({ open: false, payment: null });
  const [excludeDateDialog, setExcludeDateDialog] = useState<{ open: boolean; payment: any | null; date: Date | null }>({ open: false, payment: null, date: null });
  const [outstandingListOpen, setOutstandingListOpen] = useState(false);
  const [showPaymentsList, setShowPaymentsList] = useState(false);
  
  const qc = useQueryClient();
  const { toast } = useToast();

  // Sync invoices mutation
  const syncInvoicesMutation = useMutation({
    mutationFn: async (mode: 'all' | 'last_2_months') => {
      return await apiRequest('POST', '/api/admin/sync-invoices', { mode });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invoices Synced",
        description: data.message,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync invoices",
        variant: "destructive",
      });
    },
  });

  const { data: subscriptionsData } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: paymentHistoryData } = useQuery<{ payments: StripePayment[] }>({
    queryKey: ["/api/admin/payment-history", currentMonth.getFullYear(), currentMonth.getMonth() + 1],
  });

  // Fetch custom payments from database
  const { data: customPaymentsData, isLoading: isLoadingCustomPayments } = useQuery<{ payments: CustomPayment[] }>({
    queryKey: ["/api/admin/custom-payments"],
  });

  const customPayments = customPaymentsData?.payments || [];

  // Fetch outstanding obligations (debts)
  const { data: obligationsData, isLoading: isLoadingObligations } = useQuery<{ obligations: PaymentObligation[] }>({
    queryKey: ["/api/admin/payment-obligations"],
  });

  const allObligations = obligationsData?.obligations || [];
  const outstandingObligations = allObligations.filter(
    o => o.status === 'pending' || o.status === 'grace' || o.status === 'retrying' || o.status === 'delinquent' || o.status === 'failed'
  );

  // Helper to check if an OUTSTANDING (unpaid) obligation exists for a specific payment date.
  // Excludes settled/written_off/stopped - when marked as paid, the calendar should show "Paid" not "Outstanding".
  const hasOutstandingObligation = (customPaymentId: number, paymentDate: Date) => {
    const dateStr = paymentDate.toISOString().split('T')[0];
    return outstandingObligations.some(o => 
      o.customPaymentId === customPaymentId && 
      o.dueDate && new Date(o.dueDate).toISOString().split('T')[0] === dateStr
    );
  };

  // Helper to check if ANY obligation exists (for preventing duplicate "mark as unpaid" on same date)
  const hasExistingObligation = (customPaymentId: number, paymentDate: Date) => {
    const dateStr = paymentDate.toISOString().split('T')[0];
    return allObligations.some(o => 
      o.customPaymentId === customPaymentId && 
      o.dueDate && new Date(o.dueDate).toISOString().split('T')[0] === dateStr
    );
  };

  // Helper to get the settled obligation for a custom payment + date (for "Revert to unpaid")
  const getSettledObligation = (customPaymentId: number, paymentDate: Date) => {
    const dateStr = paymentDate.toISOString().split('T')[0];
    return allObligations.find(o => 
      o.customPaymentId === customPaymentId && 
      o.status === 'settled' &&
      o.dueDate && new Date(o.dueDate).toISOString().split('T')[0] === dateStr
    );
  };

  // Add custom payment mutation
  const addCustomPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/admin/custom-payments', data);
    },
    onSuccess: () => {
      toast({ title: "Payment Added", description: "Custom payment has been added successfully." });
      qc.invalidateQueries({ queryKey: ["/api/admin/custom-payments"] });
      setIsDialogOpen(false);
      setNewPayment({
        clientName: '',
        amount: '',
        startDate: '',
        frequency: 'monthly',
        description: '',
        paymentType: 'cash'
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add payment", variant: "destructive" });
    },
  });

  // Delete custom payment mutation
  const deleteCustomPaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/admin/custom-payments/${id}`, {});
    },
    onSuccess: () => {
      toast({ title: "Payment Deleted", description: "Custom payment has been deleted." });
      qc.invalidateQueries({ queryKey: ["/api/admin/custom-payments"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete payment", variant: "destructive" });
    },
  });

  // Settle obligation mutation
  const settleObligationMutation = useMutation({
    mutationFn: async ({ id, amountPaid, paymentMethod, reference }: { id: number, amountPaid: number, paymentMethod?: string, reference?: string }) => {
      return await apiRequest('POST', `/api/admin/payment-obligations/${id}/settle`, { amountPaid, paymentMethod, reference });
    },
    onSuccess: () => {
      toast({ title: "Payment Settled", description: "The debt has been marked as paid." });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-obligations"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to settle payment", variant: "destructive" });
    },
  });

  // Revert obligation to unpaid (undo "mark as paid")
  const unsettleObligationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/admin/payment-obligations/${id}/unsettle`, {});
      return res.json() as Promise<{ obligation: PaymentObligation }>;
    },
    onSuccess: async (data) => {
      // Optimistically update cache so UI reflects change immediately
      qc.setQueryData<{ obligations: PaymentObligation[] }>(["/api/admin/payment-obligations"], (old) => {
        if (!old?.obligations) return old;
        return {
          obligations: old.obligations.map((o) =>
            o.id === data.obligation.id ? data.obligation : o
          ),
        };
      });
      // Refetch to ensure we're in sync with server
      await qc.refetchQueries({ queryKey: ["/api/admin/payment-obligations"] });
      toast({ title: "Reverted to Unpaid", description: "The payment has been marked as unpaid again." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to revert payment", variant: "destructive" });
    },
  });

  // Write-off obligation mutation
  const writeOffMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/admin/payment-obligations/${id}/write-off`, { notes: "Written off by admin" });
    },
    onSuccess: () => {
      toast({ title: "Debt Written Off", description: "The debt has been written off." });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-obligations"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to write off debt", variant: "destructive" });
    },
  });

  // Stop custom payment mutation (cancel recurring payment)
  const stopCustomPaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/admin/custom-payments/${id}/stop`, {});
    },
    onSuccess: () => {
      toast({ title: "Payment Stopped", description: "Recurring payment has been cancelled. Historical records are preserved." });
      qc.invalidateQueries({ queryKey: ["/api/admin/custom-payments"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to stop payment", variant: "destructive" });
    },
  });

  // Exclude a specific date from a recurring payment (delete single occurrence)
  const excludeDateMutation = useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      return await apiRequest('POST', `/api/admin/custom-payments/${id}/exclude-date`, { date });
    },
    onSuccess: () => {
      toast({ title: "Occurrence Deleted", description: "This single payment occurrence has been removed." });
      qc.invalidateQueries({ queryKey: ["/api/admin/custom-payments"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete occurrence", variant: "destructive" });
    },
  });

  // Mark custom payment as unpaid (creates an obligation)
  const markUnpaidMutation = useMutation({
    mutationFn: async ({ customPaymentId, clientName, amount, dueDate, description }: { 
      customPaymentId: number, 
      clientName: string, 
      amount: number, 
      dueDate: Date,
      description?: string 
    }) => {
      return await apiRequest('POST', '/api/admin/payment-obligations', {
        customPaymentId,
        clientName,
        amountDue: amount,
        currency: 'eur',
        dueDate: dueDate.toISOString(),
        origin: 'custom',
        notes: description || 'Custom payment marked as unpaid'
      });
    },
    onSuccess: () => {
      toast({ title: "Marked as Unpaid", description: "This payment now appears in Outstanding Debts." });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-obligations"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark as unpaid", variant: "destructive" });
    },
  });

  const addCustomPayment = () => {
    if (!newPayment.clientName || !newPayment.amount || !newPayment.startDate) {
      return;
    }

    addCustomPaymentMutation.mutate({
      clientName: newPayment.clientName,
      amount: parseFloat(newPayment.amount), // Server converts to cents
      startDate: newPayment.startDate,
      frequency: newPayment.frequency,
      description: newPayment.description || undefined,
      paymentType: newPayment.paymentType,
      currency: 'eur'
    });
  };

  const deleteCustomPayment = (id: number) => {
    deleteCustomPaymentMutation.mutate(id);
  };

  // Convert Stripe payment history to unified format
  const stripePayments = (paymentHistoryData?.payments || []).map(payment => ({
    id: payment.id,
    type: payment.status === 'paid' ? 'stripe_paid' as const : 'stripe_upcoming' as const,
    clientName: payment.clientName,
    email: payment.email,
    amount: payment.amount,
    nextPayment: new Date(payment.date),
    tier: payment.tier,
    invoiceUrl: payment.invoiceUrl,
    status: payment.status,
  }));

  // Get all custom payment instances for the current view (including historical)
  const customPaymentInstances = customPayments
    .flatMap(payment => {
      // Get payment dates within a wider range to ensure we capture all relevant dates
      const yearRange = 2; // Look 2 years back and forward
      const paymentForCalc = {
        ...payment,
        startDate: new Date(payment.startDate),
        frequency: payment.frequency as 'monthly' | 'yearly' | 'weekly'
      };
      const dates = getAllCustomPaymentDates(
        paymentForCalc,
        currentMonth.getFullYear() - yearRange,
        0,
        currentMonth.getFullYear() + yearRange,
        11
      );
      
      // For stopped payments, only show past dates (historical records)
      // For active payments, show all dates
      const filteredDates = payment.isActive 
        ? dates 
        : dates.filter(dateInfo => dateInfo.isPast);
      
      return filteredDates.map((dateInfo) => ({
        id: `${payment.id}-${dateInfo.date.getTime()}`, // Unique ID for display
        originalId: payment.id, // Preserve original ID for deletion
        clientName: payment.clientName,
        amount: payment.amount / 100, // Convert from cents to euros
        frequency: payment.frequency,
        description: payment.description,
        paymentType: payment.paymentType,
        nextPayment: dateInfo.date,
        type: 'custom' as const,
        status: dateInfo.isPast ? 'paid' as const : 'upcoming' as const,
        isActive: payment.isActive, // Preserve active status for display
      }));
    });

  // Add Stripe-origin payment obligations (failed/retrying/delinquent) so they stay visible on calendar
  const stripeObligationPayments = outstandingObligations
    .filter(o => o.origin === 'stripe' && o.dueDate)
    .map(o => ({
      id: `obligation_${o.id}`,
      type: 'stripe_obligation' as const,
      clientName: o.clientName,
      email: '',
      amount: o.amountDue / 100,
      nextPayment: new Date(o.dueDate),
      tier: undefined as string | undefined,
      status: o.status as 'retrying' | 'delinquent' | 'failed',
      obligationId: o.id,
    }));

  // Combine all payments (Stripe historical + upcoming + failed obligations + custom)
  const allPayments = [
    ...stripePayments,
    ...stripeObligationPayments,
    ...customPaymentInstances
  ].sort((a, b) => a.nextPayment.getTime() - b.nextPayment.getTime());

  // Get all payment dates
  const paymentDates = allPayments.map(payment => payment.nextPayment);

  // Helper function to normalize dates for comparison (removes time component)
  const normalizeDate = (date: Date) => {
    // Use UTC to avoid timezone issues when comparing dates
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  // Filter payments for selected date
  const selectedDatePayments = useMemo(() => {
    if (!selectedDate) return [];
    
    const normalizedSelectedDate = normalizeDate(selectedDate);
    
    return allPayments.filter(payment => {
      const normalizedPaymentDate = normalizeDate(payment.nextPayment);
      return normalizedPaymentDate.getTime() === normalizedSelectedDate.getTime();
    });
  }, [selectedDate, allPayments]);

  // Count total payments for the displayed month
  const monthlyPayments = allPayments.filter(payment => {
    const paymentDate = payment.nextPayment;
    return paymentDate.getMonth() === currentMonth.getMonth() &&
      paymentDate.getFullYear() === currentMonth.getFullYear();
  });

  const totalMonthlyPayments = monthlyPayments.length;

  // Calculate total monthly revenue
  const totalMonthlyRevenue = monthlyPayments.reduce((total, payment) => {
    return total + payment.amount;
  }, 0);

  // Calculate past vs future revenue using end-of-day boundary
  // FIX: Use date-based logic rather than status-based to prevent payments from disappearing
  // during status transitions (e.g., 'processing' status on the day of payment)
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const failedStatuses = ['failed', 'retrying', 'delinquent'] as const;
  const isFailedPayment = (p: { status?: string }) => failedStatuses.includes(p.status as any);

  // Past payments: before today with 'paid' status, OR today with 'paid'
  const pastPayments = monthlyPayments.filter(p => {
    const paymentDate = new Date(p.nextPayment);
    paymentDate.setHours(0, 0, 0, 0);
    if (isFailedPayment(p)) return false; // Exclude failed from revenue
    if (paymentDate < today) return true;
    if (paymentDate.getTime() === today.getTime() && p.status === 'paid') return true;
    return false;
  });

  // Failed payments: past due with failed/retrying/delinquent status (keep visible on calendar)
  const failedPayments = monthlyPayments.filter(p => {
    const paymentDate = new Date(p.nextPayment);
    paymentDate.setHours(0, 0, 0, 0);
    return isFailedPayment(p) && paymentDate <= today;
  });
  
  // Future payments: after today, OR today with non-'paid' status (upcoming, processing, etc.)
  const futurePayments = monthlyPayments.filter(p => {
    const paymentDate = new Date(p.nextPayment);
    paymentDate.setHours(0, 0, 0, 0);
    if (isFailedPayment(p)) return false; // Exclude from future revenue
    if (paymentDate > today) return true;
    if (paymentDate.getTime() === today.getTime() && p.status !== 'paid') return true;
    return false;
  });
  
  const totalPastRevenue = pastPayments.reduce((total, payment) => total + payment.amount, 0);
  const totalFutureRevenue = futurePayments.reduce((total, payment) => total + payment.amount, 0);

  // Custom modifiers for the calendar - past (paid), future (upcoming), failed
  const pastPaymentDates = pastPayments.map(p => p.nextPayment);
  const futurePaymentDates = futurePayments.map(p => p.nextPayment);
  const failedPaymentDates = failedPayments.map(p => p.nextPayment);
  
  const modifiers = {
    pastPayment: pastPaymentDates,
    futurePayment: futurePaymentDates,
    failedPayment: failedPaymentDates,
  };

  // Custom modifier styles
  const modifiersStyles = {
    pastPayment: {
      backgroundColor: '#10b981',
      color: 'white',
      borderRadius: '50%',
      fontWeight: 'bold',
    },
    futurePayment: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderRadius: '50%',
      fontWeight: 'bold',
    },
    failedPayment: {
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '50%',
      fontWeight: 'bold',
    },
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
    setSelectedDate(newMonth);
  };

  return (
    <div className="grid grid-cols-[auto,1fr] gap-4">
      <div className="space-y-4">
        <div className="text-center mb-2 space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateMonth('prev')}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[150px] text-center">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateMonth('next')}
              data-testid="button-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-green-50 rounded border border-green-200">
              <p className="text-green-800 font-semibold">Past Payments</p>
              <p className="text-lg font-bold text-green-600">{pastPayments.length}</p>
              <p className="text-green-700">€{totalPastRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-blue-800 font-semibold">Upcoming</p>
              <p className="text-lg font-bold text-blue-600">{futurePayments.length}</p>
              <p className="text-blue-700">€{totalFutureRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
          </div>
          
          <p className="text-sm font-medium text-muted-foreground pt-2 border-t">
            Total this month: <span className="font-bold text-foreground text-green-600">€{totalMonthlyRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </p>
          
          {/* Outstanding Summary - Always visible */}
          <div className={`p-2 rounded border mt-2 ${outstandingObligations.length > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${outstandingObligations.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
                <span className={`font-semibold text-sm ${outstandingObligations.length > 0 ? 'text-yellow-800' : 'text-gray-600'}`}>Outstanding</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-6 w-6 p-0 ${outstandingObligations.length > 0 ? 'text-yellow-700 hover:bg-yellow-100' : 'text-gray-500 hover:bg-gray-100'}`}
                      onClick={() => setOutstandingListOpen(true)}
                      data-testid="button-view-outstanding"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View all outstanding debts</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {outstandingObligations.length > 0 ? (
              <>
                <p className="text-lg font-bold text-yellow-600">{outstandingObligations.length} debt{outstandingObligations.length !== 1 ? 's' : ''}</p>
                <p className="text-yellow-700 text-sm">€{(outstandingObligations.reduce((sum, o) => sum + o.amountDue, 0) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No outstanding debts</p>
            )}
          </div>
        </div>
        <TooltipProvider>
          <div className="flex gap-1 mb-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Add Custom Payment</TooltipContent>
              </Tooltip>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Custom Repeated Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="clientName" className="text-right">
                    Client Name
                  </Label>
                  <Input
                    id="clientName"
                    value={newPayment.clientName}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, clientName: e.target.value }))}
                    className="col-span-3"
                    placeholder="Client name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                    className="col-span-3"
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startDate" className="text-right">
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newPayment.startDate}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, startDate: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="frequency" className="text-right">
                    Frequency
                  </Label>
                  <Select value={newPayment.frequency} onValueChange={(value: any) => setNewPayment(prev => ({ ...prev, frequency: value }))}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentType" className="text-right">
                    Payment Type
                  </Label>
                  <Select value={newPayment.paymentType} onValueChange={(value: any) => setNewPayment(prev => ({ ...prev, paymentType: value }))}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Payment</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={newPayment.description}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, description: e.target.value }))}
                    className="col-span-3"
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={addCustomPayment}>Add Payment</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={syncInvoicesMutation.isPending}
                    data-testid="button-sync-invoices"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncInvoicesMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{syncInvoicesMutation.isPending ? 'Syncing...' : 'Sync Invoices'}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => syncInvoicesMutation.mutate('all')}
                data-testid="menu-sync-all"
              >
                All Historical
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => syncInvoicesMutation.mutate('last_2_months')}
                data-testid="menu-sync-2-months"
              >
                Last 2 Months
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  setCurrentMonth(today);
                }}
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Today</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowPaymentsList(true)}
                data-testid="button-payments-list"
              >
                <ListOrdered className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>All Custom Payments</TooltipContent>
          </Tooltip>
          </div>
        </TooltipProvider>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentMonth}
          onMonthChange={(month) => setCurrentMonth(month)}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="rounded-md border shadow"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>
              {selectedDate ? (
                selectedDatePayments && selectedDatePayments.length > 0
                  ? `Payments on ${selectedDate.toLocaleDateString()}`
                  : `No payments on ${selectedDate.toLocaleDateString()}`
              ) : 'All Upcoming Payments'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedDatePayments.length === 0 && selectedDate && (
              <p className="text-center text-muted-foreground py-8">
                No payments scheduled for this date.
              </p>
            )}
            {(selectedDate ? selectedDatePayments : allPayments).map(payment => {
              // Use same date-based logic as filtering to determine display state
              const paymentDate = new Date(payment.nextPayment);
              paymentDate.setHours(0, 0, 0, 0);
              const isPast = paymentDate < today || (paymentDate.getTime() === today.getTime() && payment.status === 'paid');
              
              // Check if this payment has an outstanding (unpaid) obligation
              const isOutstanding = payment.type === 'custom' && hasOutstandingObligation(
                (payment as any).originalId as number,
                payment.nextPayment
              );
              const isStripeFailed = payment.type === 'stripe_obligation';
              
              // Determine card styling: failed (red) > outstanding (yellow) > past/paid (green) > upcoming (blue)
              const cardStyle = isStripeFailed
                ? 'bg-red-50 border-red-500'
                : isOutstanding 
                  ? 'bg-yellow-50 border-yellow-500'
                  : isPast 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-blue-50 border-blue-500';
              
              return (
                <div 
                  key={`${payment.type}-${payment.id}`} 
                  className={`flex justify-between items-center p-3 rounded-lg border-l-4 ${cardStyle}`}
                  data-testid={`payment-${payment.id}`}
                >
                  <div className="flex-1">
                    {payment.type === 'stripe_obligation' ? (
                      <>
                        <p className="font-medium" data-testid={`text-client-${payment.id}`}>{payment.clientName}</p>
                        <p className="text-sm text-muted-foreground">Stripe subscription payment</p>
                        <div className="flex gap-2 mt-1">
                          <span className="inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                            {(payment as any).status === 'retrying' ? 'Retrying' : (payment as any).status === 'delinquent' ? 'Delinquent' : 'Failed'}
                          </span>
                        </div>
                      </>
                    ) : payment.type === 'stripe_paid' || payment.type === 'stripe_upcoming' ? (
                      <>
                        <p className="font-medium" data-testid={`text-client-${payment.id}`}>{payment.clientName}</p>
                        <p className="text-sm text-muted-foreground">{payment.email}</p>
                        {payment.tier && <p className="text-sm">Plan: {payment.tier}</p>}
                        <div className="flex gap-2 mt-1">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            isOutstanding ? 'bg-yellow-100 text-yellow-800' : isPast ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isOutstanding ? 'Outstanding' : isPast ? 'Paid' : 'Upcoming'}
                          </span>
                          {payment.invoiceUrl && isPast && (
                            <a 
                              href={payment.invoiceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                            >
                              View Invoice
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">{payment.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          €{payment.amount.toFixed(2)} • {(payment as any).frequency}
                        </p>
                        {(payment as any).description && (
                          <p className="text-sm text-muted-foreground">{(payment as any).description}</p>
                        )}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            ((payment as any).paymentType || 'cash') === 'cash' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {((payment as any).paymentType || 'cash') === 'cash' ? 'Cash Payment' : 'Bank Transfer'}
                          </span>
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            isOutstanding ? 'bg-yellow-100 text-yellow-800' : isPast ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isOutstanding ? 'Outstanding' : isPast ? 'Paid' : 'Upcoming'}
                          </span>
                          {(payment as any).isActive === false && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">
                              Cancelled
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-medium">
                        {payment.nextPayment.toLocaleDateString()}
                      </p>
                      <p className={`text-sm font-medium ${isStripeFailed ? 'text-red-600' : isOutstanding ? 'text-yellow-600' : isPast ? 'text-green-600' : 'text-blue-600'}`}>
                        €{payment.amount.toFixed(2)}
                      </p>
                    </div>
                    {payment.type === 'custom' && (() => {
                      const customPaymentId = (payment as any).originalId as number;
                      const settledObligation = getSettledObligation(customPaymentId, payment.nextPayment);
                      const alreadyMarkedUnpaid = hasExistingObligation(customPaymentId, payment.nextPayment);
                      const isPaymentActive = (payment as any).isActive !== false;
                      return (
                        <div className="flex gap-1">
                          {settledObligation ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUnsettleDialog({ open: true, obligation: settledObligation })}
                              className="text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                              data-testid={`button-revert-unpaid-${payment.id}`}
                              title="Revert to unpaid"
                              disabled={unsettleObligationMutation.isPending}
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUnpaidDialog({ open: true, payment })}
                              className={alreadyMarkedUnpaid 
                                ? "text-gray-400 cursor-not-allowed" 
                                : "text-orange-600 hover:text-orange-800 hover:bg-orange-50"}
                              data-testid={`button-mark-unpaid-${payment.id}`}
                              title={alreadyMarkedUnpaid ? "Already marked as unpaid" : "Mark as unpaid (client didn't pay)"}
                              disabled={markUnpaidMutation.isPending || alreadyMarkedUnpaid}
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          )}
                          {isPaymentActive && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExcludeDateDialog({ open: true, payment, date: payment.nextPayment })}
                                className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                data-testid={`button-exclude-date-${payment.id}`}
                                title="Delete this occurrence only"
                                disabled={excludeDateMutation.isPending}
                              >
                                <CalendarX className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStopDialog({ open: true, payment })}
                                className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                data-testid={`button-stop-${payment.id}`}
                                title="Stop/Cancel recurring payment"
                                disabled={stopCustomPaymentMutation.isPending}
                              >
                                <StopCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, payment })}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            data-testid={`button-delete-${payment.id}`}
                            title="Delete recurring payment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Payments List Dialog */}
      <Dialog open={showPaymentsList} onOpenChange={setShowPaymentsList}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <ListOrdered className="w-5 h-5" />
              All Custom Payments ({customPayments.length})
            </DialogTitle>
          </DialogHeader>
          <TooltipProvider>
          {customPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No custom payments yet. Add one using the + button above.
            </p>
          ) : (
            <div className="space-y-3">
              {customPayments.map(payment => {
                const startDate = new Date(payment.startDate);
                
                return (
                  <div
                    key={payment.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      payment.isActive 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-400 bg-gray-50'
                    }`}
                    data-testid={`custom-payment-${payment.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-lg">{payment.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          €{(payment.amount / 100).toFixed(2)} • {payment.frequency}
                        </p>
                        {payment.description && (
                          <p className="text-sm text-muted-foreground mt-1">{payment.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            payment.paymentType === 'cash' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {payment.paymentType === 'cash' ? 'Cash' : 'Bank'}
                          </span>
                          <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                            Started: {startDate.toLocaleDateString()}
                          </span>
                          {!payment.isActive && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">
                              Cancelled
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {payment.isActive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStopDialog({ 
                                  open: true, 
                                  payment: {
                                    originalId: payment.id,
                                    clientName: payment.clientName,
                                    frequency: payment.frequency,
                                    description: payment.description,
                                    paymentType: payment.paymentType,
                                    amount: payment.amount / 100
                                  }
                                })}
                                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                              >
                                <StopCircle className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop recurring payment</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                payment: {
                                  originalId: payment.id,
                                  clientName: payment.clientName,
                                  frequency: payment.frequency,
                                  description: payment.description,
                                  paymentType: payment.paymentType,
                                  amount: payment.amount / 100
                                }
                              })}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete payment</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Summary */}
              <div className="pt-3 mt-3 border-t border-purple-200">
                <div className="flex flex-wrap justify-between items-center text-sm gap-2">
                  <span className="text-muted-foreground">
                    Active: {customPayments.filter(p => p.isActive).length} • 
                    Cancelled: {customPayments.filter(p => !p.isActive).length}
                  </span>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {customPayments.filter(p => p.isActive && p.frequency === 'weekly').length > 0 && (
                      <span className="text-purple-700">
                        Weekly: €{(customPayments
                          .filter(p => p.isActive && p.frequency === 'weekly')
                          .reduce((sum, p) => sum + p.amount, 0) / 100).toFixed(2)}
                      </span>
                    )}
                    {customPayments.filter(p => p.isActive && p.frequency === 'monthly').length > 0 && (
                      <span className="text-purple-700">
                        Monthly: €{(customPayments
                          .filter(p => p.isActive && p.frequency === 'monthly')
                          .reduce((sum, p) => sum + p.amount, 0) / 100).toFixed(2)}
                      </span>
                    )}
                    {customPayments.filter(p => p.isActive && p.frequency === 'yearly').length > 0 && (
                      <span className="text-purple-700">
                        Yearly: €{(customPayments
                          .filter(p => p.isActive && p.frequency === 'yearly')
                          .reduce((sum, p) => sum + p.amount, 0) / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </TooltipProvider>
        </DialogContent>
      </Dialog>

      {/* Outstanding Debts Section */}
      {outstandingObligations.length > 0 && (
        <Card className="col-span-2 mt-4 border-red-200">
          <CardHeader className="bg-red-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Outstanding Debts ({outstandingObligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {outstandingObligations.map(obligation => {
                const dueDate = obligation.dueDate ? new Date(obligation.dueDate) : new Date();
                const daysSinceDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                const monthsActive = Math.max(0, Math.floor(daysSinceDue / 30));
                const currency = obligation.currency || 'eur';
                
                const statusColors = {
                  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                  grace: 'bg-orange-100 text-orange-800 border-orange-300',
                  retrying: 'bg-purple-100 text-purple-800 border-purple-300',
                  delinquent: 'bg-red-100 text-red-800 border-red-300',
                  failed: 'bg-red-200 text-red-900 border-red-400',
                };
                
                const getBorderStyle = (status: string) => {
                  switch (status) {
                    case 'failed': return 'border-red-600 bg-red-100';
                    case 'delinquent': return 'border-red-500 bg-red-50';
                    case 'retrying': return 'border-purple-500 bg-purple-50';
                    case 'grace': return 'border-orange-500 bg-orange-50';
                    default: return 'border-yellow-500 bg-yellow-50';
                  }
                };
                
                return (
                  <div
                    key={obligation.id}
                    className={`p-4 rounded-lg border-l-4 ${getBorderStyle(obligation.status)}`}
                    data-testid={`debt-${obligation.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-lg">{obligation.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {dueDate.toLocaleDateString()} 
                          {daysSinceDue > 0 && (
                            <span className="text-red-600 ml-2">
                              ({daysSinceDue} days overdue)
                            </span>
                          )}
                        </p>
                        {monthsActive > 0 && (
                          <p className="text-sm text-red-700 font-medium mt-1">
                            Client active for {monthsActive} month{monthsActive > 1 ? 's' : ''} while owing
                          </p>
                        )}
                        {obligation.status === 'retrying' && (obligation as any).nextRetryDate && (
                          <p className="text-sm text-purple-700 font-medium mt-1">
                            Next retry: {new Date((obligation as any).nextRetryDate).toLocaleDateString()}
                            {(obligation as any).attemptCount && ` (Attempt ${(obligation as any).attemptCount})`}
                          </p>
                        )}
                        {obligation.status === 'failed' && (
                          <p className="text-sm text-red-700 font-medium mt-1">
                            Payment permanently failed - subscription cancelled
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded border ${statusColors[obligation.status as keyof typeof statusColors] || statusColors.pending}`}>
                            {obligation.status === 'retrying' ? 'Retrying...' : 
                             obligation.status === 'failed' ? 'Failed' :
                             obligation.status.charAt(0).toUpperCase() + obligation.status.slice(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {obligation.origin === 'stripe' ? 'Stripe Invoice' : 'Custom Payment'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">
                          €{(obligation.amountDue / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">
                          {currency}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => setSettleDialog({ open: true, obligation })}
                            disabled={settleObligationMutation.isPending}
                            data-testid={`button-settle-${obligation.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-600 border-gray-300 hover:bg-gray-50"
                            onClick={() => setWriteOffDialog({ open: true, obligation })}
                            disabled={writeOffMutation.isPending}
                            data-testid={`button-writeoff-${obligation.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Write Off
                          </Button>
                        </div>
                      </div>
                    </div>
                    {obligation.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">{obligation.notes}</p>
                    )}
                  </div>
                );
              })}
              
              {/* Total Outstanding */}
              <div className="pt-3 mt-3 border-t border-red-200">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-lg">Total Outstanding:</p>
                  <p className="text-2xl font-bold text-red-600">
                    €{(outstandingObligations.reduce((sum, o) => sum + o.amountDue, 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, payment: open ? deleteDialog.payment : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recurring payment? This will remove all {deleteDialog.payment?.frequency} payments for {deleteDialog.payment?.clientName}. Any related debt records will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.payment) {
                  deleteCustomPayment(deleteDialog.payment.originalId as number);
                  setDeleteDialog({ open: false, payment: null });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop/Cancel Confirmation Dialog */}
      <AlertDialog open={stopDialog.open} onOpenChange={(open) => setStopDialog({ open, payment: open ? stopDialog.payment : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Recurring Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Stop this {stopDialog.payment?.frequency} payment for {stopDialog.payment?.clientName}? No new payments will be generated, but historical records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (stopDialog.payment) {
                  stopCustomPaymentMutation.mutate(stopDialog.payment.originalId as number);
                  setStopDialog({ open: false, payment: null });
                }
              }}
              className="bg-gray-600 text-white hover:bg-gray-700"
            >
              Stop Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exclude Date (Delete Single Occurrence) Confirmation Dialog */}
      <AlertDialog open={excludeDateDialog.open} onOpenChange={(open) => setExcludeDateDialog({ open, payment: open ? excludeDateDialog.payment : null, date: open ? excludeDateDialog.date : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Occurrence</AlertDialogTitle>
            <AlertDialogDescription>
              Delete only the {excludeDateDialog.date?.toLocaleDateString()} payment for {excludeDateDialog.payment?.clientName}? The recurring payment will continue as usual, but this specific date will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excludeDateDialog.payment && excludeDateDialog.date) {
                  // Send date in local YYYY-MM-DD format to match how dates are generated/compared
                  const d = excludeDateDialog.date;
                  const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  excludeDateMutation.mutate({
                    id: excludeDateDialog.payment.originalId as number,
                    date: localDateStr
                  });
                  setExcludeDateDialog({ open: false, payment: null, date: null });
                }
              }}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Delete Occurrence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Unpaid Confirmation Dialog */}
      <AlertDialog open={unpaidDialog.open} onOpenChange={(open) => setUnpaidDialog({ open, payment: open ? unpaidDialog.payment : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Payment as Unpaid</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this {unpaidDialog.payment?.frequency} payment from {unpaidDialog.payment?.clientName} as unpaid? It will appear in the Outstanding Debts section where you can track and settle it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unpaidDialog.payment) {
                  markUnpaidMutation.mutate({
                    customPaymentId: unpaidDialog.payment.originalId as number,
                    clientName: unpaidDialog.payment.clientName,
                    amount: unpaidDialog.payment.amount,
                    dueDate: unpaidDialog.payment.nextPayment,
                    description: unpaidDialog.payment.description
                  });
                  setUnpaidDialog({ open: false, payment: null });
                }
              }}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Mark as Unpaid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Write Off Confirmation Dialog */}
      <AlertDialog open={writeOffDialog.open} onOpenChange={(open) => setWriteOffDialog({ open, obligation: open ? writeOffDialog.obligation : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Write Off Debt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to write off this debt from {writeOffDialog.obligation?.clientName} (€{((writeOffDialog.obligation?.amountDue || 0) / 100).toFixed(2)})? This will remove it from outstanding debts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (writeOffDialog.obligation) {
                  writeOffMutation.mutate(writeOffDialog.obligation.id);
                  setWriteOffDialog({ open: false, obligation: null });
                }
              }}
              className="bg-gray-600 text-white hover:bg-gray-700"
            >
              Write Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settle (Mark as Paid) Confirmation Dialog */}
      <AlertDialog open={settleDialog.open} onOpenChange={(open) => setSettleDialog({ open, obligation: open ? settleDialog.obligation : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this debt from {settleDialog.obligation?.clientName} (€{((settleDialog.obligation?.amountDue || 0) / 100).toFixed(2)}) as paid?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (settleDialog.obligation) {
                  settleObligationMutation.mutate({
                    id: settleDialog.obligation.id,
                    amountPaid: settleDialog.obligation.amountDue,
                    paymentMethod: 'manual'
                  });
                  setSettleDialog({ open: false, obligation: null });
                }
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Mark as Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert to Unpaid Confirmation Dialog */}
      <AlertDialog open={unsettleDialog.open} onOpenChange={(open) => setUnsettleDialog({ open, obligation: open ? unsettleDialog.obligation : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Unpaid</AlertDialogTitle>
            <AlertDialogDescription>
              Revert this payment from {unsettleDialog.obligation?.clientName} (€{((unsettleDialog.obligation?.amountDue || 0) / 100).toFixed(2)}) back to unpaid? It will appear in Outstanding Debts again so you can track and settle it when the client pays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unsettleDialog.obligation) {
                  unsettleObligationMutation.mutate(unsettleDialog.obligation.id);
                  setUnsettleDialog({ open: false, obligation: null });
                }
              }}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Revert to Unpaid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Outstanding Debts List Dialog */}
      <Dialog open={outstandingListOpen} onOpenChange={setOutstandingListOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="w-5 h-5" />
              All Outstanding Debts ({outstandingObligations.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {outstandingObligations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No outstanding debts</p>
            ) : (
              <>
                {outstandingObligations.map(obligation => {
                  const dueDate = obligation.dueDate ? new Date(obligation.dueDate) : new Date();
                  const daysSinceDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  const getDialogBorderStyle = (status: string) => {
                    switch (status) {
                      case 'failed': return 'border-red-600 bg-red-100';
                      case 'delinquent': return 'border-red-500 bg-red-50';
                      case 'retrying': return 'border-purple-500 bg-purple-50';
                      case 'grace': return 'border-orange-500 bg-orange-50';
                      default: return 'border-yellow-500 bg-yellow-50';
                    }
                  };
                  
                  return (
                    <div
                      key={obligation.id}
                      className={`p-3 rounded-lg border-l-4 ${getDialogBorderStyle(obligation.status)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{obligation.clientName}</p>
                          <p className="text-sm text-muted-foreground">
                            Due: {dueDate.toLocaleDateString()}
                            {daysSinceDue > 0 && (
                              <span className="text-red-600 ml-2">({daysSinceDue} days overdue)</span>
                            )}
                          </p>
                          {obligation.status === 'retrying' && (
                            <p className="text-xs text-purple-600 mt-1">
                              Stripe retrying payment...
                            </p>
                          )}
                          {obligation.status === 'failed' && (
                            <p className="text-xs text-red-600 mt-1">
                              Payment failed - subscription cancelled
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-yellow-600">
                            €{(obligation.amountDue / 100).toFixed(2)}
                          </p>
                          <div className="flex gap-1 mt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => {
                                setOutstandingListOpen(false);
                                setSettleDialog({ open: true, obligation });
                              }}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-gray-600 border-gray-300 hover:bg-gray-50"
                              onClick={() => {
                                setOutstandingListOpen(false);
                                setWriteOffDialog({ open: true, obligation });
                              }}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Write Off
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 mt-3 border-t border-yellow-300">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold">Total Outstanding:</p>
                    <p className="text-xl font-bold text-yellow-600">
                      €{(outstandingObligations.reduce((sum, o) => sum + o.amountDue, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}