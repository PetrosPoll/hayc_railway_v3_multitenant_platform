import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Plus, Loader2, TrendingUp, Users, Calendar, BarChart3, Copy, Edit, X, Search, ArrowUpDown, Trash2 } from "lucide-react";
import { CampaignWizard } from "@/components/CampaignWizard";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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

interface CampaignsListProps {
  websiteProgressId: number;
  planSubscription?: any;
}

export function CampaignsList({ websiteProgressId, planSubscription }: CampaignsListProps) {
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const disabled = planSubscription?.status !== "active";

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/newsletter/campaigns", websiteProgressId],
    queryFn: async () => {
      const response = await fetch(`/api/newsletter/campaigns?websiteProgressId=${websiteProgressId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      const data = await response.json();
      console.log('[CampaignsList] Fetched campaigns:', data.map((c: any) => ({ id: c.id, title: c.title, tagIds: c.tagIds })));
      return data;
    },
    enabled: !!websiteProgressId,
  });

  // Fetch tags to display tag names
  const { data: tags = [] } = useQuery<any[]>({
    queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`],
    enabled: !!websiteProgressId,
  });

  const filteredAndSortedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    let result = campaigns.filter(campaign => {
      // Status filter
      if (statusFilter !== "all" && campaign.status !== statusFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          campaign.title?.toLowerCase().includes(query) ||
          campaign.subject?.toLowerCase().includes(query) ||
          campaign.description?.toLowerCase().includes(query)
        );
      }
      return true;
    });
    
    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "date-asc":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "title-asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title-desc":
          return (b.title || "").localeCompare(a.title || "");
        case "opens-desc":
          return (b.openCount || 0) - (a.openCount || 0);
        case "clicks-desc":
          return (b.clickCount || 0) - (a.clickCount || 0);
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
    
    return result;
  }, [campaigns, statusFilter, searchQuery, sortBy]);

  const filteredCampaigns = filteredAndSortedCampaigns;

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return await apiRequest("POST", `/api/newsletter/campaigns/${campaignId}/send`, {
        websiteProgressId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
      toast({
        title: "Campaign sent successfully",
        description: "Your campaign has been sent to all recipients.",
      });
      setSendingCampaignId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send campaign",
        description: error.message || "An error occurred while sending the campaign.",
        variant: "destructive",
      });
      setSendingCampaignId(null);
    },
  });

  // Duplicate campaign mutation
  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return await apiRequest("POST", `/api/newsletter/campaigns/${campaignId}/duplicate`, {
        websiteProgressId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
      toast({
        title: "Campaign duplicated",
        description: "A copy of the campaign has been created as a draft.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to duplicate campaign",
        description: error.message || "An error occurred while duplicating the campaign.",
        variant: "destructive",
      });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return await apiRequest("DELETE", `/api/newsletter/campaigns/${campaignId}?websiteProgressId=${websiteProgressId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
      toast({
        title: "Campaign deleted",
        description: "The campaign has been permanently deleted.",
      });
      setDeletingCampaignId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete campaign",
        description: error.message || "An error occurred while deleting the campaign.",
        variant: "destructive",
      });
      setDeletingCampaignId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (campaignIds: number[]) => {
      return await apiRequest("POST", "/api/newsletter/campaigns/bulk-delete", { 
        campaignIds,
        websiteProgressId 
      });
    },
    onSuccess: (_, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
      setSelectedCampaigns(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: "Campaigns deleted",
        description: `${deletedIds.length} campaign(s) have been deleted.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete campaigns",
        description: error.message || "An error occurred while deleting the campaigns.",
        variant: "destructive",
      });
    },
  });

  const handleSelectCampaign = (campaignId: number, checked: boolean) => {
    setSelectedCampaigns(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(campaignId);
      } else {
        newSet.delete(campaignId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredCampaigns.map(c => c.id);
      setSelectedCampaigns(new Set(allIds));
    } else {
      setSelectedCampaigns(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedCampaigns.size > 0) {
      setShowBulkDeleteDialog(true);
    }
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedCampaigns));
  };

  const handleViewAnalytics = (campaignId: number) => {
    navigate(`/websites/${websiteProgressId}/campaigns/${campaignId}/analytics`);
  };

  const handleSendCampaign = (campaignId: number) => {
    setSendingCampaignId(campaignId);
  };

  const handleEditCampaign = (campaign: any) => {
    setEditingCampaign(campaign);
    setShowCampaignWizard(true);
  };

  const handleDuplicateCampaign = (campaignId: number) => {
    duplicateCampaignMutation.mutate(campaignId);
  };

  const handleDeleteCampaign = (campaignId: number) => {
    setDeletingCampaignId(campaignId);
  };

  const confirmDeleteCampaign = () => {
    if (deletingCampaignId) {
      deleteCampaignMutation.mutate(deletingCampaignId);
    }
  };

  const handleCancelSchedule = async (campaignId: number) => {
    if (!window.confirm('Are you sure you want to cancel the schedule? The campaign will be saved as a draft.')) {
      return;
    }

    try {
      const response = await apiRequest('PUT', `/api/newsletter/campaigns/${campaignId}`, {
        status: 'draft',
        scheduledFor: null,
        websiteProgressId,
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
        toast({
          title: 'Schedule cancelled',
          description: 'Campaign has been moved back to drafts',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to cancel schedule',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel schedule',
        variant: 'destructive',
      });
    }
  };

  const confirmSendCampaign = () => {
    if (sendingCampaignId) {
      sendCampaignMutation.mutate(sendingCampaignId);
    }
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'sending':
        return 'secondary';
      case 'scheduled':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getCampaignTags = (tagIds: number[] | null) => {
    if (!tagIds || tagIds.length === 0) {
      console.log('[getCampaignTags] No tagIds provided:', tagIds);
      return [];
    }
    const matchedTags = tags.filter(tag => tagIds.includes(tag.id));
    console.log('[getCampaignTags] tagIds:', tagIds, 'available tags:', tags.length, 'matched:', matchedTags.length);
    return matchedTags;
  };

  const renderCampaignCard = (campaign: any) => (
    <Card key={campaign.id} className="hover:shadow-md transition-shadow" data-testid={`campaign-card-${campaign.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={selectedCampaigns.has(campaign.id)}
              onCheckedChange={(checked) => handleSelectCampaign(campaign.id, checked as boolean)}
              className="mt-1"
              data-testid={`campaign-checkbox-${campaign.id}`}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold" data-testid={`campaign-title-${campaign.id}`}>
                  {campaign.title}
                </h3>
                <Badge variant={getCampaignStatusColor(campaign.status)} data-testid={`campaign-status-${campaign.id}`}>
                  {t(`dashboard.campaigns.status.${campaign.status}`)}
                </Badge>
              </div>
              {campaign.description && (
                <p className="text-sm text-muted-foreground mb-3" data-testid={`campaign-description-${campaign.id}`}>
                  {campaign.description}
                </p>
              )}
              {campaign.tagIds && campaign.tagIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {getCampaignTags(campaign.tagIds).map(tag => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
                      data-testid={`campaign-tag-${campaign.id}-${tag.id}`}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.campaigns.card.recipients")}</p>
              <p className="text-sm font-medium" data-testid={`campaign-recipients-${campaign.id}`}>
                {campaign.recipientCount || 0}
              </p>
            </div>
          </div>

          {campaign.status === "sent" && (
            <>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.campaigns.card.opens")}</p>
                  <p className="text-sm font-medium" data-testid={`campaign-opens-${campaign.id}`}>
                    {campaign.openCount || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.campaigns.card.clicks")}</p>
                  <p className="text-sm font-medium" data-testid={`campaign-clicks-${campaign.id}`}>
                    {campaign.clickCount || 0}
                  </p>
                </div>
              </div>
            </>
          )}

          {campaign.scheduledFor && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.campaigns.card.scheduled")}</p>
                <p className="text-sm font-medium" data-testid={`campaign-scheduled-${campaign.id}`}>
                  {new Date(campaign.scheduledFor).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          )}

          {campaign.sentAt && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.campaigns.card.sent")}</p>
                <p className="text-sm font-medium" data-testid={`campaign-sent-date-${campaign.id}`}>
                  {new Date(campaign.sentAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {campaign.status === "sent" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewAnalytics(campaign.id)}
              className="flex-1"
              data-testid={`button-view-analytics-${campaign.id}`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {t("dashboard.campaigns.card.viewAnalytics")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDuplicateCampaign(campaign.id)}
              disabled={duplicateCampaignMutation.isPending}
              className="flex-1"
              data-testid={`button-duplicate-sent-${campaign.id}`}
            >
              {duplicateCampaignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {t("dashboard.campaigns.card.duplicate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteCampaign(campaign.id)}
              disabled={deleteCampaignMutation.isPending}
              data-testid={`button-delete-sent-${campaign.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {campaign.status === "draft" && (
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleSendCampaign(campaign.id)}
              disabled={sendCampaignMutation.isPending}
              className="flex-1"
              data-testid={`button-send-draft-${campaign.id}`}
            >
              {sendCampaignMutation.isPending && sendingCampaignId === campaign.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {t("dashboard.campaigns.card.send")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDuplicateCampaign(campaign.id)}
              disabled={duplicateCampaignMutation.isPending}
              className="flex-1"
              data-testid={`button-duplicate-draft-${campaign.id}`}
            >
              {duplicateCampaignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {t("dashboard.campaigns.card.duplicate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditCampaign(campaign)}
              className="flex-1"
              data-testid={`button-edit-draft-${campaign.id}`}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("dashboard.campaigns.card.edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteCampaign(campaign.id)}
              disabled={deleteCampaignMutation.isPending}
              data-testid={`button-delete-draft-${campaign.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {campaign.status === "scheduled" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditCampaign(campaign)}
              className="flex-1"
              data-testid={`button-edit-scheduled-${campaign.id}`}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("dashboard.campaigns.card.edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelSchedule(campaign.id)}
              className="flex-1"
              data-testid={`button-cancel-schedule-${campaign.id}`}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Schedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteCampaign(campaign.id)}
              disabled={deleteCampaignMutation.isPending}
              data-testid={`button-delete-scheduled-${campaign.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {campaign.status === "sending" && (
          <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("dashboard.campaigns.sendDialog.sending")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );


  const renderEmptyState = () => {
    const messages = {
      all: "No campaigns yet. Create your first campaign to get started.",
      draft: "No draft campaigns. Create a new campaign to begin.",
      scheduled: "No scheduled campaigns. Schedule a campaign to see it here.",
      sent: "No sent campaigns yet. Send a campaign to see analytics here."
    };

    return (
      <div className="text-center py-12" data-testid="empty-state">
        <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg mb-2">
          {messages[statusFilter as keyof typeof messages] || messages.all}
        </p>
      </div>
    );
  };

  if (campaignsLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="campaigns-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`} data-testid="campaigns-list">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="campaigns-title">
            {t("dashboard.campaigns.title")}
          </h2>
          <p className="text-muted-foreground" data-testid="campaigns-description">
            {t("dashboard.campaigns.description")}
          </p>
        </div>
        <Button onClick={() => setShowCampaignWizard(true)} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-2" />
          {t("dashboard.campaigns.createButton")}
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setSelectedCampaigns(new Set()); }} data-testid="campaigns-tabs">
        <TabsList className="grid w-full grid-cols-4" data-testid="campaigns-tabs-list">
          <TabsTrigger value="all" data-testid="tab-all">
            {t("dashboard.campaigns.tabs.all")} ({campaigns?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-draft">
            {t("dashboard.campaigns.tabs.draft")} ({campaigns?.filter(c => c.status === "draft").length || 0})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            {t("dashboard.campaigns.tabs.scheduled")} ({campaigns?.filter(c => c.status === "scheduled").length || 0})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            {t("dashboard.campaigns.tabs.sent")} ({campaigns?.filter(c => c.status === "sent").length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4 mt-4" data-testid={`tab-content-${statusFilter}`}>
          {filteredCampaigns.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid="campaigns-filters">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredCampaigns.length > 0 && filteredCampaigns.every(c => selectedCampaigns.has(c.id))}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  data-testid="select-all-checkbox"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedCampaigns.size > 0 
                    ? `${selectedCampaigns.size} ${t("dashboard.campaigns.selected") || "selected"}` 
                    : t("dashboard.campaigns.selectAll") || "Select all"}
                </span>
              </div>
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("dashboard.campaigns.searchPlaceholder") || "Search campaigns..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-campaigns"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-sort-campaigns">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">{t("dashboard.campaigns.sort.newestFirst") || "Newest First"}</SelectItem>
                  <SelectItem value="date-asc">{t("dashboard.campaigns.sort.oldestFirst") || "Oldest First"}</SelectItem>
                  <SelectItem value="title-asc">{t("dashboard.campaigns.sort.titleAZ") || "Title (A-Z)"}</SelectItem>
                  <SelectItem value="title-desc">{t("dashboard.campaigns.sort.titleZA") || "Title (Z-A)"}</SelectItem>
                  <SelectItem value="opens-desc">{t("dashboard.campaigns.sort.mostOpens") || "Most Opens"}</SelectItem>
                  <SelectItem value="clicks-desc">{t("dashboard.campaigns.sort.mostClicks") || "Most Clicks"}</SelectItem>
                </SelectContent>
              </Select>
              {selectedCampaigns.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="bulk-delete-button"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {t("dashboard.campaigns.delete") || "Delete"} ({selectedCampaigns.size})
                </Button>
              )}
            </div>
          )}
          {filteredCampaigns.length > 0 ? (
            <div className="grid gap-4">{filteredCampaigns.map(renderCampaignCard)}</div>
          ) : (
            renderEmptyState()
          )}
        </TabsContent>
      </Tabs>

      <CampaignWizard
        open={showCampaignWizard}
        onClose={() => {
          setShowCampaignWizard(false);
          setEditingCampaign(null);
        }}
        websiteProgressId={websiteProgressId}
        editingCampaign={editingCampaign}
        onSuccess={() => {
          setShowCampaignWizard(false);
          setEditingCampaign(null);
          queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns", websiteProgressId] });
          toast({
            title: editingCampaign ? t("dashboard.campaigns.toast.updatedTitle") : t("dashboard.campaigns.toast.createdTitle"),
            description: editingCampaign ? t("dashboard.campaigns.toast.updatedDescription") : t("dashboard.campaigns.toast.createdDescription"),
          });
        }}
      />

      <AlertDialog
        open={sendingCampaignId !== null}
        onOpenChange={(open) => {
          if (!open && !sendCampaignMutation.isPending) setSendingCampaignId(null);
        }}
      >
        <AlertDialogContent data-testid="send-campaign-dialog">
          {sendCampaignMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="relative mb-6">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <AlertDialogTitle className="text-xl">
                {t("dashboard.campaigns.sendDialog.sendingTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-base">
                {t("dashboard.campaigns.sendDialog.sendingDescription")}
              </AlertDialogDescription>
              {sendingCampaignId && (() => {
                const campaign = campaigns?.find((c) => c.id === sendingCampaignId);
                const count = campaign?.recipientCount;
                if (count !== undefined && count > 0) {
                  return (
                    <p className="mt-4 text-sm font-medium text-muted-foreground">
                      {t("dashboard.campaigns.sendDialog.sendingToRecipients", { count })}
                    </p>
                  );
                }
                return null;
              })()}
              <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Sending campaign">
                <div
                  className="h-full w-1/3 rounded-full bg-primary"
                  style={{ animation: "progress-indeterminate 1.5s ease-in-out infinite" }}
                />
              </div>
            </div>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("dashboard.campaigns.sendDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("dashboard.campaigns.sendDialog.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="cancel-send-campaign">
                  {t("dashboard.campaigns.sendDialog.cancel")}
                </AlertDialogCancel>
                <Button
                  onClick={confirmSendCampaign}
                  data-testid="confirm-send-campaign"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t("dashboard.campaigns.sendDialog.confirm")}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingCampaignId !== null} onOpenChange={(open) => !open && setDeletingCampaignId(null)}>
        <AlertDialogContent data-testid="delete-campaign-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-campaign">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCampaign}
              disabled={deleteCampaignMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-campaign"
            >
              {deleteCampaignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent data-testid="bulk-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.campaigns.bulkDeleteDialog.title") || "Delete Campaigns"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.campaigns.bulkDeleteDialog.description", { count: selectedCampaigns.size }) || 
                `Are you sure you want to delete ${selectedCampaigns.size} campaign(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-bulk-delete">
              {t("dashboard.campaigns.bulkDeleteDialog.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("dashboard.campaigns.bulkDeleteDialog.deleting") || "Deleting..."}
                </>
              ) : (
                t("dashboard.campaigns.bulkDeleteDialog.confirm") || "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}