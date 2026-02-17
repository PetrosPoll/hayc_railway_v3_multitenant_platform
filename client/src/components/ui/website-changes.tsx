import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, User, Clock, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WebsiteChangeLog {
  id: number;
  changeDescription: string;
  adminId: number;
  createdAt: string;
  adminUsername: string;
}

interface WebsiteChanges {
  id: number;
  userId: number;
  domain: string;
  changesUsed: number;
  changesAllowed: number;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  changeLogs: WebsiteChangeLog[];
}

export function WebsiteChanges() {
  const { t } = useTranslation();

  const { data: changesData, isLoading } = useQuery<{ changes: WebsiteChanges[] }>({
    queryKey: ["/api/website-changes"],
    staleTime: 0, // Always consider data stale
    gcTime: 0 // Don't cache data
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getProgressColor = (used: number, allowed: number) => {
    if (allowed === -1) return "bg-green-500"; // Unlimited
    const percentage = (used / allowed) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getStatusBadge = (used: number, allowed: number) => {
    if (allowed === -1) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Unlimited</Badge>;
    }

    if (used >= allowed) {
      return <Badge variant="destructive">Limit Reached</Badge>;
    }

    if (used >= allowed * 0.8) {
      return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">Nearly Full</Badge>;
    }

    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Available</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Website Changes</h2>
      </div>

      {/* Changes List */}
      <div className="grid grid-cols-1 gap-6">
        {changesData?.changes && changesData.changes.length > 0 ? (
          changesData.changes.map((changes) => (
            <Card key={`${changes.domain}-${changes.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{changes.domain}</CardTitle>
                    <CardDescription>
                      Changes for this month
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(changes.changesUsed, changes.changesAllowed)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Usage Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Changes Used</span>
                    <span className="font-medium">
                      {changes.changesUsed} / {changes.changesAllowed === -1 ? '∞' : changes.changesAllowed}
                    </span>
                  </div>
                  {changes.changesAllowed !== -1 && (
                    <Progress 
                      value={Math.min(Math.max((changes.changesUsed / changes.changesAllowed) * 100, 0), 100)}
                      className={`h-2 ${
                        changes.changesUsed >= changes.changesAllowed ? '[&>div]:bg-red-500' :
                        changes.changesUsed >= changes.changesAllowed * 0.8 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-blue-500'
                      }`}
                    />
                  )}
                </div>

                {/* Change Logs - Filter to only show actual changes for THIS domain */}
                {changes.changeLogs && changes.changeLogs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Recent Changes</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {changes.changeLogs
                        .filter(log => 
                          !log.changeDescription.startsWith('Admin adjustment:') && 
                          !log.changeDescription.startsWith('Admin limit update:')
                        )
                        .slice(0, 3)
                        .map((log) => (
                        <div key={`${changes.domain}-${log.id}`} className="text-sm bg-gray-50 p-3 rounded border-l-2 border-blue-200">
                          <p className="text-gray-900 mb-1">{log.changeDescription}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(log.createdAt)}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.adminUsername}
                            </div>
                          </div>
                        </div>
                      ))}
                      {changes.changeLogs
                        .filter(log => 
                          !log.changeDescription.startsWith('Admin adjustment:') && 
                          !log.changeDescription.startsWith('Admin limit update:')
                        ).length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{changes.changeLogs
                            .filter(log => 
                              !log.changeDescription.startsWith('Admin adjustment:') && 
                              !log.changeDescription.startsWith('Admin limit update:')
                            ).length - 3} more changes...
                        </p>
                      )}
                      {changes.changeLogs
                        .filter(log => 
                          !log.changeDescription.startsWith('Admin adjustment:') && 
                          !log.changeDescription.startsWith('Admin limit update:')
                        ).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          No changes recorded yet for {changes.domain}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No website changes found
            </h3>
            <p className="text-gray-600">
              No website changes have been recorded for this month yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}