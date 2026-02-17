import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Plus, Trash2, FileText, Pencil, Copy, Mail, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import { OnboardingFormResponse } from "@shared/schema"
import { ENVATO_TEMPLATES } from "@/data/envato-templates"
import { formatOnboardingValue } from "@/lib/onboarding-formatters"


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
}

type User = {
  id: number
  email: string
  username: string
}

function QuickCopyAnalyticsButton({ websiteId }: { websiteId: number }) {
  const [copied, setCopied] = useState(false);

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/analytics/keys", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/keys/${websiteId}`);
      if (!response.ok) throw new Error("Failed to fetch analytics key");
      return response.json();
    },
  });

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (analyticsData?.trackingScript) {
      navigator.clipboard.writeText(analyticsData.trackingScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ description: "Analytics tracking code copied to clipboard!" });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 p-0"
      onClick={copyToClipboard}
      disabled={!analyticsData}
      data-testid={`button-copy-analytics-${websiteId}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

function AnalyticsTrackingCode({ websiteId, domain }: { websiteId: number; domain: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

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
      <div className="mt-6 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-semibold text-lg mb-2">
          Analytics Tracking Code
        </h3>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading tracking code...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) return null;

  return (
    <div className="mt-6 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">
          Analytics Tracking Code
        </h3>
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
      </div>
      
      <div className="space-y-3">
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
    </div>
  );
}

function NewsletterIntegrationCode({ websiteId, domain }: { websiteId: number; domain: string }) {
  const [copied, setCopied] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

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
      <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
        <h3 className="font-semibold text-lg mb-2">
          Newsletter Integration
        </h3>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading integration code...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) return null;

  return (
    <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Newsletter Integration
        </h3>
      </div>
      
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
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null)
  const [editedDomainValue, setEditedDomainValue] = useState("")
  const [sortByProgress, setSortByProgress] = useState<"asc" | "desc" | null>(null)
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

  if (isLoading) return <div>Loading...</div>

  const filteredWebsites = websites
    .filter(w => !selectedUser || w.userId === selectedUser)
    .filter(w => !filterWaitingOnly || (w.stages?.some(s => s.status === 'waiting') ?? false))
  
  // Apply sorting by completion percentage if active
  const userWebsites = sortByProgress 
    ? [...filteredWebsites].sort((a, b) => {
        const aCompleted = a.stages.filter(s => s.status === 'completed').length
        const aTotal = a.stages.length || 1
        const aProgress = (aCompleted / aTotal) * 100
        
        const bCompleted = b.stages.filter(s => s.status === 'completed').length
        const bTotal = b.stages.length || 1
        const bProgress = (bCompleted / bTotal) * 100
        
        return sortByProgress === "asc" ? aProgress - bProgress : bProgress - aProgress
      })
    : filteredWebsites
  
  const handleProgressSort = () => {
    if (!sortByProgress) {
      setSortByProgress("asc")
    } else if (sortByProgress === "asc") {
      setSortByProgress("desc")
    } else {
      setSortByProgress(null)
    }
  }

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
                <div className="flex items-center justify-between w-full mr-4">
                  <div className="flex items-center gap-3">
                    {editingDomainId === website.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                      <>
                        <div className="font-semibold text-lg">
                          {website.projectName || website.domain}
                        </div>
                        {/* {userPermissions?.canManageWebsites && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDomainId(website.id);
                              setEditedDomainValue(website.domain);
                            }}
                            data-testid={`button-edit-domain-${website.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )} */}
                      </>
                    )}
                    <div className="text-sm text-muted-foreground">
                      ({website.userEmail})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {website.onboardingStatus && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        website.onboardingStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        website.onboardingStatus === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {website.onboardingStatus}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progress)}% completed
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-blue-600 hover:text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWebsiteId(website.id)
                        setIsOnboardingDialogOpen(true)
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <QuickCopyAnalyticsButton websiteId={website.id} />
                    {userPermissions?.canManageWebsites && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        title="Show Booking button on website dashboard for this project"
                      >
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Booking</span>
                        <Switch
                          checked={website.bookingEnabled ?? false}
                          onCheckedChange={(checked) => {
                            updateBookingMutation.mutate({ websiteId: website.id, bookingEnabled: !!checked });
                          }}
                          disabled={updateBookingMutation.isPending}
                          data-testid={`switch-booking-${website.id}`}
                        />
                      </div>
                    )}
                    {userPermissions?.canManageWebsites && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Website Progress</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete the progress for {website.projectName || website.domain}? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => document.querySelector('dialog')?.close()}>
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                deleteWebsiteMutation.mutate(website.id)
                                document.querySelector('dialog')?.close()
                              }}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
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

                {/* Analytics Tracking Code Section */}
                <AnalyticsTrackingCode websiteId={website.id} domain={website.domain} />

                {/* Newsletter Integration Section */}
                <NewsletterIntegrationCode websiteId={website.id} domain={website.domain} />

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

      {/* Onboarding Form Response Dialog */}
      <Dialog open={isOnboardingDialogOpen} onOpenChange={setIsOnboardingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Form Details</DialogTitle>
            <DialogDescription>
              Complete onboarding form submission details for this website project
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingOnboarding ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !onboardingResponse ? (
            <div className="text-center py-8 text-muted-foreground">
              No onboarding form response found for this website.
            </div>
          ) : (
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
                    <p className="text-sm">{formatOnboardingValue('hasDomain', onboardingResponse.hasDomain)}</p>
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
                      <p className="text-sm">{formatOnboardingValue('domainConnectionPreference', onboardingResponse.domainConnectionPreference)}</p>
                    </div>
                  )}
                  {onboardingResponse.domainPurchasePreference && (
                    <div>
                      <Label className="text-sm font-medium">Domain Purchase Preference</Label>
                      <p className="text-sm">{formatOnboardingValue('domainPurchasePreference', onboardingResponse.domainPurchasePreference)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('hasEmails', onboardingResponse.hasEmails)}</p>
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
                      <p className="text-sm">{formatOnboardingValue('emailRedirect', onboardingResponse.emailRedirect)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('hasWebsite', onboardingResponse.hasWebsite)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('hasTextContent', onboardingResponse.hasTextContent)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Has Media Content</Label>
                    <p className="text-sm">{formatOnboardingValue('hasMediaContent', onboardingResponse.hasMediaContent)}</p>
                  </div>
                  {onboardingResponse.notSurePages !== undefined && (
                    <div>
                      <Label className="text-sm font-medium">Not Sure About Pages</Label>
                      <p className="text-sm">{formatOnboardingValue('notSurePages', onboardingResponse.notSurePages)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('createTextLogo', onboardingResponse.createTextLogo)}</p>
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
                      <p className="text-sm">{formatOnboardingValue('siteStyle', onboardingResponse.siteStyle)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('hasSocialMedia', onboardingResponse.hasSocialMedia)}</p>
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
                      <p className="text-sm">{formatOnboardingValue('logoDesignService', onboardingResponse.logoDesignService)}</p>
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
                    <p className="text-sm">{formatOnboardingValue('status', onboardingResponse.status) || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Submitted At</Label>
                    <p className="text-sm">{onboardingResponse.createdAt ? new Date(onboardingResponse.createdAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setIsOnboardingDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}