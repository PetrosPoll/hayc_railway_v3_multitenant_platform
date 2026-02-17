import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CookiePolicy() {
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
          <h1 className="text-3xl font-bold mb-6">Cookie Policy</h1>
          
          <p className="text-sm text-muted-foreground mb-8">Last updated: November 2025</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Types of Cookies</h2>
          <p>Strictly necessary, preferences, analytics (Google Analytics + internal platform analytics). No advertising cookies currently.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Cookie Consent</h2>
          <p>Users can accept, reject, or manage preferences via the banner.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Example Cookie Table</h2>
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Cookie Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Provider</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">_ga</td>
                <td className="border border-gray-300 px-4 py-2">Analytics</td>
                <td className="border border-gray-300 px-4 py-2">Google</td>
                <td className="border border-gray-300 px-4 py-2">13 months</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">wp-settings-*</td>
                <td className="border border-gray-300 px-4 py-2">Preferences</td>
                <td className="border border-gray-300 px-4 py-2">hayc</td>
                <td className="border border-gray-300 px-4 py-2">1 year</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Contact</h2>
          <p>support@hayc.gr</p>
        </div>
      </div>
    </div>
  );
}
