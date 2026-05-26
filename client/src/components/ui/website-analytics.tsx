import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, BarChart2, Clock, Users, Eye, TrendingUp, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WebsiteAnalyticsProps {
  websiteId: number;
  disabled?: boolean;
  tier?: string;
}

interface AnalyticsData {
  pageviews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: { page: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
  trafficSources: { source: string; count: number }[];
  dailyStats: {
    date: string;
    pageviews: number;
    visitors: number;
    sessions: number;
  }[];
  scrollDepthStats: { depth: number; count: number }[];
  topOutboundClicks: { url: string; count: number }[];
  topFileDownloads: { file: string; count: number }[];
  topNotFoundPages: { page: string; count: number }[];
  formSubmissions: { form: string; count: number }[];
  formStarts: { form: string; count: number }[];
  formAbandons: { form: string; count: number }[];
  formConversions: {
    form: string;
    starts: number;
    submits: number;
    abandons: number;
    conversionRate: number | null;
  }[];
  hourlyTraffic: { hour: number; count: number }[];
  returningVisitors: number;
  newVisitors: number;
}

const COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  devices: ["#3b82f6", "#8b5cf6", "#10b981"],
  sources: ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"],
};

export function WebsiteAnalytics({ websiteId, disabled = true, tier }: WebsiteAnalyticsProps) {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<string>("90");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(dateRange));

  const { data, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", websiteId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/${websiteId}?startDate=${startDate.toISOString()}&endDate=${new Date().toISOString()}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          return {
            pageviews: 0,
            uniqueVisitors: 0,
            bounceRate: 0,
            avgSessionDuration: 0,
            topPages: [],
            topReferrers: [],
            deviceBreakdown: [],
            trafficSources: [],
            dailyStats: [],
            scrollDepthStats: [],
            topOutboundClicks: [],
            topFileDownloads: [],
            topNotFoundPages: [],
            formSubmissions: [],
            formStarts: [],
            formAbandons: [],
            formConversions: [],
            hourlyTraffic: [],
            returningVisitors: 0,
            newVisitors: 0,
          };
        }
        throw new Error("Failed to fetch analytics");
      }
      return response.json();
    },
    enabled: !!websiteId,
    staleTime: 0,
    gcTime: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t("dashboard.analyticsData.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">{t("dashboard.analyticsData.loading")}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data && (data.pageviews > 0 || data.uniqueVisitors > 0);

  const scrollDepthStats = data?.scrollDepthStats ?? [];
  const topOutboundClicks = data?.topOutboundClicks ?? [];
  const topFileDownloads = data?.topFileDownloads ?? [];
  const topNotFoundPagesSafe = data?.topNotFoundPages ?? [];
  const formConversions = data?.formConversions ?? [];
  const hourlyTraffic = data?.hourlyTraffic ?? [];
  const returningVisitors = data?.returningVisitors ?? 0;
  const newVisitors = data?.newVisitors ?? 0;

  return (
    <div className={`space-y-6`}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            {t("dashboard.analyticsData.title")}
            <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-normal">
              {t("dashboard.analyticsData.badgeNew")}
            </span>
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t("dashboard.analyticsData.subtitle")}
          </p>
        </div>
        <Select
          value={dateRange}
          onValueChange={(value) => {
            if (value === dateRange) {
              void refetch({ throwOnError: false });
              return;
            }
            setDateRange(value);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("dashboard.analyticsData.range.last7Days")}</SelectItem>
            <SelectItem value="30">{t("dashboard.analyticsData.range.last30Days")}</SelectItem>
            <SelectItem value="90">{t("dashboard.analyticsData.range.last90Days")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card className={`${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center px-4 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("dashboard.analyticsData.emptyTitle")}</h3>
              <p className="text-muted-foreground max-w-md">
                {t("dashboard.analyticsData.emptyDescription")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">{t("dashboard.analyticsData.metrics.totalPageviews")}</span>
                </div>
                <p className="text-3xl font-bold">{data?.pageviews || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.analyticsData.metrics.totalPageviewsHint")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">{t("dashboard.analyticsData.metrics.uniqueVisitors")}</span>
                </div>
                <p className="text-3xl font-bold">{data?.uniqueVisitors || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.analyticsData.metrics.uniqueVisitorsHint")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">{t("dashboard.analyticsData.metrics.bounceRate")}</span>
                </div>
                <p className="text-3xl font-bold">{data?.bounceRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.analyticsData.metrics.bounceRateHint")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">{t("dashboard.analyticsData.metrics.avgSession")}</span>
                </div>
                <p className="text-3xl font-bold">{data?.avgSessionDuration?.toFixed(0) || 0}s</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.analyticsData.metrics.avgSessionHint")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Charts - Traffic Over Time */}
          {data?.dailyStats && data.dailyStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.analyticsData.trafficOverTime")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="pageviews"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      name={t("dashboard.analyticsData.chart.pageviews")}
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      name={t("dashboard.analyticsData.chart.visitors")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Device Breakdown & Traffic Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Device Breakdown Pie Chart */}
            {data?.deviceBreakdown && data.deviceBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    {t("dashboard.analyticsData.deviceBreakdown")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ device, percent }) => `${device}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {data.deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.devices[index % COLORS.devices.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap gap-4 justify-center">
                    {data.deviceBreakdown.map((item, index) => (
                      <div key={item.device} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS.devices[index % COLORS.devices.length] }}
                        />
                        <span className="text-sm">
                          {item.device}: {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Traffic Sources Bar Chart */}
            {data?.trafficSources && data.trafficSources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    {t("dashboard.analyticsData.trafficSources")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.trafficSources} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="source" type="category" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="count" fill={COLORS.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top Pages & Top Referrers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t("dashboard.analyticsData.topPages")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.topPages && data.topPages.length > 0 ? (
                  <div className="space-y-2">
                    {data.topPages.slice(0, 5).map((page, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <code className="text-sm truncate">{page.page}</code>
                        </div>
                        <span className="text-sm font-semibold">{page.count} {t("dashboard.analyticsData.views")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    {t("dashboard.analyticsData.noPageviewData")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top Referrers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  {t("dashboard.analyticsData.topReferrers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.topReferrers && data.topReferrers.length > 0 ? (
                  <div className="space-y-2">
                    {data.topReferrers.slice(0, 5).map((referrer, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <span className="text-sm truncate">
                            {referrer.referrer || t("dashboard.analyticsData.directUnknown")}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{referrer.count} {t("dashboard.analyticsData.visits")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    {t("dashboard.analyticsData.noReferrerData")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Scroll Depth</CardTitle>
              <CardDescription>How far visitors scroll on average</CardDescription>
            </CardHeader>
            <CardContent>
              {scrollDepthStats.every(s => s.count === 0) ? (
                <p className="text-sm text-muted-foreground">No scroll data yet</p>
              ) : (
                <div className="space-y-3">
                  {scrollDepthStats.map(({ depth, count }) => (
                    <div key={depth} className="flex items-center gap-3">
                      <span className="text-sm w-12 text-muted-foreground">{depth}%</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${Math.max(...scrollDepthStats.map(s => s.count)) > 0
                              ? (count / Math.max(...scrollDepthStats.map(s => s.count))) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Outbound Clicks</CardTitle>
                <CardDescription>External links clicked by visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {topOutboundClicks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outbound clicks yet</p>
                ) : (
                  <div className="space-y-2">
                    {topOutboundClicks.map(({ url, count }) => (
                      <div key={url} className="flex items-center justify-between">
                        <span className="text-sm truncate max-w-[200px] text-muted-foreground">{url}</span>
                        <span className="text-sm font-medium ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">File Downloads</CardTitle>
                <CardDescription>Files downloaded by visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {topFileDownloads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No file downloads yet</p>
                ) : (
                  <div className="space-y-2">
                    {topFileDownloads.map(({ file, count }) => (
                      <div key={file} className="flex items-center justify-between">
                        <span className="text-sm truncate max-w-[200px] text-muted-foreground">{file}</span>
                        <span className="text-sm font-medium ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">404 Errors</CardTitle>
              <CardDescription>Pages visitors tried to access but don't exist</CardDescription>
            </CardHeader>
            <CardContent>
              {topNotFoundPagesSafe.length === 0 ? (
                <p className="text-sm text-muted-foreground">No 404 errors recorded</p>
              ) : (
                <div className="space-y-2">
                  {topNotFoundPagesSafe.map(({ page, count }) => (
                    <div key={page} className="flex items-center justify-between">
                      <span className="text-sm font-mono text-muted-foreground">{page}</span>
                      <span className="text-sm font-medium ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {tier === "pro" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Form Analytics</CardTitle>
                <CardDescription>Starts, submissions, abandons and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                {formConversions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No form data yet</p>
                ) : (
                  <div className="space-y-4">
                    {formConversions.map(({ form, starts, submits, abandons, conversionRate }) => (
                      <div key={form} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{form} form</span>
                          {conversionRate !== null && (
                            <span className="text-sm font-medium">
                              {conversionRate}% conversion
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{starts}</p>
                            <p className="text-xs text-muted-foreground">Started</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{submits}</p>
                            <p className="text-xs text-muted-foreground">Submitted</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{abandons}</p>
                            <p className="text-xs text-muted-foreground">Abandoned</p>
                          </div>
                        </div>
                        {conversionRate !== null && (
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${conversionRate}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Form Analytics
                </CardTitle>
                <CardDescription>
                  Starts, submissions, abandons and conversion rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="rounded-full bg-blue-100 p-3">
                    <BarChart2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium">Available on Pro plan</p>
                  <p className="text-xs text-muted-foreground">
                    Track form starts, submissions, abandons and conversion
                    rates to understand how visitors interact with your forms.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {tier === "pro" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Traffic by Hour
                </CardTitle>
                <CardDescription>
                  What time of day visitors come to your site
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hourlyTraffic.every(h => h.count === 0) ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <div className="flex items-end gap-1 h-24">
                    {hourlyTraffic.map(({ hour, count }) => {
                      const max = Math.max(...hourlyTraffic.map(h => h.count));
                      const height = max > 0 ? (count / max) * 100 : 0;
                      return (
                        <div
                          key={hour}
                          className="flex-1 flex flex-col items-center gap-1"
                          title={`${hour}:00 — ${count} visits`}
                        >
                          <div
                            className="w-full bg-primary rounded-sm"
                            style={{ height: `${height}%`, minHeight: count > 0 ? "2px" : "0" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">12am</span>
                  <span className="text-xs text-muted-foreground">6am</span>
                  <span className="text-xs text-muted-foreground">12pm</span>
                  <span className="text-xs text-muted-foreground">6pm</span>
                  <span className="text-xs text-muted-foreground">11pm</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Traffic by Hour</CardTitle>
                <CardDescription>What time of day visitors come to your site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium">Available on Pro plan</p>
                  <p className="text-xs text-muted-foreground">
                    Discover what time of day your visitors are most active
                    to optimize your content and campaigns.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {tier === "pro" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  New vs Returning Visitors
                </CardTitle>
                <CardDescription>
                  First-time visitors compared to returning ones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newVisitors === 0 && returningVisitors === 0 ? (
                  <p className="text-sm text-muted-foreground">No visitor data yet</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-20 text-muted-foreground">New</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${newVisitors + returningVisitors > 0
                              ? (newVisitors / (newVisitors + returningVisitors)) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{newVisitors}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-20 text-muted-foreground">Returning</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-400 h-2 rounded-full"
                          style={{
                            width: `${newVisitors + returningVisitors > 0
                              ? (returningVisitors / (newVisitors + returningVisitors)) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{returningVisitors}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      {newVisitors + returningVisitors} total unique visitors
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">New vs Returning Visitors</CardTitle>
                <CardDescription>First-time visitors compared to returning ones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium">Available on Pro plan</p>
                  <p className="text-xs text-muted-foreground">
                    Understand whether your marketing is attracting new visitors
                    or building a loyal returning audience.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
