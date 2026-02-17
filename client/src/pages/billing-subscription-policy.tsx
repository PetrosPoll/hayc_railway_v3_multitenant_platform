import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingSubscriptionPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="bg-card rounded-lg shadow-sm p-8 prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold mb-6">Billing & Subscription Policy</h1>

          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Renewals</h2>
          <p>All plans auto-renew. Annual plans include a 20% discount.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Failed Payments</h2>
          <p>Stripe retries 8 times over 14 days.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Cancellation</h2>
          <p>Cancel anytime. Access remains until period end. No partial refunds.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Refunds</h2>
          <p>Setup fee refundable only if work has NOT started. Subscription fees refundable only for duplicates, legal rights, or SLA credits.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Price Changes</h2>
          <p>30 days' notice provided.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Chargebacks</h2>
          <p>Chargebacks without contacting support may lead to suspension.</p>
        </div>
      </div>
    </div>
  );
}
