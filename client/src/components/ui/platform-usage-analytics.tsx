import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type DaysRange = "7" | "30" | "90";

interface OverviewResponse {
  dau: number;
  wau: number;
  activeUsers: number;
  sessionCount: number;
  loginCount: number;
  totalActiveMs: number;
  avgSessionDurationMs: number;
  topPaths: { path: string; count: number }[];
}

interface UserRow {
  userId: number;
  email: string;
  username: string;
  lastSeenAt: string | null;
  loginCount: number;
  sessionCount: number;
  totalActiveMs: number;
  topPath: string | null;
}

interface UserDetailResponse {
  user: { id: number; email: string; username: string };
  lastLoginAt: string | null;
  lastPageviewAt: string | null;
  lastPageviewPath: string | null;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    endedAt: string;
    totalActiveMs: number;
    loginCount: number;
    paths: { path: string; durationMs: number; pageviews: number }[];
  }>;
}

function rangeFromDays(days: DaysRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export function PlatformUsageAnalytics() {
  const [days, setDays] = useState<DaysRange>("30");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { from, to } = useMemo(() => rangeFromDays(days), [days]);
  const rangeQs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const overviewQuery = useQuery<OverviewResponse>({
    queryKey: ["/api/admin/platform-analytics/overview", days],
    queryFn: () => fetchJson(`/api/admin/platform-analytics/overview?${rangeQs}`),
  });

  const usersQuery = useQuery<{ users: UserRow[] }>({
    queryKey: ["/api/admin/platform-analytics/users", days, searchApplied],
    queryFn: () => {
      const q = searchApplied
        ? `&q=${encodeURIComponent(searchApplied)}`
        : "";
      return fetchJson(`/api/admin/platform-analytics/users?${rangeQs}${q}`);
    },
  });

  const detailQuery = useQuery<UserDetailResponse>({
    queryKey: ["/api/admin/platform-analytics/users", selectedUserId, days],
    queryFn: () =>
      fetchJson(`/api/admin/platform-analytics/users/${selectedUserId}?${rangeQs}`),
    enabled: selectedUserId != null,
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Platform Usage</h2>
          <p className="text-sm text-muted-foreground">
            Authenticated hayc.gr activity: logins, pages, and time spent.
          </p>
        </div>
        <Select value={days} onValueChange={(v) => setDays(v as DaysRange)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {overviewQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : overviewQuery.isError ? (
        <p className="text-sm text-destructive">Failed to load overview.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>DAU (24h)</CardDescription>
                <CardTitle className="text-2xl">{overviewQuery.data?.dau ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>WAU (7d)</CardDescription>
                <CardTitle className="text-2xl">{overviewQuery.data?.wau ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active users (range)</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewQuery.data?.activeUsers ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Sessions</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewQuery.data?.sessionCount ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Logins</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewQuery.data?.loginCount ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg session duration</CardDescription>
                <CardTitle className="text-2xl">
                  {formatDuration(overviewQuery.data?.avgSessionDurationMs ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total active time</CardDescription>
                <CardTitle className="text-2xl">
                  {formatDuration(overviewQuery.data?.totalActiveMs ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top pages</CardTitle>
              <CardDescription>By pageview count in selected range</CardDescription>
            </CardHeader>
            <CardContent>
              {(overviewQuery.data?.topPaths?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No pageviews yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overviewQuery.data!.topPaths.map((row) => (
                      <TableRow key={row.path}>
                        <TableCell className="font-mono text-sm">{row.path}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>Click a row for session drill-down</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchApplied(search.trim());
            }}
          >
            <Input
              placeholder="Search email or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {usersQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : usersQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load users.</p>
          ) : (usersQuery.data?.users.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Logins</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Active time</TableHead>
                  <TableHead>Top path</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data!.users.map((u) => (
                  <TableRow
                    key={u.userId}
                    className="cursor-pointer"
                    onClick={() => setSelectedUserId(u.userId)}
                  >
                    <TableCell>
                      <div className="font-medium">{u.email || u.username}</div>
                      {u.email && u.username ? (
                        <div className="text-xs text-muted-foreground">{u.username}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(u.lastSeenAt)}</TableCell>
                    <TableCell className="text-right">{u.loginCount}</TableCell>
                    <TableCell className="text-right">{u.sessionCount}</TableCell>
                    <TableCell className="text-right">
                      {formatDuration(u.totalActiveMs)}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {u.topPath ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedUserId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailQuery.data?.user.email ||
                detailQuery.data?.user.username ||
                "User activity"}
            </DialogTitle>
            <DialogDescription>
              Last login: {formatDateTime(detailQuery.data?.lastLoginAt ?? null)}
              {" · "}
              Last page: {detailQuery.data?.lastPageviewPath ?? "—"} (
              {formatDateTime(detailQuery.data?.lastPageviewAt ?? null)})
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load user detail.</p>
          ) : (detailQuery.data?.sessions.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions in this range.</p>
          ) : (
            <div className="space-y-4">
              {detailQuery.data!.sessions.map((session) => (
                <Card key={session.sessionId}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Session {session.sessionId.slice(0, 8)}…
                    </CardTitle>
                    <CardDescription>
                      {formatDateTime(session.startedAt)} → {formatDateTime(session.endedAt)}
                      {" · "}
                      {formatDuration(session.totalActiveMs)}
                      {session.loginCount > 0 ? ` · ${session.loginCount} login(s)` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {session.paths.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No page activity</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Path</TableHead>
                            <TableHead className="text-right">Views</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {session.paths.map((p) => (
                            <TableRow key={p.path}>
                              <TableCell className="font-mono text-xs">{p.path}</TableCell>
                              <TableCell className="text-right">{p.pageviews}</TableCell>
                              <TableCell className="text-right">
                                {formatDuration(p.durationMs)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
