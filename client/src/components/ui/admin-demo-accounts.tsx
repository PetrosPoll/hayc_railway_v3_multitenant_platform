import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DemoRow = {
  id: number;
  domain: string;
  projectName: string | null;
  siteId: string | null;
  isDemo: boolean;
  demoSlug: string | null;
  demoEnabled: boolean;
  userId: number;
  userEmail: string;
  userUsername: string;
  userIsDemo: boolean;
};

type AnalyticsResponse = {
  sessionCount: number;
  loginCount: number;
  activeUsers: number;
  totalActiveMs: number;
  topPaths: { path: string; count: number }[];
  demos: Array<{
    id: number;
    projectName: string | null;
    domain: string;
    demoSlug: string | null;
    demoEnabled: boolean;
    userId: number;
    userEmail: string;
  }>;
};

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function AdminDemoAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [websiteIdInput, setWebsiteIdInput] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("all");

  const { data: demosData, isLoading } = useQuery<{ demos: DemoRow[] }>({
    queryKey: ["/api/admin/demo-websites"],
    queryFn: async () => {
      const res = await fetch("/api/admin/demo-websites", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load demos");
      return res.json();
    },
  });

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const analyticsQuery = useQuery<AnalyticsResponse>({
    queryKey: ["/api/admin/demo-analytics", range.from, range.to, selectedWebsiteId],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      if (selectedWebsiteId !== "all") {
        params.set("websiteId", selectedWebsiteId);
      }
      const res = await fetch(`/api/admin/demo-analytics?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load demo analytics");
      return res.json();
    },
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const websiteId = parseInt(websiteIdInput, 10);
      if (Number.isNaN(websiteId)) throw new Error("Enter a valid website id");
      const slug = slugInput.trim().toLowerCase();
      if (!slug) throw new Error("Enter a demo slug (e.g. maria)");
      const res = await fetch(`/api/admin/websites/${websiteId}/demo`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo: true, demoEnabled: true, demoSlug: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to enable demo");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-websites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-analytics"] });
      setWebsiteIdInput("");
      setSlugInput("");
      toast({ title: "Demo enabled", description: "Public link is ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: {
      websiteId: number;
      isDemo?: boolean;
      demoEnabled?: boolean;
      demoSlug?: string | null;
    }) => {
      const res = await fetch(`/api/admin/websites/${payload.websiteId}/demo`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDemo: payload.isDemo ?? true,
          demoEnabled: payload.demoEnabled,
          demoSlug: payload.demoSlug,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update demo");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-websites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-analytics"] });
      toast({ title: "Demo updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const demos = demosData?.demos ?? [];
  const analytics = analyticsQuery.data;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Demo accounts</h2>
        <p className="text-sm text-muted-foreground">
          Public read-only portals for prospects. Link format:{" "}
          <code className="text-xs bg-muted px-1 rounded">/demo/&lt;slug&gt;</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enable a website as demo</CardTitle>
          <CardDescription>
            Marks the website and its owner as demo. Mutating actions become blocked for that user.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="space-y-1.5 w-full sm:w-40">
            <Label htmlFor="demo-website-id">Website ID</Label>
            <Input
              id="demo-website-id"
              value={websiteIdInput}
              onChange={(e) => setWebsiteIdInput(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="space-y-1.5 w-full sm:w-56">
            <Label htmlFor="demo-slug">Public slug</Label>
            <Input
              id="demo-slug"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="e.g. maria"
            />
          </div>
          <Button
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
          >
            {enableMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Enable demo"
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions (30d)</CardDescription>
            <CardTitle className="text-2xl">
              {analyticsQuery.isLoading ? "…" : analytics?.sessionCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Demo logins (30d)</CardDescription>
            <CardTitle className="text-2xl">
              {analyticsQuery.isLoading ? "…" : analytics?.loginCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active demo users</CardDescription>
            <CardTitle className="text-2xl">
              {analyticsQuery.isLoading ? "…" : analytics?.activeUsers ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Time in product</CardDescription>
            <CardTitle className="text-2xl">
              {analyticsQuery.isLoading
                ? "…"
                : formatDuration(analytics?.totalActiveMs ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Top paths (prospects)</CardTitle>
            <CardDescription>Where demo visitors spend attention</CardDescription>
          </div>
          <select
            className="border rounded-md text-sm px-2 py-1.5 bg-background"
            value={selectedWebsiteId}
            onChange={(e) => setSelectedWebsiteId(e.target.value)}
          >
            <option value="all">All demos</option>
            {demos.map((d) => (
              <option key={d.id} value={String(d.id)}>
                #{d.id} {d.projectName || d.domain}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {analyticsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : !analytics?.topPaths?.length ? (
            <p className="text-sm text-muted-foreground">No demo traffic yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topPaths.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell className="font-mono text-xs">{row.path}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured demos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : demos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No demo websites yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Slug / link</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demos.map((demo) => {
                  const path = demo.demoSlug ? `/demo/${demo.demoSlug}` : "/demo";
                  return (
                    <TableRow key={demo.id}>
                      <TableCell>
                        <div className="font-medium">
                          #{demo.id} {demo.projectName || demo.domain}
                        </div>
                        <div className="text-xs text-muted-foreground">{demo.domain}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {demo.userEmail}
                        {!demo.userIsDemo && (
                          <div className="text-xs text-destructive">Owner not is_demo</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={path}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {path}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={demo.demoEnabled}
                          disabled={patchMutation.isPending}
                          onCheckedChange={(checked) =>
                            patchMutation.mutate({
                              websiteId: demo.id,
                              isDemo: true,
                              demoEnabled: checked,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={patchMutation.isPending}
                          onClick={() =>
                            patchMutation.mutate({
                              websiteId: demo.id,
                              isDemo: false,
                              demoEnabled: false,
                              demoSlug: null,
                            })
                          }
                        >
                          Remove demo
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
