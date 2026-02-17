import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          
          <p className="text-sm text-muted-foreground mb-8">Last updated: November 2025</p>
          
          <div className="mb-6">
            <p><strong>Data Controller:</strong> Petros Pollakis, Sole Proprietor (hayc)</p>
            <p><strong>Email:</strong> support@hayc.gr</p>
            <p><strong>Address:</strong> Chlois 27, Marousi, Athens, 15126, Greece</p>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Who We Are</h2>
          <p>hayc is a subscription website platform. We act as Controller for our clients and leads, and Processor for data processed on clients' websites.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Data We Collect</h2>
          <ul>
            <li>Account and Billing data</li>
            <li>Files and brand assets</li>
            <li>Platform usage logs</li>
            <li>Payments via Stripe (metadata only)</li>
            <li>Cloudinary file storage</li>
            <li>Communications (support emails and messages)</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Use Data (Legal Bases)</h2>
          <p>We process data to provide and manage subscriptions, process payments, send communications, improve services, and comply with legal obligations.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Sharing & Subprocessors</h2>
          <p>We share data only with providers in our Subprocessors List.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">5. International Transfers</h2>
          <p>SCCs and safeguards apply when transferring data outside the EEA.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Retention</h2>
          <ul>
            <li>Billing: 10 years</li>
            <li>Project files: 24 months post-cancellation</li>
            <li>Backups: 30 days</li>
            <li>Cookies: see Cookie Policy</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Your Rights</h2>
          <p>You may request access, correction, deletion, restriction, portability, or objection. Email support@hayc.gr. Complaints can be made to HDPA.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">8. Security</h2>
          <p>Encryption, access control, backups, monitoring, patching, and incident response are applied.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">9. Children</h2>
          <p>Services not for individuals under 16.</p>
        </div>
      </div>
    </div>
  );
}
