import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcceptableUsePolicy() {
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
          <h1 className="text-3xl font-bold mb-6">Acceptable Use Policy (AUP)</h1>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Forbidden Content/Services</h2>
          <ul>
            <li>Adult content</li>
            <li>Gambling</li>
            <li>Medical/health sensitive data</li>
            <li>Crypto/KYC services</li>
            <li>Illegal content, malware, phishing, spam</li>
            <li>Hate speech</li>
            <li>Copyright-infringing content</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Violations</h2>
          <p>Violations may result in suspension or termination.</p>
        </div>
      </div>
    </div>
  );
}
