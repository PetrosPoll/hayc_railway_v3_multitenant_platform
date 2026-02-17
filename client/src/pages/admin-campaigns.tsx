import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Plus, Loader2, TrendingUp, Users, Calendar, BarChart3, Copy, Edit, X, ArrowLeft, Trash2 } from "lucide-react";
import { AdminCampaignWizard } from "@/components/AdminCampaignWizard";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

export default function AdminCampaigns() {
  const { t } = useTranslation();
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/newsletter/campaigns"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/newsletter/campaigns`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      const data = await response.json();
      console.log('[AdminCampaigns] Fetched campaigns:', data.map((c: any) => ({ id: c.id, title: c.title, tagIds: c.tagIds })));
      return data;
    },
  });

  // Fetch admin tags to display tag names
  const { data: tags = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tags"],
    queryFn: async () => {
      const response = await fetch("/api/admin/tags", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    },
  });

  const filteredCampaigns = campaigns?.filter(campaign => {
    if (statusFilter === "all") return true;
    return campaign.status === statusFilter;
  }) || [];

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return await apiRequest("POST", `/api/admin/newsletter/campaigns/${campaignId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/campaigns"] });
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
    mutationFn: async (campaign: any) => {
      const duplicateData = {
        ...campaign,
        title: `${campaign.title} (Copy)`,
        status: "draft",
        sentAt: null,
        scheduledFor: null,
      };
      delete duplicateData.id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      delete duplicateData.recipientCount;
      delete duplicateData.openCount;
      delete duplicateData.clickCount;

      return await apiRequest("POST", "/api/admin/newsletter/campaigns", duplicateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/campaigns"] });
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (campaignIds: number[]) => {
      return await apiRequest("POST", "/api/admin/newsletter/campaigns/bulk-delete", { campaignIds });
    },
    onSuccess: (_, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/campaigns"] });
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
    navigate(`/admin/campaigns/${campaignId}/analytics`);
  };

  const handleSendCampaign = (campaignId: number) => {
    setSendingCampaignId(campaignId);
  };

  const handleEditCampaign = (campaign: any) => {
    setEditingCampaign(campaign);
    setShowCampaignWizard(true);
  };

  const handleDuplicateCampaign = (campaign: any) => {
    duplicateCampaignMutation.mutate(campaign);
  };

  const handleCancelSchedule = async (campaignId: number) => {
    if (!window.confirm('Are you sure you want to cancel the schedule? The campaign will be saved as a draft.')) {
      return;
    }

    try {
      const response = await apiRequest('PUT', `/api/admin/newsletter/campaigns/${campaignId}`, {
        status: 'draft',
        scheduledFor: null,
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/campaigns"] });
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
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
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
              <p className="text-xs text-muted-foreground">Recipients</p>
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
                  <p className="text-xs text-muted-foreground">Opens</p>
                  <p className="text-sm font-medium" data-testid={`campaign-opens-${campaign.id}`}>
                    {campaign.openCount || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Clicks</p>
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
                <p className="text-xs text-muted-foreground">Scheduled</p>
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
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-sm font-medium" data-testid={`campaign-sent-date-${campaign.id}`}>
                  {new Date(campaign.sentAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {campaign.status === "sent" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewAnalytics(campaign.id)}
            className="w-full"
            data-testid={`button-view-analytics-${campaign.id}`}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
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
              Send
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDuplicateCampaign(campaign)}
              disabled={duplicateCampaignMutation.isPending}
              className="flex-1"
              data-testid={`button-duplicate-draft-${campaign.id}`}
            >
              {duplicateCampaignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditCampaign(campaign)}
              className="flex-1"
              data-testid={`button-edit-draft-${campaign.id}`}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
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
              Edit
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
    <div className="container mx-auto py-8 mt-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin?tab=newsletter`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="campaigns-title">
              Admin Campaigns
            </h1>
            <p className="text-muted-foreground" data-testid="campaigns-description">
              Create and manage email campaigns for users
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCampaignWizard(true)} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <div className="space-y-6" data-testid="campaigns-list">

      <Tabs value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setSelectedCampaigns(new Set()); }} data-testid="campaigns-tabs">
        <TabsList className="grid w-full grid-cols-4" data-testid="campaigns-tabs-list">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({campaigns?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-draft">
            Draft ({campaigns?.filter(c => c.status === "draft").length || 0})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Scheduled ({campaigns?.filter(c => c.status === "scheduled").length || 0})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            Sent ({campaigns?.filter(c => c.status === "sent").length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4 mt-6" data-testid={`tab-content-${statusFilter}`}>
          {filteredCampaigns.length > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredCampaigns.length > 0 && filteredCampaigns.every(c => selectedCampaigns.has(c.id))}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  data-testid="select-all-checkbox"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCampaigns.size > 0 
                    ? `${selectedCampaigns.size} selected` 
                    : "Select all"}
                </span>
              </div>
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
                  Delete ({selectedCampaigns.size})
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

      <AdminCampaignWizard
        open={showCampaignWizard}
        onClose={() => {
          setShowCampaignWizard(false);
          setEditingCampaign(null);
        }}
        editingCampaign={editingCampaign}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/campaigns"] });
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
                <AlertDialogTitle>Send Campaign</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to send this campaign? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="cancel-send-campaign">
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={confirmSendCampaign}
                  data-testid="confirm-send-campaign"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent data-testid="bulk-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaigns</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCampaigns.size} campaign(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-bulk-delete">
              Cancel
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
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}