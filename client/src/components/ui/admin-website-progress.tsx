import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Plus, Trash2, FileText, Pencil, Copy, Mail, ArrowUpDown, ArrowUp, ArrowDown, X, MoreHorizontal, BarChart3 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OnboardingFormResponse } from "@shared/schema"
import { SubmissionDetailDialog } from "@/components/ui/admin-get-started-submissions"
import { ENVATO_TEMPLATES } from "@/data/envato-templates"
import { formatOnboardingValue } from "@/lib/onboarding-formatters"
import { formatGsValue } from "@/lib/get-started-formatters"


type WebsiteStage = {
  id: number
  stageNumber: number
  title: string
  description: string
  status: 'completed' | 'in-progress' | 'pending' | 'waiting'
  completedAt: string | null
  reminder_interval?: number;
  waiting_info?: string;
}

type Website = {
  id: number
  userId: number
  domain: string
  projectName?: string | null
  currentStage: number
  stages: WebsiteStage[]
  userEmail: string
  onboardingStatus?: string | null
  bonusEmails?: number | null
  bonusEmailsExpiry?: string | null
  bookingEnabled?: boolean
  paymentsEnabled?: boolean
  digitalProductsEnabled?: boolean
  contactEmail?: string | null
  siteId?: string | null
  websiteLanguage?: string | null
  customDomain?: string | null
}

type User = {
  id: number
  email: string
  username: string
}

function WebsiteProgressRowActions({
  website,
  canManageWebsites,
  onOpenOnboarding,
  onOpenGetStartedForm,
  onOpenAnalyticsDialog,
  onOpenNewsletterDialog,
  onRequestDelete,
  updateBookingMutation,
  updatePaymentsMutation,
  updateDigitalProductsMutation,
}: {
  website: Website
  canManageWebsites?: boolean
  onOpenOnboarding: () => void
  onOpenGetStartedForm?: () => void
  onOpenAnalyticsDialog: () => void
  onOpenNewsletterDialog: () => void
  onRequestDelete: () => void
  updateBookingMutation: {
    mutate: (v: { websiteId: number; bookingEnabled: boolean }) => void;
    isPending: boolean;
  };
  updatePaymentsMutation: {
    mutate: (v: { websiteId: number; paymentsEnabled: boolean }) => void;
    isPending: boolean;
  };
  updateDigitalProductsMutation: {
    mutate: (v: { websiteId: number; digitalProductsEnabled: boolean }) => void;
    isPending: boolean;
  };
}) {
  const settingsPending =
    updateBookingMutation.isPending ||
    updatePaymentsMutation.isPending ||
    updateDigitalProductsMutation.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1">
          <span data-testid={`button-website-actions-${website.id}`}>
            Actions
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() => {
            onOpenOnboarding();
          }}
        >
          <FileText className="h-4 w-4" />
          View onboarding form
        </DropdownMenuItem>
        {onOpenGetStartedForm && (
          <DropdownMenuItem onSelect={onOpenGetStartedForm}>
            <FileText className="h-4 w-4" />
            View get-started form
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => onOpenAnalyticsDialog()}
          data-testid={`menu-view-analytics-${website.id}`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics integration
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onOpenNewsletterDialog()}
          data-testid={`menu-view-newsletter-${website.id}`}
        >
          <Mail className="h-4 w-4" />
          Newsletter integration
        </DropdownMenuItem>
        {canManageWebsites ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Website dashboard tabs
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={website.bookingEnabled ?? false}
              disabled={settingsPending}
              onCheckedChange={(checked) => {
                updateBookingMutation.mutate({
                  websiteId: website.id,
                  bookingEnabled: !!checked,
                });
              }}
            >
              Booking
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={website.paymentsEnabled ?? false}
              disabled={settingsPending}
              onCheckedChange={(checked) => {
                updatePaymentsMutation.mutate({
                  websiteId: website.id,
                  paymentsEnabled: !!checked,
                });
              }}
            >
              Payments
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={website.digitalProductsEnabled ?? false}
              disabled={settingsPending}
              onCheckedChange={(checked) => {
                updateDigitalProductsMutation.mutate({
                  websiteId: website.id,
                  digitalProductsEnabled: !!checked,
                });
              }}
            >
              Digital products
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRequestDelete()}
            >
              <Trash2 className="h-4 w-4" />
              Delete progress
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnalyticsTrackingCode({
  websiteId,
  domain: _domain,
  variant = "accordion",
}: {
  websiteId: number;
  domain: string;
  variant?: "accordion" | "dialog";
}) {
  const [copied, setCopied] = useState(false);
  const [showWordPressCode, setShowWordPressCode] = useState(false);
  const isDialog = variant === "dialog";
  const boxClass = isDialog
    ? "mt-0 p-4 border rounded-lg bg-muted/50"
    : "mt-6 p-4 border rounded-lg bg-muted/50";

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/analytics/keys", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/keys/${websiteId}`);
      if (!response.ok) throw new Error("Failed to fetch analytics key");
      return response.json();
    },
  });

  const copyToClipboard = () => {
    if (analyticsData?.trackingScript) {
      navigator.clipboard.writeText(analyticsData.trackingScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className={boxClass}>
        {!isDialog && (
          <h3 className="font-semibold text-lg mb-2">Analytics Tracking Code</h3>
        )}
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading tracking code...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={boxClass}>
        <p className="text-sm text-muted-foreground">
          No analytics configuration is available for this website yet.
        </p>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      {!isDialog && (
        <div className="flex items-center mb-3 justify-between">
          <h3 className="font-semibold text-lg">Analytics Tracking Code</h3>
        </div>
      )}

      <div className="mb-6 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-semibold text-sm">React Website (HAYC Template)</h4>
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Analytics tracking is built into the React website template via the
          <code className="mx-1 px-1 py-0.5 bg-background rounded font-mono">
            useAnalytics
          </code>
          hook located at{" "}
          <code className="px-1 py-0.5 bg-background rounded font-mono">
            src/hayc/use-analytics.ts
          </code>
          . It fires a pageview event automatically on every route change using
          the site's <code className="mx-1 px-1 py-0.5 bg-background rounded font-mono">
            siteId
          </code>
          — no API key or additional setup is needed in the site code. To enable
          it, call <code className="mx-1 px-1 py-0.5 bg-background rounded font-mono">
            useAnalytics()
          </code>{" "}
          once inside a component that is a child of{" "}
          <code className="px-1 py-0.5 bg-background rounded font-mono">
            BrowserRouter
          </code>.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowWordPressCode((v) => !v)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <span>{showWordPressCode ? "▾" : "▸"}</span>
          <span>WordPress integration (legacy)</span>
        </button>

        {showWordPressCode && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                "Copy Code"
              )}
            </Button>
            <div>
              <Label className="text-sm font-medium">API Key:</Label>
              <code className="block mt-1 p-2 bg-background rounded text-xs font-mono break-all">
                {analyticsData.key.apiKey}
              </code>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Add this code to functions.php (API key is already embedded):
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Copy and paste this entire PHP code block into your theme's functions.php file. The API key is automatically included, so no additional setup is needed.
              </p>
              <pre className="mt-1 p-3 bg-background rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {analyticsData.phpTrackingCode || analyticsData.trackingScript}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">
              This will automatically add analytics tracking to all pages. No need to handle the API key separately - it's already in the code above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NewsletterIntegrationCode({
  websiteId,
  domain: _domain,
  variant = "accordion",
}: {
  websiteId: number;
  domain: string;
  variant?: "accordion" | "dialog";
}) {
  const [copied, setCopied] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [showWordPressCode, setShowWordPressCode] = useState(false);
  const isDialog = variant === "dialog";
  const boxClass = isDialog
    ? "mt-0 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20"
    : "mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20";

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/analytics/keys", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/keys/${websiteId}`);
      if (!response.ok) throw new Error("Failed to fetch analytics key");
      return response.json();
    },
  });

  const apiEndpoint = `${window.location.protocol}//${window.location.host}/api/newsletter/subscribe`;
  
  const contactForm7Code = analyticsData?.key?.apiKey ? `
/* Add this to Contact Form 7 Additional Settings */

on_sent_ok: "fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    key: '${analyticsData.key.apiKey}',
    email: document.querySelector('[name=your-email]').value,
    name: document.querySelector('[name=your-name]').value || '',
    group: 'Contact Form Subscribers'
  })
}).then(r => r.json()).then(d => console.log('Newsletter subscription:', d));"` : '';

  const copyCodeToClipboard = () => {
    const codeToCopy = analyticsData?.phpNewsletterCode || contactForm7Code;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ description: "Newsletter integration code copied to clipboard!" });
    }
  };

  const copyApiKeyToClipboard = () => {
    if (analyticsData?.key?.apiKey) {
      navigator.clipboard.writeText(analyticsData.key.apiKey);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
      toast({ description: "API key copied to clipboard!" });
    }
  };

  if (isLoading) {
    return (
      <div className={boxClass}>
        {!isDialog && (
          <h3 className="font-semibold text-lg mb-2">Newsletter Integration</h3>
        )}
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading integration code...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={boxClass}>
        <p className="text-sm text-muted-foreground">
          No newsletter integration data is available for this website yet. Analytics keys must be set
          up first.
        </p>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      {!isDialog && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Newsletter Integration
          </h3>
        </div>
      )}

      <div className="mb-6 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-semibold text-sm">React Website (HAYC Template)</h4>
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The React website template has two built-in newsletter integration points:
        </p>
        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside mt-2">
          <li>
            <code className="px-1 py-0.5 bg-background rounded font-mono">
              src/components/ContactForm.tsx
            </code>
            {" "}— the contact form fires a call to{" "}
            <code className="px-1 py-0.5 bg-background rounded font-mono">
              /api/newsletter/subscribe
            </code>
            {" "}on every submission using the site's{" "}
            <code className="px-1 py-0.5 bg-background rounded font-mono">siteId</code>
            . The visitor controls their subscription via a toggle checkbox
            before submitting.
          </li>
          <li>
            <code className="px-1 py-0.5 bg-background rounded font-mono">
              src/components/NewsletterForm.tsx
            </code>
            {" "}— a standalone email-only subscription form for use in footers
            or dedicated sections. Accepts only an email address, uses the same{" "}
            <code className="px-1 py-0.5 bg-background rounded font-mono">siteId</code>
            {" "}lookup, and includes a honeypot field. Drop{" "}
            <code className="px-1 py-0.5 bg-background rounded font-mono">
              {"<NewsletterForm />"}
            </code>
            {" "}anywhere on a page to use it.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          No API key or additional setup is needed for either component.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowWordPressCode((v) => !v)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <span>{showWordPressCode ? "▾" : "▸"}</span>
          <span>WordPress / Contact Form 7 integration (legacy)</span>
        </button>

        {showWordPressCode && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">API Key (same as analytics):</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 p-2 bg-background rounded text-xs font-mono break-all">
                  {analyticsData.key.apiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyApiKeyToClipboard}
                  className="gap-2 flex-shrink-0"
                >
                  {copiedApiKey ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Contact Form 7 Integration for functions.php:
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Copy and paste this PHP code into your theme's functions.php file. Users will be able to opt-in to the newsletter by checking a checkbox in the form. The API key is already embedded in the code.
              </p>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800 mb-2">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Required: Add a checkbox to your Contact Form 7</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  Add a checkbox field with the name <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">newsletter-subscribe</code> to your form. You can customize the label text to any language.
                </p>
                <p className="text-xs font-mono bg-blue-100 dark:bg-blue-900 p-2 rounded">
                  [checkbox newsletter-subscribe "Subscribe to our newsletter"]
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Example in Greek: <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">Εγγραφή στο newsletter</span>
                </p>
              </div>
              <div className="relative">
                <pre className="p-3 bg-background rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {analyticsData.phpNewsletterCode || contactForm7Code}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyCodeToClipboard}
                  className="absolute top-2 right-2 gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-background/50 rounded border-l-4 border-blue-500">
              <p className="text-sm font-medium mb-2">How it works:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Add the checkbox <code className="bg-background px-1 rounded">[checkbox newsletter-subscribe "Subscribe to our newsletter"]</code> to your Contact Form 7</li>
                <li>When someone checks the checkbox and submits the form, they are immediately subscribed to the newsletter</li>
                <li>Subscribers automatically appear in the "Contact Form Subscribers" group</li>
                <li>The user can then send newsletters to all subscribers from their dashboard</li>
                <li>Duplicate emails are automatically handled - existing subscribers won't be added twice</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              API Endpoint: <code className="bg-background px-1 py-0.5 rounded">{apiEndpoint}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BonusEmailsSection({ websiteId, bonusEmails, bonusEmailsExpiry }: { 
  websiteId: number; 
  bonusEmails?: number | null;
  bonusEmailsExpiry?: string | null;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(bonusEmails?.toString() || "");
  const [expiryDate, setExpiryDate] = useState(
    bonusEmailsExpiry ? new Date(bonusEmailsExpiry).toISOString().split('T')[0] : ""
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isExpired = bonusEmailsExpiry && new Date(bonusEmailsExpiry) < new Date();
  const hasActiveBonus = bonusEmails && bonusEmails > 0 && !isExpired;

  const grantBonusMutation = useMutation({
    mutationFn: async ({ bonusEmails, expiryDate }: { bonusEmails: number; expiryDate: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}/bonus-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonusEmails, expiryDate })
      });
      if (!response.ok) throw new Error('Failed to grant bonus emails');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Bonus emails granted successfully" });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ description: "Failed to grant bonus emails", variant: "destructive" });
    }
  });

  const clearBonusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/websites/${websiteId}/bonus-emails`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear bonus emails');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Bonus emails cleared" });
      setAmount("");
      setExpiryDate("");
    },
    onError: () => {
      toast({ description: "Failed to clear bonus emails", variant: "destructive" });
    }
  });

  const handleGrant = () => {
    const bonusAmount = parseInt(amount);
    if (isNaN(bonusAmount) || bonusAmount <= 0) {
      toast({ description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (!expiryDate) {
      toast({ description: "Please select an expiry date", variant: "destructive" });
      return;
    }
    grantBonusMutation.mutate({ bonusEmails: bonusAmount, expiryDate });
  };

  return (
    <div className="mt-6 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Bonus Emails
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid={`button-grant-bonus-${websiteId}`}>
              <Plus className="h-4 w-4 mr-1" />
              Grant Bonus
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Bonus Emails</DialogTitle>
              <DialogDescription>
                Add extra email quota for this website. The bonus will expire on the selected date.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bonusAmount">Number of bonus emails</Label>
                <Input
                  id="bonusAmount"
                  type="number"
                  placeholder="e.g., 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-bonus-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-bonus-expiry"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGrant}
                disabled={grantBonusMutation.isPending}
                data-testid="button-confirm-grant-bonus"
              >
                {grantBonusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Grant Bonus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hasActiveBonus ? (
        <div className="flex items-center justify-between p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Active bonus: {bonusEmails?.toLocaleString()} emails
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              Expires: {new Date(bonusEmailsExpiry!).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearBonusMutation.mutate()}
            disabled={clearBonusMutation.isPending}
            data-testid={`button-clear-bonus-${websiteId}`}
          >
            {clearBonusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : isExpired && bonusEmails && bonusEmails > 0 ? (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Previous bonus of {bonusEmails.toLocaleString()} emails expired on {new Date(bonusEmailsExpiry!).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No active bonus emails. Use "Grant Bonus" to add extra quota.
        </p>
      )}
    </div>
  );
}

function ContactFormConfigSection({ website }: { website: Website }) {
  const queryClient = useQueryClient();
  const [apiUrl, setApiUrl] = useState("https://hayc.gr");
  const { data } = useQuery({
    queryKey: ["/api/websites", website.id, "site-config"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${website.id}/site-config`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!website.siteId,
  });
  useEffect(() => {
    if (!data || typeof data !== "object") return;

    const config = data as Record<string, unknown>;
    const nestedSiteConfig =
      typeof config.siteConfig === "object" && config.siteConfig !== null
        ? (config.siteConfig as Record<string, unknown>)
        : null;

    const fetchedApiUrl =
      typeof nestedSiteConfig?.apiUrl === "string" && nestedSiteConfig.apiUrl
        ? nestedSiteConfig.apiUrl
        : typeof config.apiUrl === "string" && config.apiUrl
          ? config.apiUrl
          : null;

    if (fetchedApiUrl) {
      setApiUrl(fetchedApiUrl);
    }
  }, [data]);

  const saveContactConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/websites/${website.id}/contact-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: apiUrl.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites", website.id, "site-config"] });
      toast({ description: "Saved to S3" });
    },
    onError: (err: Error) => {
      toast({ description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  return (
    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
      <p className="text-xs text-muted-foreground mb-2">Contact Form Settings</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://hayc.gr"
          className="flex-1 min-w-[200px] h-8"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => saveContactConfigMutation.mutate()}
          disabled={saveContactConfigMutation.isPending}
        >
          {saveContactConfigMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save to S3
        </Button>
      </div>
    </div>
  );
}

export function AdminWebsiteProgress() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [newDomain, setNewDomain] = useState("")
  const [currentStage, setCurrentStage] = useState(1)
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null)
  const [isOnboardingDialogOpen, setIsOnboardingDialogOpen] = useState(false)
  const [onboardingDialogView, setOnboardingDialogView] = useState<"onboarding" | "get-started">("onboarding")
  const [gsWebsiteProgressId, setGsWebsiteProgressId] = useState<number | null>(null)
  const [isGsDialogOpen, setIsGsDialogOpen] = useState(false)
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null)
  const [editedDomainValue, setEditedDomainValue] = useState("")
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null)
  const [editedSiteIdValue, setEditedSiteIdValue] = useState("")
  const [editingWebsiteLanguageId, setEditingWebsiteLanguageId] = useState<number | null>(null)
  const [editedWebsiteLanguageValue, setEditedWebsiteLanguageValue] = useState("")
  const [editingCustomDomainId, setEditingCustomDomainId] = useState<number | null>(null)
  const [editedCustomDomainValue, setEditedCustomDomainValue] = useState("")
  const [editingContactEmailId, setEditingContactEmailId] = useState<number | null>(null)
  const [editedContactEmailValue, setEditedContactEmailValue] = useState("")
  const [sortByProgress, setSortByProgress] = useState<"asc" | "desc" | null>("desc")
  const [filterWaitingOnly, setFilterWaitingOnly] = useState(false)
  const [waitingInfoDialog, setWaitingInfoDialog] = useState<{
    isOpen: boolean;
    websiteId: number | null;
    stageNumber: number | null;
    currentWaitingInfo: string;
    currentReminderInterval: number;
    sendEmail: boolean;
    previousStatus: string;
  }>({
    isOpen: false,
    websiteId: null,
    stageNumber: null,
    currentWaitingInfo: "",
    currentReminderInterval: 1,
    sendEmail: false,
    previousStatus: "",
  })
  const [tempWaitingInfo, setTempWaitingInfo] = useState("")
  const [tempReminderInterval, setTempReminderInterval] = useState(1)
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, string>>({})
  const [websitePendingDelete, setWebsitePendingDelete] = useState<Website | null>(null)
  const [integrationCodeDialog, setIntegrationCodeDialog] = useState<{
    websiteId: number;
    domain: string;
    panel: "analytics" | "newsletter";
  } | null>(null)

  // Get current user permissions
  const { data: userData } = useQuery<{ user: any; permissions: any }>({
    queryKey: ["/api/user"],
  })
  const userPermissions = userData?.permissions

  const availableStages = [
    { id: "Welcome", title: t(`stages.welcome.title`), description: t(`stages.welcome.description`) },
    { id: "Layout", title: t(`stages.layout.title`), description: t(`stages.layout.description`) },
    { id: "Content", title: t(`stages.content.title`), description: t(`stages.content.description`) },
    { id: "Preview", title: t(`stages.preview.title`), description: t(`stages.preview.description`) },
    { id: "Feedback", title: t(`stages.feedback.title`), description: t(`stages.feedback.description`) },
    { id: "Launch", title: t(`stages.launch.title`), description: t(`stages.launch.description`) },
    { id: "planning", title: t(`stages.planning.title`), description: t(`stages.planning.description`) },
    { id: "uiux", title: t(`stages.uiux.title`), description: t(`stages.uiux.description`) },
    { id: "backend", title: t(`stages.backend.title`), description: t(`stages.backend.description`) },
    { id: "testing", title: t(`stages.testing.title`), description: t(`stages.testing.description`) },
    { id: "delivery", title: t(`stages.delivery.title`), description: t(`stages.delivery.description`) },
    { id: "content", title: t(`stages.contentCreation.title`), description: t(`stages.contentCreation.description`) },
    { id: "seo", title: t(`stages.seo.title`), description: t(`stages.seo.description`) },
    { id: "security", title: t(`stages.security.title`), description: t(`stages.security.description`) },
    { id: "maintenance", title: t(`stages.maintenance.title`), description: t(`stages.maintenance.description`) }
  ]

  const { data: users } = useQuery<{ users: User[] }>({
    queryKey: ["/api/admin/users"],
  })

  const { data: websitesResponse, isLoading } = useQuery<{ websites: Website[] }>({
    queryKey: ["/api/admin/websites"],
  })

  const websites = websitesResponse?.websites || []
  console.log("websites", websitesResponse);

  // Query for onboarding form response
  const { data: onboardingResponse, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ["/api/admin/websites", selectedWebsiteId, "onboarding-form"],
    queryFn: async (): Promise<OnboardingFormResponse | null> => {
      if (!selectedWebsiteId) return null
      const response = await fetch(`/api/admin/websites/${selectedWebsiteId}/onboarding-form`)
      if (!response.ok) {
        if (response.status === 404) return null // No onboarding form found
        throw new Error('Failed to fetch onboarding form response')
      }
      const data = await response.json()
      return data as OnboardingFormResponse
    },
    enabled: !!selectedWebsiteId && isOnboardingDialogOpen,
  })

  const { data: gsSubmissionResponse } = useQuery({
    queryKey: ["/api/admin/get-started-submissions", "by-website", gsWebsiteProgressId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/get-started-submissions?websiteProgressId=${gsWebsiteProgressId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!gsWebsiteProgressId && isGsDialogOpen,
  });

  const gsSubmission = gsSubmissionResponse?.submissions?.[0] ?? null;

  // Also fetch get-started submission when the onboarding dialog opens, so we can show both side by side
  const { data: onboardingDialogGsResponse, isLoading: isLoadingOnboardingGs } = useQuery({
    queryKey: ["/api/admin/get-started-submissions", "for-onboarding-dialog", selectedWebsiteId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/get-started-submissions?websiteProgressId=${selectedWebsiteId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedWebsiteId && isOnboardingDialogOpen,
  });

  const onboardingDialogGsSubmission = onboardingDialogGsResponse?.submissions?.[0] ?? null;

  // Auto-switch to get-started tab when only a get-started submission exists (no old onboarding form)
  useEffect(() => {
    if (!isLoadingOnboarding && !isLoadingOnboardingGs && !onboardingResponse && onboardingDialogGsSubmission) {
      setOnboardingDialogView("get-started");
    }
  }, [isLoadingOnboarding, isLoadingOnboardingGs, onboardingResponse, onboardingDialogGsSubmission]);

  const { data: gsPresenceResponse } = useQuery({
    queryKey: ["/api/admin/get-started-submissions/presence"],
    queryFn: async () => {
      const res = await fetch("/api/admin/get-started-submissions/presence", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const gsPresenceMap: Map<number, string> = new Map(
    (gsPresenceResponse?.presence ?? []).map((p: { websiteProgressId: number; status: string }) => [p.websiteProgressId, p.status])
  );

  const createWebsiteMutation = useMutation({
    mutationFn: async ({ userId, domain, currentStage, stages }: { userId: number, domain: string, currentStage: number, stages: string[] }) => {
      const response = await fetch(`/api/admin/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, domain, currentStage, stages })
      })
      if (!response.ok) throw new Error('Failed to create website progress')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] })
      toast({ description: "Website progress created successfully" })
      // Reset form state
      setNewDomain("")
      setSelectedStages([])
      setCurrentStage(1)
      setSelectedUser(null)
      // Close modal
      setIsCreateModalOpen(false)
    },
    onError: () => {
      toast({ description: "Failed to create website progress", variant: "destructive" })
    }
  })

  const updateStageMutation = useMutation({
    mutationFn: async ({ websiteId, stageNumber, status, waitingInfo, reminderInterval, sendEmail }: { websiteId: number, stageNumber: number, status: string, waitingInfo?: string, reminderInterval?: number, sendEmail?: boolean }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}/stages/${stageNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, waitingInfo, reminderInterval, sendEmail })
      })
      if (!response.ok) throw new Error('Failed to update stage')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] })
      toast({ description: "Stage updated successfully" })
    },
    onError: () => {
      toast({ description: "Failed to update stage", variant: "destructive" })
    }
  })

  const deleteWebsiteMutation = useMutation({
    mutationFn: async (websiteId: number) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete website');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Website progress deleted successfully" });
    },
    onError: (err) => {
      toast({ description: `Failed to delete website: ${err.message}`, variant: "destructive" });
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: async ({ websiteId, domain }: { websiteId: number; domain: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update domain');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Domain updated successfully" });
      setEditingDomainId(null);
      setEditedDomainValue("");
    },
    onError: (err: any) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ websiteId, bookingEnabled }: { websiteId: number; bookingEnabled: boolean }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingEnabled })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update booking setting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Booking setting updated" });
    },
    onError: (err: any) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updatePaymentsMutation = useMutation({
    mutationFn: async ({ websiteId, paymentsEnabled }: { websiteId: number; paymentsEnabled: boolean }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentsEnabled })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payments setting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Payments setting updated" });
    },
    onError: (err: any) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updateDigitalProductsMutation = useMutation({
    mutationFn: async ({ websiteId, digitalProductsEnabled }: { websiteId: number; digitalProductsEnabled: boolean }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digitalProductsEnabled }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update digital products setting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Digital products setting updated" });
    },
    onError: (err: any) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updateSiteIdMutation = useMutation({
    mutationFn: async ({ websiteId, siteId }: { websiteId: number; siteId: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update site ID');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Site ID updated successfully" });
      setEditingSiteId(null);
      setEditedSiteIdValue("");
    },
    onError: (error: Error) => {
      toast({ 
        description: error.message || "Failed to update site ID", 
        variant: "destructive" 
      });
    }
  });

  const updateWebsiteLanguageMutation = useMutation({
    mutationFn: async ({ websiteId, websiteLanguage }: { websiteId: number; websiteLanguage: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteLanguage })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update website language');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Website language updated successfully" });
      setEditingWebsiteLanguageId(null);
      setEditedWebsiteLanguageValue("");
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Failed to update website language",
        variant: "destructive"
      });
    }
  });

  const updateContactEmailMutation = useMutation({
    mutationFn: async ({ websiteId, contactEmail }: { websiteId: number; contactEmail: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update contact email');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Contact email updated" });
      setEditingContactEmailId(null);
      setEditedContactEmailValue("");
    },
    onError: (err: any) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updateCustomDomainMutation = useMutation({
    mutationFn: async ({ websiteId, customDomain }: { websiteId: number; customDomain: string }) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDomain })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update custom domain');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({ description: "Custom domain updated successfully" });
      setEditingCustomDomainId(null);
      setEditedCustomDomainValue("");
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Failed to update custom domain",
        variant: "destructive"
      });
    }
  });

  if (isLoading) return <div>Loading...</div>

  const filteredWebsites = websites
    .filter(w => !selectedUser || w.userId === selectedUser)
    .filter(w => !filterWaitingOnly || (w.stages?.some(s => s.status === 'waiting') ?? false))
  
  // Apply sorting by completion percentage if active
  const userWebsites = sortByProgress
    ? [...filteredWebsites].sort((a, b) => {
        const aCompleted = a.stages.filter((s) => s.status === "completed").length;
        const aTotal = a.stages.length || 1;
        const aProgress = (aCompleted / aTotal) * 100;

        const bCompleted = b.stages.filter((s) => s.status === "completed").length;
        const bTotal = b.stages.length || 1;
        const bProgress = (bCompleted / bTotal) * 100;

        const byProgress =
          sortByProgress === "asc" ? aProgress - bProgress : bProgress - aProgress;
        if (byProgress !== 0) return byProgress;
        return a.id - b.id;
      })
    : filteredWebsites;

  const handleProgressSort = () => {
    if (sortByProgress === "desc") {
      setSortByProgress("asc");
    } else if (sortByProgress === "asc") {
      setSortByProgress(null);
    } else {
      setSortByProgress("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select value={selectedUser?.toString() || "all"} onValueChange={(value) => setSelectedUser(value === "all" ? null : parseInt(value))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users?.users.map(user => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-waiting"
              checked={filterWaitingOnly}
              onCheckedChange={(checked) => setFilterWaitingOnly(checked === true)}
            />
            <Label htmlFor="filter-waiting" className="text-sm cursor-pointer whitespace-nowrap">
              We are waiting for information
            </Label>
          </div>
          <Button
            variant={sortByProgress ? "default" : "outline"}
            size="sm"
            onClick={handleProgressSort}
            className="gap-2"
            data-testid="sort-by-progress"
          >
            Sort by Progress %
            {!sortByProgress && <ArrowUpDown className="h-4 w-4" />}
            {sortByProgress === "asc" && <ArrowUp className="h-4 w-4" />}
            {sortByProgress === "desc" && <ArrowDown className="h-4 w-4" />}
          </Button>
          <div className="text-sm text-muted-foreground font-medium">
            Showing {userWebsites.length} {userWebsites.length === 1 ? 'website' : 'websites'}
          </div>
        </div>

        {userPermissions?.canManageWebsites && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Website Progress
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Website Progress</DialogTitle>
              <DialogDescription>
                Create a new website progress tracking for a user
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select
                  value={selectedUser?.toString() || ""}
                  onValueChange={(value) => setSelectedUser(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.users.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Domain Name</Label>
                <Input
                  placeholder="Enter domain name"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
              <div className="space-y-4">
                <Label>Select Stages for This Website</Label>
                <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto border rounded-md p-3">
                  {availableStages.map((stage) => (
                    <div key={stage.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={stage.id}
                        checked={selectedStages.includes(stage.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStages([...selectedStages, stage.id])
                          } else {
                            setSelectedStages(selectedStages.filter(id => id !== stage.id))
                          }
                        }}
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={stage.id} 
                          className="text-sm font-medium cursor-pointer"
                        >
                          {stage.title}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Label>Starting Stage:</Label>
                  <Select value={currentStage.toString()} onValueChange={(value) => setCurrentStage(parseInt(value))}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedStages.map((stageId, index) => {
                        const stage = availableStages.find(s => s.id === stageId)
                        return (
                          <SelectItem key={stageId} value={(index + 1).toString()}>
                            {stage?.title}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    if (selectedUser && newDomain && selectedStages.length > 0) {
                      createWebsiteMutation.mutate({ 
                        userId: selectedUser, 
                        domain: newDomain, 
                        currentStage,
                        stages: selectedStages 
                      })
                    }
                  }}
                  disabled={!selectedUser || !newDomain || selectedStages.length === 0 || createWebsiteMutation.isPending}
                >
                  {createWebsiteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Website Progress"
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Accordion type="multiple" className="space-y-4">
        {userWebsites.map((website) => {
          const completedStages = website.stages.filter(stage => stage.status === 'completed').length
          const progress = (completedStages / website.stages.length) * 100

          return (
            <AccordionItem
              key={website.id}
              value={website.id.toString()}
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full min-w-0 mr-4 text-left">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {editingDomainId === website.id ? (
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editedDomainValue}
                          onChange={(e) => setEditedDomainValue(e.target.value)}
                          className="h-8 w-64"
                          data-testid={`input-domain-edit-${website.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editedDomainValue.trim()) {
                              updateDomainMutation.mutate({ 
                                websiteId: website.id, 
                                domain: editedDomainValue.trim() 
                              });
                            }
                          }}
                          disabled={updateDomainMutation.isPending || !editedDomainValue.trim()}
                          data-testid={`button-save-domain-${website.id}`}
                        >
                          {updateDomainMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDomainId(null);
                            setEditedDomainValue("");
                          }}
                          disabled={updateDomainMutation.isPending}
                          data-testid={`button-cancel-domain-${website.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="font-semibold text-lg truncate">
                        {website.projectName || website.domain}
                      </div>
                    )}
                    {editingDomainId !== website.id && (
                      <div className="text-sm text-muted-foreground truncate">
                        {website.userEmail}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {website.onboardingStatus ? (
                      <span
                        className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                          website.onboardingStatus === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : website.onboardingStatus === "draft"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {website.onboardingStatus === "completed"
                          ? "Form: Completed"
                          : website.onboardingStatus === "draft"
                            ? "Form: Draft"
                            : `Form: ${website.onboardingStatus}`}
                      </span>
                    ) : gsPresenceMap.has(website.id) ? (
                      <span
                        className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                          gsPresenceMap.get(website.id) === "completed" || gsPresenceMap.get(website.id) === "paid"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : gsPresenceMap.get(website.id) === "in_progress" || gsPresenceMap.get(website.id) === "pending_payment"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {`Get-started: ${gsPresenceMap.get(website.id)}`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        No onboarding form
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {Math.round(progress)}% completed
                    </span>
                    <WebsiteProgressRowActions
                      website={website}
                      canManageWebsites={userPermissions?.canManageWebsites}
                      onOpenOnboarding={() => {
                        setSelectedWebsiteId(website.id);
                        setOnboardingDialogView("onboarding");
                        setIsOnboardingDialogOpen(true);
                      }}
                      onOpenGetStartedForm={() => {
                        setGsWebsiteProgressId(website.id);
                        setIsGsDialogOpen(true);
                      }}
                      onOpenAnalyticsDialog={() =>
                        setIntegrationCodeDialog({
                          websiteId: website.id,
                          domain: website.domain,
                          panel: "analytics",
                        })
                      }
                      onOpenNewsletterDialog={() =>
                        setIntegrationCodeDialog({
                          websiteId: website.id,
                          domain: website.domain,
                          panel: "newsletter",
                        })
                      }
                      onRequestDelete={() => setWebsitePendingDelete(website)}
                      updateBookingMutation={updateBookingMutation}
                      updatePaymentsMutation={updatePaymentsMutation}
                      updateDigitalProductsMutation={updateDigitalProductsMutation}
                    />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 space-y-6">
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-right">{Math.round(progress)}% completed</p>
                </div>

                <div className="relative flex flex-col space-y-8">
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200" />
                  {website.stages.map((stage) => (
                    <div key={stage.id} className="flex items-start gap-4 relative">
                      <div
                        className={`
                          w-12 h-12 rounded-full flex items-center justify-center shrink-0
                          ${stage.status === 'completed' ? 'bg-green-100 text-green-600' :
                            stage.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                            stage.status === 'waiting' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-gray-100 text-gray-400'}
                          z-10
                        `}
                      >
                        {stage.status === 'completed' ? (
                          <Check className="h-6 w-6" />
                        ) : stage.status === 'in-progress' ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <span className="text-lg font-semibold">{stage.stageNumber}</span>
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold">{stage.title}</h3>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>

                        {userPermissions?.canManageWebsites ? (
                          <Select
                            value={pendingStatusChanges[`${website.id}-${stage.stageNumber}`] ?? stage.status}
                            onValueChange={(value) => {
                              const stageKey = `${website.id}-${stage.stageNumber}`;
                              if (value === 'waiting') {
                                // Set pending status change and open the waiting info dialog
                                setPendingStatusChanges(prev => ({ ...prev, [stageKey]: 'waiting' }));
                                const sendEmail = value !== stage.status && confirm('Do you want to send an email notification about this stage change?');
                                setWaitingInfoDialog({
                                  isOpen: true,
                                  websiteId: website.id,
                                  stageNumber: stage.stageNumber,
                                  currentWaitingInfo: stage.waiting_info || "",
                                  currentReminderInterval: stage.reminder_interval || 1,
                                  sendEmail,
                                  previousStatus: stage.status,
                                });
                                setTempWaitingInfo(stage.waiting_info || "");
                                setTempReminderInterval(stage.reminder_interval || 1);
                              } else {
                                // For other statuses, update directly
                                if (value !== stage.status && confirm('Do you want to send an email notification about this stage change?')) {
                                  updateStageMutation.mutate({
                                    websiteId: website.id,
                                    stageNumber: stage.stageNumber,
                                    status: value,
                                    sendEmail: true
                                  });
                                } else {
                                  updateStageMutation.mutate({
                                    websiteId: website.id,
                                    stageNumber: stage.stageNumber,
                                    status: value,
                                    sendEmail: false
                                  });
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px] mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="waiting">We are waiting for information</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Status: </span>
                            <span className={`capitalize ${
                              stage.status === 'completed' ? 'text-green-600' :
                              stage.status === 'in-progress' ? 'text-blue-600' :
                              stage.status === 'waiting' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                              {stage.status === 'waiting' ? 'We are waiting for information' : stage.status}
                            </span>
                          </div>
                        )}
                        {stage.status === 'waiting' && stage.waiting_info && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-medium text-yellow-800">Waiting for:</p>
                                <p className="text-sm text-yellow-700 whitespace-pre-line">{stage.waiting_info}</p>
                              </div>
                              <p className="text-xs text-yellow-600">Reminder: Every {stage.reminder_interval || 1} day(s)</p>
                              {userPermissions?.canManageWebsites && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setWaitingInfoDialog({
                                      isOpen: true,
                                      websiteId: website.id,
                                      stageNumber: stage.stageNumber,
                                      currentWaitingInfo: stage.waiting_info || "",
                                      currentReminderInterval: stage.reminder_interval || 1,
                                      sendEmail: false,
                                      previousStatus: stage.status,
                                    });
                                    setTempWaitingInfo(stage.waiting_info || "");
                                    setTempReminderInterval(stage.reminder_interval || 1);
                                  }}
                                  data-testid={`button-edit-waiting-info-${stage.id}`}
                                >
                                  Edit Waiting Information
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Site ID Section - Admin only */}
                {userPermissions?.canManageWebsites && (
                  <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Site ID</span>
                        {editingSiteId === website.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editedSiteIdValue}
                              onChange={(e) => setEditedSiteIdValue(e.target.value)}
                              className="h-8 w-48"
                              placeholder="e.g. honda-website"
                              data-testid={`input-siteid-edit-${website.id}`}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (editedSiteIdValue.trim()) {
                                  updateSiteIdMutation.mutate({ 
                                    websiteId: website.id, 
                                    siteId: editedSiteIdValue.trim() 
                                  });
                                }
                              }}
                              disabled={updateSiteIdMutation.isPending || !editedSiteIdValue.trim()}
                              data-testid={`button-save-siteid-${website.id}`}
                            >
                              {updateSiteIdMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingSiteId(null);
                                setEditedSiteIdValue("");
                              }}
                              disabled={updateSiteIdMutation.isPending}
                              data-testid={`button-cancel-siteid-${website.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={website.siteId ? "text-sm" : "text-sm text-muted-foreground"}>
                              {website.siteId || "Not configured"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingSiteId(website.id);
                                setEditedSiteIdValue(website.siteId || "");
                              }}
                              data-testid={`button-edit-siteid-${website.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {website.siteId && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    disabled={updateSiteIdMutation.isPending}
                                    data-testid={`button-delete-siteid-${website.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Site ID</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to delete the Site ID "{website.siteId}" for {website.projectName || website.domain}? This will remove the S3 config path association.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="ghost" onClick={() => document.querySelector('dialog')?.close()}>
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => {
                                        updateSiteIdMutation.mutate({ 
                                          websiteId: website.id, 
                                          siteId: "" 
                                        });
                                        document.querySelector('dialog')?.close();
                                      }}
                                      disabled={updateSiteIdMutation.isPending}
                                    >
                                      {updateSiteIdMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : null}
                                      Delete
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Website Language</span>
                        {editingWebsiteLanguageId === website.id ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={editedWebsiteLanguageValue || ""}
                              onValueChange={(v) => setEditedWebsiteLanguageValue(v)}
                            >
                              <SelectTrigger className="h-8 w-48">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="el">Greek (EL)</SelectItem>
                                <SelectItem value="en">English (EN)</SelectItem>
                                <SelectItem value="both">Both (EL + EN)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (editedWebsiteLanguageValue) {
                                  updateWebsiteLanguageMutation.mutate({
                                    websiteId: website.id,
                                    websiteLanguage: editedWebsiteLanguageValue
                                  });
                                }
                              }}
                              disabled={updateWebsiteLanguageMutation.isPending || !editedWebsiteLanguageValue}
                            >
                              {updateWebsiteLanguageMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingWebsiteLanguageId(null);
                                setEditedWebsiteLanguageValue("");
                              }}
                              disabled={updateWebsiteLanguageMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                typeof website.websiteLanguage === "string" && website.websiteLanguage
                                  ? "text-sm"
                                  : "text-sm text-muted-foreground"
                              }
                            >
                              {typeof website.websiteLanguage === "string" && website.websiteLanguage
                                ? website.websiteLanguage
                                : "Not configured"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingWebsiteLanguageId(website.id);
                                setEditedWebsiteLanguageValue(website.websiteLanguage || "");
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Contact Email</span>
                        {editingContactEmailId === website.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={editedContactEmailValue}
                              onChange={(e) => setEditedContactEmailValue(e.target.value)}
                              className="h-8 w-48"
                              placeholder="contact@domain.com"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const v = editedContactEmailValue.trim();
                                if (v) {
                                  updateContactEmailMutation.mutate({
                                    websiteId: website.id,
                                    contactEmail: v,
                                  });
                                }
                              }}
                              disabled={updateContactEmailMutation.isPending || !editedContactEmailValue.trim()}
                            >
                              {updateContactEmailMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingContactEmailId(null);
                                setEditedContactEmailValue("");
                              }}
                              disabled={updateContactEmailMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                typeof website.contactEmail === "string" && website.contactEmail
                                  ? "text-sm"
                                  : "text-sm text-muted-foreground"
                              }
                            >
                              {typeof website.contactEmail === "string" && website.contactEmail
                                ? website.contactEmail
                                : "Not configured"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingContactEmailId(website.id);
                                setEditedContactEmailValue(website.contactEmail || "");
                              }}
                              data-testid={`button-edit-contact-email-${website.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className={editingCustomDomainId === website.id ? "grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1" : "flex items-center gap-2"}>
                        <span className="text-sm font-medium pt-1.5">Custom Domain</span>
                        {editingCustomDomainId === website.id ? (
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Input
                                value={editedCustomDomainValue}
                                onChange={(e) => setEditedCustomDomainValue(e.target.value)}
                                className="h-8 w-48"
                                placeholder="domain_name.com"
                              />
                              <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                updateCustomDomainMutation.mutate({
                                  websiteId: website.id,
                                  customDomain: editedCustomDomainValue.trim()
                                });
                              }}
                              disabled={updateCustomDomainMutation.isPending || !editedCustomDomainValue.trim()}
                            >
                              {updateCustomDomainMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCustomDomainId(null);
                                setEditedCustomDomainValue("");
                              }}
                              disabled={updateCustomDomainMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Hostname only, e.g. domain_name.com — no https:// or trailing slash</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={website.customDomain ? "text-sm" : "text-sm text-muted-foreground"}>
                              {website.customDomain || "Not set"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingCustomDomainId(website.id);
                                setEditedCustomDomainValue(website.customDomain || "");
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {website.customDomain && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    disabled={updateCustomDomainMutation.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Custom Domain</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to remove the custom domain "{website.customDomain}" for {website.projectName || website.domain}?
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="ghost" onClick={() => document.querySelector('dialog')?.close()}>
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => {
                                        updateCustomDomainMutation.mutate({
                                          websiteId: website.id,
                                          customDomain: ""
                                        });
                                        document.querySelector('dialog')?.close();
                                      }}
                                      disabled={updateCustomDomainMutation.isPending}
                                    >
                                      {updateCustomDomainMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : null}
                                      Delete
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {website.siteId && userPermissions?.canManageWebsites && (
                      <ContactFormConfigSection website={website} />
                    )}
                    {website.siteId && (
                      <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                        S3 config path: sites/{website.siteId}/config/config.json
                      </p>
                    )}
                  </div>
                )}

                {/* Bonus Emails Section - Admin only */}
                {userPermissions?.canManageWebsites && (
                  <BonusEmailsSection 
                    websiteId={website.id} 
                    bonusEmails={website.bonusEmails}
                    bonusEmailsExpiry={website.bonusEmailsExpiry}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Waiting Information Dialog */}
      <Dialog 
        open={waitingInfoDialog.isOpen} 
        onOpenChange={(open) => {
          if (!open && waitingInfoDialog.websiteId && waitingInfoDialog.stageNumber) {
            // Revert the pending status change when closing without saving
            const stageKey = `${waitingInfoDialog.websiteId}-${waitingInfoDialog.stageNumber}`;
            setPendingStatusChanges(prev => {
              const next = { ...prev };
              delete next[stageKey];
              return next;
            });
            // Reset the dialog state
            setWaitingInfoDialog({
              isOpen: false,
              websiteId: null,
              stageNumber: null,
              currentWaitingInfo: "",
              currentReminderInterval: 1,
              sendEmail: false,
              previousStatus: "",
            });
            setTempWaitingInfo("");
            setTempReminderInterval(1);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Set Waiting Information</DialogTitle>
            <DialogDescription>
              Specify what information you're waiting for from the client and how often to send reminder emails.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="waiting-info">What are you waiting for?</Label>
              <textarea
                id="waiting-info"
                placeholder="Enter detailed information or a list of requirements you need from the client..."
                className="w-full p-3 border rounded-md min-h-[120px] resize-y"
                value={tempWaitingInfo}
                onChange={(e) => setTempWaitingInfo(e.target.value)}
                data-testid="textarea-waiting-info"
              />
              <p className="text-xs text-muted-foreground">
                This information will be displayed to the client and included in reminder emails.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder-interval">Email Reminder Interval</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="reminder-interval"
                  type="number"
                  min="1"
                  value={tempReminderInterval}
                  onChange={(e) => setTempReminderInterval(parseInt(e.target.value) || 1)}
                  className="w-24"
                  data-testid="input-reminder-interval"
                />
                <span className="text-sm text-muted-foreground">day(s)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                The client will receive a reminder email every {tempReminderInterval} day(s) until they provide the requested information.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Revert the pending status change
                if (waitingInfoDialog.websiteId && waitingInfoDialog.stageNumber) {
                  const stageKey = `${waitingInfoDialog.websiteId}-${waitingInfoDialog.stageNumber}`;
                  setPendingStatusChanges(prev => {
                    const next = { ...prev };
                    delete next[stageKey];
                    return next;
                  });
                }
                setWaitingInfoDialog({
                  isOpen: false,
                  websiteId: null,
                  stageNumber: null,
                  currentWaitingInfo: "",
                  currentReminderInterval: 1,
                  sendEmail: false,
                  previousStatus: "",
                });
                setTempWaitingInfo("");
                setTempReminderInterval(1);
              }}
              data-testid="button-cancel-waiting-info"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (waitingInfoDialog.websiteId && waitingInfoDialog.stageNumber) {
                  // Clear the pending status change
                  const stageKey = `${waitingInfoDialog.websiteId}-${waitingInfoDialog.stageNumber}`;
                  setPendingStatusChanges(prev => {
                    const next = { ...prev };
                    delete next[stageKey];
                    return next;
                  });
                  
                  updateStageMutation.mutate({
                    websiteId: waitingInfoDialog.websiteId,
                    stageNumber: waitingInfoDialog.stageNumber,
                    status: 'waiting',
                    waitingInfo: tempWaitingInfo,
                    reminderInterval: tempReminderInterval,
                    sendEmail: waitingInfoDialog.sendEmail,
                  });
                  setWaitingInfoDialog({
                    isOpen: false,
                    websiteId: null,
                    stageNumber: null,
                    currentWaitingInfo: "",
                    currentReminderInterval: 1,
                    sendEmail: false,
                    previousStatus: "",
                  });
                  setTempWaitingInfo("");
                  setTempReminderInterval(1);
                }
              }}
              disabled={!tempWaitingInfo.trim()}
              data-testid="button-save-waiting-info"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!websitePendingDelete}
        onOpenChange={(open) => {
          if (!open) setWebsitePendingDelete(null);
        }}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete Website Progress</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the progress for{" "}
              {websitePendingDelete?.projectName || websitePendingDelete?.domain}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebsitePendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteWebsiteMutation.isPending}
              onClick={() => {
                if (websitePendingDelete) {
                  deleteWebsiteMutation.mutate(websitePendingDelete.id);
                  setWebsitePendingDelete(null);
                }
              }}
            >
              {deleteWebsiteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!integrationCodeDialog}
        onOpenChange={(open) => {
          if (!open) setIntegrationCodeDialog(null);
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              {integrationCodeDialog?.panel === "analytics"
                ? "Analytics integration"
                : "Newsletter integration"}
            </DialogTitle>
            <DialogDescription>{integrationCodeDialog?.domain}</DialogDescription>
          </DialogHeader>
          {integrationCodeDialog?.panel === "analytics" && (
            <AnalyticsTrackingCode
              websiteId={integrationCodeDialog.websiteId}
              domain={integrationCodeDialog.domain}
              variant="dialog"
            />
          )}
          {integrationCodeDialog?.panel === "newsletter" && (
            <NewsletterIntegrationCode
              websiteId={integrationCodeDialog.websiteId}
              domain={integrationCodeDialog.domain}
              variant="dialog"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Get Started Form Dialog */}
      <SubmissionDetailDialog
        submissionId={gsSubmission?.id ?? null}
        open={isGsDialogOpen}
        onClose={() => setIsGsDialogOpen(false)}
      />

      {/* Onboarding Form Response Dialog */}
      <Dialog open={isOnboardingDialogOpen} onOpenChange={setIsOnboardingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Details</DialogTitle>
            <DialogDescription>
              Onboarding data for this website project
            </DialogDescription>
          </DialogHeader>

          {/* Tab switcher — only rendered when both form types exist */}
          {(onboardingResponse || onboardingDialogGsSubmission) && (
            <div className="flex gap-2 border-b pb-2">
              {onboardingResponse && (
                <button
                  onClick={() => setOnboardingDialogView("onboarding")}
                  className={`text-sm px-3 py-1 rounded-t font-medium transition-colors ${
                    onboardingDialogView === "onboarding"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Onboarding Form {onboardingResponse.id ? `#${onboardingResponse.id}` : ""}
                </button>
              )}
              {onboardingDialogGsSubmission && (
                <button
                  onClick={() => setOnboardingDialogView("get-started")}
                  className={`text-sm px-3 py-1 rounded-t font-medium transition-colors ${
                    onboardingDialogView === "get-started"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Get-started Submission #{onboardingDialogGsSubmission.id}
                </button>
              )}
            </div>
          )}

          {(isLoadingOnboarding || isLoadingOnboardingGs) ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !onboardingResponse && !onboardingDialogGsSubmission ? (
            <div className="text-center py-8 text-muted-foreground">
              No form data found for this website.
            </div>
          ) : onboardingDialogView === "get-started" && onboardingDialogGsSubmission ? (
            (() => {
              const s = onboardingDialogGsSubmission;
              const Row = ({ label, field, value }: { label: string; field: string; value: unknown }) => {
                const display = formatGsValue(field, value, t);
                if (display === "—") return null;
                return <div><Label className="text-sm font-medium">{label}</Label><p className="text-sm">{display}</p></div>;
              };
              return (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Account</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Row label="Full Name" field="fullName" value={s.fullName} />
                      <Row label="Email" field="email" value={s.email} />
                      <Row label="Phone" field="contactPhone" value={s.contactPhone} />
                      <Row label="VAT Number" field="vatNumber" value={s.vatNumber} />
                      <Row label="Document Type" field="documentType" value={s.documentType} />
                      <Row label="City" field="city" value={s.city} />
                      <Row label="Street" field="street" value={s.street ? `${s.street} ${s.streetNumber ?? ""}`.trim() : null} />
                      <Row label="Postal Code" field="postalCode" value={s.postalCode} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Plan</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Row label="Selected Plan" field="selectedPlan" value={s.selectedPlan} />
                      <Row label="Billing Period" field="billingPeriod" value={s.billingPeriod} />
                      <Row label="Status" field="status" value={s.status} />
                      <Row label="Current Step" field="currentStep" value={s.currentStep} />
                      <Row label="Website Progress ID" field="websiteProgressId" value={s.websiteProgressId} />
                      <Row label="Submission ID" field="submissionId" value={s.submissionId} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Pre-checkout</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Row label="Business Type" field="businessType" value={s.businessType} />
                      <Row label="Website Goals" field="websiteGoals" value={s.websiteGoals} />
                      <Row label="Suggested Structure" field="suggestedStructure" value={s.suggestedStructure} />
                      <Row label="Suggested Addons" field="suggestedAddons" value={s.suggestedAddons} />
                      <Row label="Selected Addons" field="selectedAddons" value={s.selectedAddons} />
                      <Row label="Design Direction" field="designDirection" value={s.designDirection} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Onboarding (Steps 6–9)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Row label="Business Name" field="businessName" value={s.businessName} />
                      <Row label="Business Description" field="businessDescription" value={s.businessDescription} />
                      <Row label="Services" field="services" value={s.services} />
                      <Row label="Had Website Before" field="hadWebsiteBefore" value={s.hadWebsiteBefore} />
                      <Row label="Previous Platform" field="previousWebsitePlatform" value={s.previousWebsitePlatform} />
                      <Row label="Self Description" field="selfDescription" value={s.selfDescription} />
                      <Row label="Biggest Concerns" field="biggestConcerns" value={s.biggestConcerns} />
                      <Row label="Heard About Us" field="heardAboutUs" value={s.heardAboutUs} />
                      <Row label="Confirmed Pages" field="confirmedPages" value={s.confirmedPages} />
                      <Row label="Pages Notes" field="pagesNotes" value={s.pagesNotes} />
                      <Row label="Website Content" field="websiteContent" value={s.websiteContent} />
                      <Row label="Success Vision" field="successVision" value={s.successVision} />
                      <Row label="Media URLs" field="mediaUrls" value={s.mediaUrls?.length ? `${s.mediaUrls.length} file(s)` : null} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Meta</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Row label="Session ID" field="sessionId" value={s.sessionId} />
                      <Row label="Language" field="websiteLanguage" value={s.websiteLanguage} />
                      <Row label="Created At" field="createdAt" value={s.createdAt ? new Date(s.createdAt).toLocaleString() : null} />
                      <Row label="Updated At" field="updatedAt" value={s.updatedAt ? new Date(s.updatedAt).toLocaleString() : null} />
                    </div>
                  </div>
                </div>
              );
            })()
          ) : onboardingResponse ? (
            <div className="space-y-6">
              {/* Business Information */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Business Name</Label>
                    <p className="text-sm">{onboardingResponse.businessName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Contact Name</Label>
                    <p className="text-sm">{onboardingResponse.contactName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Contact Phone</Label>
                    <p className="text-sm">{onboardingResponse.contactPhone}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Contact Email</Label>
                    <p className="text-sm">{onboardingResponse.contactEmail}</p>
                  </div>
                  {onboardingResponse.accountEmail && (
                    <div>
                      <Label className="text-sm font-medium">Account Email</Label>
                      <p className="text-sm">{onboardingResponse.accountEmail}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Website Language</Label>
                    <p className="text-sm">
                      {onboardingResponse.websiteLanguage === 'en' ? 'English' : 
                       onboardingResponse.websiteLanguage === 'gr' ? 'Greek' : 
                       onboardingResponse.websiteLanguage || 'Not specified'}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-sm font-medium">Business Description</Label>
                  <p className="text-sm">{onboardingResponse.businessDescription}</p>
                </div>
              </div>

              {/* Domain Details */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Domain Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Has Domain</Label>
                    <p className="text-sm">{formatOnboardingValue('hasDomain', onboardingResponse.hasDomain, t)}</p>
                  </div>
                  {onboardingResponse.existingDomain && (
                    <div>
                      <Label className="text-sm font-medium">Existing Domain</Label>
                      <p className="text-sm">{onboardingResponse.existingDomain}</p>
                    </div>
                  )}
                  {onboardingResponse.domainAccess && (
                    <div>
                      <Label className="text-sm font-medium">Domain Access</Label>
                      <p className="text-sm">{onboardingResponse.domainAccess}</p>
                    </div>
                  )}
                  {onboardingResponse.domainConnectionPreference && (
                    <div>
                      <Label className="text-sm font-medium">Domain Connection Preference</Label>
                      <p className="text-sm">{formatOnboardingValue('domainConnectionPreference', onboardingResponse.domainConnectionPreference, t)}</p>
                    </div>
                  )}
                  {onboardingResponse.domainPurchasePreference && (
                    <div>
                      <Label className="text-sm font-medium">Domain Purchase Preference</Label>
                      <p className="text-sm">{formatOnboardingValue('domainPurchasePreference', onboardingResponse.domainPurchasePreference, t)}</p>
                    </div>
                  )}
                  {onboardingResponse.preferredDomains && (
                    <div>
                      <Label className="text-sm font-medium">Preferred Domains</Label>
                      <p className="text-sm">{onboardingResponse.preferredDomains}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Emails */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Professional Emails</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Has Professional Emails</Label>
                    <p className="text-sm">{formatOnboardingValue('hasEmails', onboardingResponse.hasEmails, t)}</p>
                  </div>
                  {onboardingResponse.emailProvider && (
                    <div>
                      <Label className="text-sm font-medium">Email Provider</Label>
                      <p className="text-sm">{onboardingResponse.emailProvider}</p>
                    </div>
                  )}
                  {onboardingResponse.emailAccess && (
                    <div>
                      <Label className="text-sm font-medium">Email Access</Label>
                      <p className="text-sm">{onboardingResponse.emailAccess}</p>
                    </div>
                  )}
                  {onboardingResponse.existingEmails && (
                    <div>
                      <Label className="text-sm font-medium">Existing Emails</Label>
                      <p className="text-sm">{onboardingResponse.existingEmails}</p>
                    </div>
                  )}
                  {onboardingResponse.emailCount && (
                    <div>
                      <Label className="text-sm font-medium">Email Count</Label>
                      <p className="text-sm">{onboardingResponse.emailCount}</p>
                    </div>
                  )}
                  {onboardingResponse.emailNames && (
                    <div>
                      <Label className="text-sm font-medium">Email Names</Label>
                      <p className="text-sm whitespace-pre-line">{onboardingResponse.emailNames}</p>
                    </div>
                  )}
                  {onboardingResponse.emailRedirect && (
                    <div>
                      <Label className="text-sm font-medium">Email Redirect</Label>
                      <p className="text-sm">{formatOnboardingValue('emailRedirect', onboardingResponse.emailRedirect, t)}</p>
                    </div>
                  )}
                  {onboardingResponse.redirectInboxAddress && (
                    <div>
                      <Label className="text-sm font-medium">Redirect Inbox Address</Label>
                      <p className="text-sm">{onboardingResponse.redirectInboxAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Website Foundation */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Website Foundation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Has Existing Website</Label>
                    <p className="text-sm">{formatOnboardingValue('hasWebsite', onboardingResponse.hasWebsite, t)}</p>
                  </div>
                  {onboardingResponse.websiteLink && (
                    <div>
                      <Label className="text-sm font-medium">Website Link</Label>
                      <p className="text-sm">{onboardingResponse.websiteLink}</p>
                    </div>
                  )}
                  {onboardingResponse.websiteChanges && (
                    <div>
                      <Label className="text-sm font-medium">Website Changes</Label>
                      <p className="text-sm">{onboardingResponse.websiteChanges}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Has Text Content</Label>
                    <p className="text-sm">{formatOnboardingValue('hasTextContent', onboardingResponse.hasTextContent, t)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Has Media Content</Label>
                    <p className="text-sm">{formatOnboardingValue('hasMediaContent', onboardingResponse.hasMediaContent, t)}</p>
                  </div>
                  {onboardingResponse.notSurePages !== undefined && (
                    <div>
                      <Label className="text-sm font-medium">Not Sure About Pages</Label>
                      <p className="text-sm">{formatOnboardingValue('notSurePages', onboardingResponse.notSurePages, t)}</p>
                    </div>
                  )}
                </div>
                {onboardingResponse.wantedPages && onboardingResponse.wantedPages.length > 0 && (
                  <div className="mt-3">
                    <Label className="text-sm font-medium">Wanted Pages</Label>
                    <p className="text-sm">{onboardingResponse.wantedPages.join(', ')}</p>
                  </div>
                )}
              </div>

              {/* Design Preferences */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Design Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  {onboardingResponse.businessLogoUrl && (
                    <div>
                      <Label className="text-sm font-medium">Business Logo</Label>
                      <img 
                        src={onboardingResponse.businessLogoUrl} 
                        alt="Business Logo" 
                        className="w-32 h-32 object-contain border rounded"
                      />
                      {onboardingResponse.businessLogoName && (
                        <p className="text-xs text-muted-foreground mt-1">{onboardingResponse.businessLogoName}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Create Text Logo</Label>
                    <p className="text-sm">{formatOnboardingValue('createTextLogo', onboardingResponse.createTextLogo, t)}</p>
                  </div>
                  {onboardingResponse.colorPalette && (
                    <div>
                      <Label className="text-sm font-medium">Color Palette</Label>
                      <p className="text-sm">{onboardingResponse.colorPalette}</p>
                    </div>
                  )}
                  {onboardingResponse.preferredFonts && (
                    <div>
                      <Label className="text-sm font-medium">Preferred Fonts</Label>
                      <p className="text-sm">{onboardingResponse.preferredFonts}</p>
                    </div>
                  )}
                  {onboardingResponse.siteStyle && (
                    <div>
                      <Label className="text-sm font-medium">Site Style</Label>
                      <p className="text-sm">{formatOnboardingValue('siteStyle', onboardingResponse.siteStyle, t)}</p>
                    </div>
                  )}
                  {onboardingResponse.selectedTemplateId && (
                    <div>
                      <Label className="text-sm font-medium">Selected Template</Label>
                      <p className="text-sm">
                        {ENVATO_TEMPLATES.find(t => t.id === onboardingResponse.selectedTemplateId)?.name || `Template ID: ${onboardingResponse.selectedTemplateId}`}
                      </p>
                    </div>
                  )}
                  {onboardingResponse.customTemplateRequest && (
                    <div>
                      <Label className="text-sm font-medium">Custom Template Request</Label>
                      <p className="text-sm">{onboardingResponse.customTemplateRequest}</p>
                    </div>
                  )}
                </div>
                {onboardingResponse.inspirationWebsites && onboardingResponse.inspirationWebsites.length > 0 && onboardingResponse.inspirationWebsites.some(site => site.trim()) && (
                  <div className="mt-3">
                    <Label className="text-sm font-medium">Inspiration Websites</Label>
                    <p className="text-sm">{onboardingResponse.inspirationWebsites.filter(site => site.trim()).join(', ')}</p>
                  </div>
                )}
              </div>

              {/* Social Media */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Social Media</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Has Social Media</Label>
                    <p className="text-sm">{formatOnboardingValue('hasSocialMedia', onboardingResponse.hasSocialMedia, t)}</p>
                  </div>
                  {onboardingResponse.facebookLink && (
                    <div>
                      <Label className="text-sm font-medium">Facebook</Label>
                      <p className="text-sm">{onboardingResponse.facebookLink}</p>
                    </div>
                  )}
                  {onboardingResponse.instagramLink && (
                    <div>
                      <Label className="text-sm font-medium">Instagram</Label>
                      <p className="text-sm">{onboardingResponse.instagramLink}</p>
                    </div>
                  )}
                  {onboardingResponse.linkedinLink && (
                    <div>
                      <Label className="text-sm font-medium">LinkedIn</Label>
                      <p className="text-sm">{onboardingResponse.linkedinLink}</p>
                    </div>
                  )}
                  {onboardingResponse.tiktokLink && (
                    <div>
                      <Label className="text-sm font-medium">TikTok</Label>
                      <p className="text-sm">{onboardingResponse.tiktokLink}</p>
                    </div>
                  )}
                  {onboardingResponse.youtubeLink && (
                    <div>
                      <Label className="text-sm font-medium">YouTube</Label>
                      <p className="text-sm">{onboardingResponse.youtubeLink}</p>
                    </div>
                  )}
                  {onboardingResponse.otherSocialLinks && (
                    <div>
                      <Label className="text-sm font-medium">Other Social Links</Label>
                      <p className="text-sm">{onboardingResponse.otherSocialLinks}</p>
                    </div>
                  )}
                  {onboardingResponse.logoDesignService && (
                    <div>
                      <Label className="text-sm font-medium">Logo Design Service</Label>
                      <p className="text-sm">{formatOnboardingValue('logoDesignService', onboardingResponse.logoDesignService, t)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Practical Information */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Practical Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {onboardingResponse.projectDeadline && (
                    <div>
                      <Label className="text-sm font-medium">Project Deadline</Label>
                      <p className="text-sm">{onboardingResponse.projectDeadline}</p>
                    </div>
                  )}
                </div>
                {onboardingResponse.additionalNotes && (
                  <div className="mt-3">
                    <Label className="text-sm font-medium">Additional Notes</Label>
                    <p className="text-sm">{onboardingResponse.additionalNotes}</p>
                  </div>
                )}
              </div>

              {/* Submission Details */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Submission Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Submission ID</Label>
                    <p className="text-sm font-mono">{onboardingResponse.submissionId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-sm">{formatOnboardingValue('status', onboardingResponse.status, t) || t("common.notAvailable")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Submitted At</Label>
                    <p className="text-sm">{onboardingResponse.createdAt ? new Date(onboardingResponse.createdAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setIsOnboardingDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}