import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, MousePointerClick, Eye, TrendingUp, Calendar, Send, CheckCircle, XCircle, AlertCircle, Tag as TagIcon } from "lucide-react";

export default function AdminCampaignAnalytics() {
  const { campaignId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/admin/newsletter/campaigns/${campaignId}/analytics`],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/newsletter/campaigns/${campaignId}/analytics`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch campaign analytics");
      return response.json();
    },
    enabled: !!campaignId,
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-center text-gray-500">Campaign not found</p>
      </div>
    );
  }

  const { campaign, metrics, template } = data;

  return (
    <div className="container mx-auto py-8 px-4 mt-16">
      <Button
        variant="ghost"
        onClick={() => navigate(`/admin/campaigns`)}
        className="mb-6"
        data-testid="button-back-to-campaigns"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Campaigns
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-campaign-title">
            {campaign.title}
          </h1>
          {campaign.description && (
            <p className="text-gray-600 mt-2" data-testid="text-campaign-description">
              {campaign.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
            {campaign.status === 'sent' && campaign.sentAt && (
              <div className="flex items-center gap-1" data-testid="text-sent-date">
                <Send className="w-4 h-4" />
                Sent: {new Date(campaign.sentAt).toLocaleString()}
              </div>
            )}
            {campaign.status === 'scheduled' && campaign.scheduledFor && (
              <div className="flex items-center gap-1" data-testid="text-scheduled-date">
                <Calendar className="w-4 h-4" />
                Scheduled: {new Date(campaign.scheduledFor).toLocaleString()}
              </div>
            )}
            {campaign.status === 'draft' && (
              <div className="text-orange-600" data-testid="text-status-draft">
                Draft - Not sent
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Sending Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Delivery Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-sent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Sent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    <span className="text-3xl font-bold" data-testid="text-sent-count">
                      {metrics.sentCount || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-delivered">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Delivered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-3xl font-bold" data-testid="text-delivered-count">
                        {metrics.deliveredCount || 0}
                      </span>
                    </div>
                    <p className="text-sm text-green-600 font-medium" data-testid="text-delivery-rate">
                      {metrics.deliveryRate || 0}% delivery rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-bounced">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Bounces</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-3xl font-bold" data-testid="text-bounce-count">
                        {metrics.bounceCount || 0}
                      </span>
                    </div>
                    <p className="text-sm text-red-600 font-medium" data-testid="text-bounce-rate">
                      {metrics.bounceRate || 0}% bounce rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-complaints">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Complaints</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <span className="text-3xl font-bold" data-testid="text-complaint-count">
                        {metrics.complaintCount || 0}
                      </span>
                    </div>
                    <p className="text-sm text-orange-600 font-medium" data-testid="text-complaint-rate">
                      {metrics.complaintRate || 0}% complaint rate
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Engagement Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card data-testid="card-opens">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Opens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-500" />
                      <span className="text-3xl font-bold" data-testid="text-open-count">
                        {metrics.openCount}
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 font-medium" data-testid="text-open-rate">
                      {metrics.openRate}% open rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-clicks">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Clicks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-5 h-5 text-green-500" />
                      <span className="text-3xl font-bold" data-testid="text-click-count">
                        {metrics.clickCount}
                      </span>
                    </div>
                    <p className="text-sm text-green-600 font-medium" data-testid="text-click-rate">
                      {metrics.clickRate}% click rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-ctr">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Click-Through Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-500" />
                      <span className="text-3xl font-bold" data-testid="text-ctr">
                        {metrics.clickThroughRate}%
                      </span>
                    </div>
                    <p className="text-sm text-purple-600 font-medium">of opens clicked</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Information about this campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Subject Line</p>
                <p className="mt-1" data-testid="text-subject">{campaign.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Recipient Tags</p>
                <div className="mt-1 flex flex-wrap gap-1" data-testid="text-tags">
                  {campaign.tagIds && campaign.tagIds.length > 0 ? (
                    tags
                      .filter((tag: any) => campaign.tagIds.includes(tag.id))
                      .map((tag: any) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag.name}
                        </Badge>
                      ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Sender Name</p>
                <p className="mt-1" data-testid="text-sender-name">{campaign.senderName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Sender Email</p>
                <p className="mt-1" data-testid="text-sender-email">{campaign.senderEmail}</p>
              </div>
              {campaign.excludedContactIds && campaign.excludedContactIds.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Excluded Contacts</p>
                  <p className="mt-1" data-testid="text-excluded-count">
                    {campaign.excludedContactIds.length} contacts excluded
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="mt-1 capitalize" data-testid="text-status">{campaign.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {template && template.thumbnail && (
          <Card>
            <CardHeader>
              <CardTitle>Email Design Preview</CardTitle>
              <CardDescription>Preview of the email template used in this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
                <img 
                  src={template.thumbnail} 
                  alt={template.name || "Email template preview"} 
                  className="max-w-full h-auto rounded border border-gray-200 shadow-sm"
                  data-testid="img-template-preview"
                />
              </div>
              {template.name && (
                <p className="text-sm text-gray-600 mt-4 text-center" data-testid="text-template-name">
                  Template: {template.name}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

