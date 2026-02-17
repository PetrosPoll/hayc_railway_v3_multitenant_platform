import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Eye, TrendingUp, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
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

export function WebsiteAnalytics({ websiteId, disabled = true }: WebsiteAnalyticsProps) {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<string>("30");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(dateRange));

  const { data, isLoading } = useQuery<AnalyticsData>({
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
          };
        }
        throw new Error("Failed to fetch analytics");
      }
      return response.json();
    },
    enabled: !!websiteId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Website Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data && (data.pageviews > 0 || data.uniqueVisitors > 0);

  return (
    <div className={`space-y-6`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Website Analytics
            <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-normal">
              New
            </span>
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Comprehensive insights for your website
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
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
              <h3 className="text-lg font-semibold mb-2">No Analytics Data Yet</h3>
              <p className="text-muted-foreground max-w-md">
                Analytics tracking has not been set up for your website yet. Please contact us to get your tracking code installed and start viewing your website statistics.
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
                  <span className="text-sm font-medium">Total Pageviews</span>
                </div>
                <p className="text-3xl font-bold">{data?.pageviews || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total pages viewed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Unique Visitors</span>
                </div>
                <p className="text-3xl font-bold">{data?.uniqueVisitors || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Different users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Bounce Rate</span>
                </div>
                <p className="text-3xl font-bold">{data?.bounceRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Single page sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Avg. Session</span>
                </div>
                <p className="text-3xl font-bold">{data?.avgSessionDuration?.toFixed(0) || 0}s</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Time on site
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Charts - Traffic Over Time */}
          {data?.dailyStats && data.dailyStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Traffic Over Time</CardTitle>
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
                      name="Pageviews"
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      name="Visitors"
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
                    Device Breakdown
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
                    Traffic Sources
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
                  Top Pages
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
                        <span className="text-sm font-semibold">{page.count} views</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    No pageview data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top Referrers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Top Referrers
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
                            {referrer.referrer || "Direct / Unknown"}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{referrer.count} visits</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    No referrer data yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
