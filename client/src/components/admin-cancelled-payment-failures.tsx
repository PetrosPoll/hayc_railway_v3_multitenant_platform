import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CancelledSubscription {
  id: number;
  userId: number;
  tier: string;
  status: string;
  price: number;
  stripeSubscriptionId: string | null;
  createdAt: string;
  cancellationReason: string | null;
  username: string | null;
  email: string | null;
  attemptCount: number | null;
  lastFailureReason: string | null;
  lastDueDate: string | null;
  cancelledAt: string | null;
}

export function CancelledDueToPaymentFailureList() {
  const { data, isLoading } = useQuery<{ subscriptions: CancelledSubscription[] }>({
    queryKey: ["/api/admin/cancelled-due-to-payment-failure"],
  });

  const subscriptions = data?.subscriptions ?? [];

  if (isLoading) {
    return (
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Subscriptions Cancelled Due to Payment Failure
        </h2>
        <p className="text-muted-foreground">Loading...</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        Subscriptions Cancelled Due to Payment Failure
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        These subscriptions were cancelled after Stripe exhausted all payment retries (typically 6–9 attempts).
      </p>
      {subscriptions.length === 0 ? (
        <p className="text-muted-foreground py-8">No subscriptions cancelled due to payment failure.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Last Due Date</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Failure Reason</TableHead>
                <TableHead>Cancelled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.username || sub.email || "—"}</p>
                      {sub.email && sub.username && (
                        <p className="text-xs text-muted-foreground">{sub.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{sub.tier || "—"}</TableCell>
                  <TableCell>
                    €{((sub.price ?? 0) / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {sub.lastDueDate
                      ? new Date(sub.lastDueDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>{sub.attemptCount ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={sub.lastFailureReason ?? undefined}>
                    {sub.lastFailureReason || "—"}
                  </TableCell>
                  <TableCell>
                    {sub.cancelledAt
                      ? new Date(sub.cancelledAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
