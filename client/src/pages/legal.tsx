import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Shield, Cookie, CreditCard, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Legal() {
  const legalPages = [
    {
      title: "Terms of Service",
      description: "Our terms and conditions for using hayc services",
      icon: FileText,
      path: "/terms-of-service"
    },
    {
      title: "Privacy Policy",
      description: "How we collect, use, and protect your personal data",
      icon: Shield,
      path: "/privacy-policy"
    },
    {
      title: "Cookie Policy",
      description: "Information about cookies and tracking technologies",
      icon: Cookie,
      path: "/cookie-policy"
    },
    {
      title: "Billing & Subscription Policy",
      description: "Details about payments, renewals, and cancellations",
      icon: CreditCard,
      path: "/billing-subscription-policy"
    },
    {
      title: "Acceptable Use Policy",
      description: "Guidelines for acceptable use of our services",
      icon: Ban,
      path: "/acceptable-use-policy"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Legal Information</h1>
          <p className="text-muted-foreground text-lg">
            Access all our legal documents, policies, and terms in one place
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {legalPages.map((page) => {
            const Icon = page.icon;
            return (
              <Link key={page.path} to={page.path} data-testid={`link-${page.path.slice(1)}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{page.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {page.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Questions or Concerns?</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about our legal policies or need clarification on any terms, please don't hesitate to contact us.
          </p>
          <p className="text-sm">
            <strong>Email:</strong> support@hayc.gr<br />
            <strong>Address:</strong> Chlois 27, Marousi, Athens, 15126, Greece
          </p>
        </div>
      </div>
    </div>
  );
}
