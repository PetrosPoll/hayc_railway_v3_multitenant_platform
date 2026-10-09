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
import { Loader2, Copy, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [websiteIdInput, setWebsiteIdInput] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("all");
  const [resetTarget, setResetTarget] = useState<DemoRow | null>(null);
  const [shareTarget, setShareTarget] = useState<DemoRow | null>(null);

  const sharePath = shareTarget?.demoSlug
    ? `/demo/${shareTarget.demoSlug}`
    : shareTarget
      ? "/demo"
      : "";
  const shareUrl =
    typeof window !== "undefined" && sharePath
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t("demo.linkCopied") || "Link copied",
        description: t("demo.linkCopiedDescription") || "Ready to paste into an email.",
      });
    } catch {
      toast({
        title: t("demo.copyFailed") || "Could not copy",
        description: shareUrl,
        variant: "destructive",
      });
    }
  };

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

  const resetAnalyticsMutation = useMutation({
    mutationFn: async (websiteId: number) => {
      const res = await fetch(`/api/admin/demo-websites/${websiteId}/reset-analytics`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to reset analytics");
      return data as { deletedCount: number; label: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-analytics"] });
      setResetTarget(null);
      toast({
        title: "Analytics reset",
        description: `Deleted ${data.deletedCount} events for ${data.label}.`,
      });
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{path}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShareTarget(demo)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy
                          </Button>
                        </div>
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
                      <TableCell className="space-x-2 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resetAnalyticsMutation.isPending}
                          onClick={() => setResetTarget(demo)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reset analytics
                        </Button>
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

      <Dialog
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("demo.shareTitle") || "Copy demo link"}</DialogTitle>
            <DialogDescription>
              {t("demo.shareDescription") ||
                "Copy this link and send it to the prospect. They open it in a normal browser — no login required."}
            </DialogDescription>
          </DialogHeader>
          <code className="text-xs bg-muted px-2 py-1.5 rounded break-all block">
            {shareUrl}
          </code>
          <p className="text-xs text-muted-foreground">
            {t("demo.staffSessionTip") ||
              "Tip for staff: don’t open this link in the same browser while you’re logged into Admin — it shares the session cookie. Use a private window only if you want to preview it yourself."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShareTarget(null)}>
              Close
            </Button>
            <Button type="button" onClick={() => void copyShareLink()}>
              <Copy className="h-4 w-4 mr-2" />
              {t("demo.copyLink") || "Copy demo link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open && !resetAnalyticsMutation.isPending) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo analytics?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all platform usage events (sessions, logins,
              pageviews, time in product) for the demo owner of{" "}
              <strong>
                #{resetTarget?.id} {resetTarget?.projectName || resetTarget?.domain}
              </strong>
              . Use this before sharing the link with a prospect so metrics start clean.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetAnalyticsMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resetAnalyticsMutation.isPending || !resetTarget}
              onClick={(e) => {
                e.preventDefault();
                if (resetTarget) resetAnalyticsMutation.mutate(resetTarget.id);
              }}
            >
              {resetAnalyticsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reset analytics"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
