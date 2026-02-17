import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          
          <p className="text-sm text-muted-foreground mb-8">Last updated: November 2025</p>
          
          <div className="mb-6">
            <p><strong>Operator:</strong> Petros Pollakis (Sole Proprietor)</p>
            <p><strong>Address:</strong> Chlois 27, Marousi, Athens, 15126, Greece</p>
            <p><strong>VAT (ΑΦΜ):</strong> 161537871</p>
            <p><strong>Email:</strong> support@hayc.gr</p>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
          <p>These Terms of Service ("Terms") govern the services provided by hayc, operated by Petros Pollakis, Sole Proprietor, to any customer ("you", "Customer"). By purchasing, accessing, or using any hayc service, you agree to these Terms. These Terms apply to both business clients (B2B) and consumer clients (B2C).</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Services</h2>
          <p>hayc provides subscription-based website services including setup, hosting, updates, maintenance, change requests, and add-ons ("Services"). Your scope is defined by your selected plan, add-ons, and these Terms.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Subscription Term & Auto-Renewal</h2>
          <p>Subscriptions renew automatically until cancelled. You authorize recurring charges to your payment method. If a payment fails, Stripe retries up to 8 times over 14 days. After that, your website may be suspended until payment succeeds.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Pricing, Taxes & Annual Discounts</h2>
          <p>Prices exclude VAT unless stated. VAT is added based on billing region. Annual plans include a 20% discount (rounded). Price changes require 30 days' notice.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Deliverables & Change Requests</h2>
          <p>Monthly change requests included:</p>
          <ul>
            <li>Basic: 1</li>
            <li>Essential: 2</li>
            <li>Pro: 5</li>
          </ul>
          <p>Unused changes do not roll over. Larger development work is not included.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Content Responsibilities</h2>
          <p>You confirm that you own or have rights to all content provided. Illegal, harmful, infringing, or prohibited content is not allowed.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Third-Party Services</h2>
          <p>hayc uses third-party providers for hosting, payments, analytics, and email. hayc is not liable for outages or changes made by third parties.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">8. Uptime & Maintenance</h2>
          <p>Target uptime: 99% monthly. Planned maintenance, provider outages, force majeure, and network issues are excluded. See SLA.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">9. Intellectual Property</h2>
          <p>Your content remains yours. hayc retains full ownership of templates, systems, plugins, and platform software. Clients may not export their websites.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">10. Data Protection</h2>
          <p>hayc acts as Controller for its clients and Processor for client website visitors. See the Privacy Policy and DPA.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">11. Confidentiality</h2>
          <p>Both parties agree to maintain confidentiality.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">12. Warranty & Disclaimer</h2>
          <p>hayc provides Services with reasonable skill but does not guarantee business results.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">13. Cancellation & Termination</h2>
          <p>Cancel anytime; access remains until the end of the billing cycle. No partial refunds. On termination, hayc disables your site and handles data per GDPR rules.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">14. Liability</h2>
          <p>hayc is not liable for indirect damages. Maximum liability is limited to fees paid in the last 12 months.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">15. Governing Law</h2>
          <p>Greece and EU law apply. Jurisdiction: Courts of Athens.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">16. Updates to Terms</h2>
          <p>Material changes notified 30 days in advance.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">17. Contact</h2>
          <p>support@hayc.gr<br />
          Chlois 27, Marousi, Athens, 15126, Greece</p>
        </div>
      </div>
    </div>
  );
}
