import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, User, Plus, Minus, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface WebsiteChangeLog {
  id: number;
  changeDescription: string;
  status: string;
  adminId: number;
  completedBy: number | null;
  completedAt: string | null;
  userFeedback: string | null;
  createdAt: string;
  adminUsername: string;
}

interface WebsiteChanges {
  id: number;
  userId: number;
  domain: string;
  projectName: string;
  changesUsed: number;
  changesAllowed: number;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  email: string;
  subscriptionTier: string;
  changeLogs: WebsiteChangeLog[];
}

interface User {
  id: number;
  email: string;
  username: string;
}

interface Website {
  id: number;
  domain: string;
  userId: number;
  userEmail: string;
}

export function AdminWebsiteChanges() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [selectedChangesRecord, setSelectedChangesRecord] = useState<WebsiteChanges | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [newLimit, setNewLimit] = useState(0);
  const [selectedChangeLog, setSelectedChangeLog] = useState<WebsiteChangeLog | null>(null);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [sendEmailNotification, setSendEmailNotification] = useState(true);

  const { data: changesData, isLoading } = useQuery<{ changes: WebsiteChanges[] }>({
    queryKey: ["/api/admin/website-changes"],
    staleTime: 0, // Always consider data stale
    gcTime: 0 // Don't cache data
  });

  const { data: users } = useQuery<{ users: User[] }>({
    queryKey: ["/api/admin/users"]
  });

  const { data: websitesResponse } = useQuery<{ websites: Website[] }>({
    queryKey: ["/api/admin/websites"]
  });

  const websites = websitesResponse?.websites || [];

  const recordChangeMutation = useMutation({
    mutationFn: async ({ userId, domain, changeDescription }: { userId: number, domain: string, changeDescription: string }) => {
      const response = await fetch('/api/admin/website-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, domain, changeDescription })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record change');
      }
      return response.json();
    },
    onSuccess: () => {
      // Remove cached data and force fresh fetch
      queryClient.removeQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.removeQueries({ queryKey: ["/api/website-changes"] });
      // Invalidate to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website-changes"] });
      setIsRecordModalOpen(false);
      setSelectedUser(null);
      setSelectedDomain("");
      setChangeDescription("");
      toast({ description: "Change recorded successfully" });
    },
    onError: (error: any) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const adjustChangesMutation = useMutation({
    mutationFn: async ({ changesId, adjustment, reason }: { changesId: number, adjustment: number, reason: string }) => {
      const response = await fetch(`/api/admin/website-changes/${changesId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment, reason })
      });
      if (!response.ok) throw new Error('Failed to adjust changes');
      return response.json();
    },
    onSuccess: () => {
      // Remove cached data and force fresh fetch
      queryClient.removeQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.removeQueries({ queryKey: ["/api/website-changes"] });
      // Invalidate to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website-changes"] });
      setIsAdjustModalOpen(false);
      setSelectedChangesRecord(null);
      setAdjustmentAmount(0);
      toast({ description: "Changes adjusted successfully" });
    },
    onError: () => {
      toast({ description: "Failed to adjust changes", variant: "destructive" });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: async ({ changesId, newLimit, reason }: { changesId: number, newLimit: number, reason: string }) => {
      const response = await fetch(`/api/admin/website-changes/${changesId}/limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLimit, reason })
      });
      if (!response.ok) throw new Error('Failed to update changes limit');
      return response.json();
    },
    onSuccess: () => {
      // Remove cached data and force fresh fetch
      queryClient.removeQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.removeQueries({ queryKey: ["/api/website-changes"] });
      // Invalidate to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website-changes"] });
      setIsLimitModalOpen(false);
      setSelectedChangesRecord(null);
      setNewLimit(0);
      toast({ description: "Changes limit updated successfully" });
    },
    onError: () => {
      toast({ description: "Failed to update changes limit", variant: "destructive" });
    },
  });

  const updateChangeLogStatusMutation = useMutation({
    mutationFn: async ({ changeLogId, status, sendEmail }: { changeLogId: number, status: string, sendEmail: boolean }) => {
      const response = await fetch(`/api/admin/website-change-logs/${changeLogId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, sendEmail })
      });
      if (!response.ok) throw new Error('Failed to update change log status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.removeQueries({ queryKey: ["/api/website-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/website-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website-changes"] });
      setIsStatusUpdateModalOpen(false);
      setSelectedChangeLog(null);
      setNewStatus("");
      setSendEmailNotification(true);
      toast({ description: "Status updated successfully" });
    },
    onError: () => {
      toast({ description: "Failed to update status", variant: "destructive" });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  const getChangeLogStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Pending</Badge>;
      case "in-progress":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Completed</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Confirmed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openStatusUpdateModal = (changeLog: WebsiteChangeLog) => {
    setSelectedChangeLog(changeLog);
    setNewStatus(changeLog.status);
    setIsStatusUpdateModalOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedChangeLog || !newStatus) {
      toast({ description: "Please select a status", variant: "destructive" });
      return;
    }

    updateChangeLogStatusMutation.mutate({
      changeLogId: selectedChangeLog.id,
      status: newStatus,
      sendEmail: sendEmailNotification
    });
  };

  const handleRecordChange = () => {
    if (!selectedUser || !selectedDomain || !changeDescription.trim()) {
      toast({ description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    recordChangeMutation.mutate({
      userId: selectedUser,
      domain: selectedDomain,
      changeDescription: changeDescription.trim()
    });
  };

  const handleAdjustChanges = () => {
    if (!selectedChangesRecord || adjustmentAmount === 0) {
      toast({ description: "Please enter an adjustment amount", variant: "destructive" });
      return;
    }

    adjustChangesMutation.mutate({
      changesId: selectedChangesRecord.id,
      adjustment: adjustmentAmount,
      reason: "Admin adjustment"
    });
  };

  const openAdjustModal = (changes: WebsiteChanges) => {
    setSelectedChangesRecord(changes);
    setIsAdjustModalOpen(true);
  };

  const openLimitModal = (changes: WebsiteChanges) => {
    setSelectedChangesRecord(changes);
    setNewLimit(changes.changesAllowed === -1 ? 0 : changes.changesAllowed);
    setIsLimitModalOpen(true);
  };

  const handleUpdateLimit = () => {
    if (!selectedChangesRecord) {
      toast({ description: "Please select a record", variant: "destructive" });
      return;
    }

    updateLimitMutation.mutate({
      changesId: selectedChangesRecord.id,
      newLimit: newLimit,
      reason: "Admin limit update"
    });
  };

  const getUserWebsites = (userId: number) => {
    return websites?.filter(website => website.userId === userId) || [];
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
        <Button onClick={() => setIsRecordModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Change
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Active Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{changesData?.changes.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">At Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {changesData?.changes.filter(c => c.changesAllowed !== -1 && c.changesUsed >= c.changesAllowed).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Changes This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {changesData?.changes.reduce((sum, c) => sum + c.changesUsed, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Changes List */}
      <div className="grid grid-cols-1 gap-6">
        {changesData?.changes && changesData.changes.length > 0 ? (
          changesData.changes.map((changes) => (
            <Card key={`${changes.userId}-${changes.domain}-${changes.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{changes.projectName || changes.domain}</CardTitle>
                    <CardDescription>
                      {changes.username} ({changes.email}) • {changes.subscriptionTier} Plan
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(changes.changesUsed, changes.changesAllowed)}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openAdjustModal(changes)}
                    >
                      Adjust
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openLimitModal(changes)}
                    >
                      Set Limit
                    </Button>
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          changes.changesUsed >= changes.changesAllowed ? 'bg-red-500' :
                          changes.changesUsed >= changes.changesAllowed * 0.8 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${Math.min(Math.max((changes.changesUsed / changes.changesAllowed) * 100, 0), 100)}%`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Change Logs */}
                {changes.changeLogs && changes.changeLogs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Recent Changes</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {changes.changeLogs
                        .filter(log => !log.changeDescription.startsWith('Admin adjustment:') && !log.changeDescription.startsWith('Admin limit update:'))
                        .slice(0, 5)
                        .map((log) => (
                        <div key={`${changes.domain}-${log.id}-${log.createdAt}`} className="text-sm bg-gray-50 p-3 rounded border-l-2 border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getChangeLogStatusBadge(log.status)}
                              {log.completedAt && (
                                <span className="text-xs text-gray-500">
                                  Completed {formatDate(log.completedAt)}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStatusUpdateModal(log)}
                            >
                              Update Status
                            </Button>
                          </div>
                          <p className="text-gray-900 mb-1">{log.changeDescription}</p>
                          {log.userFeedback && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs font-medium text-blue-900 mb-1">User Feedback:</p>
                              <p className="text-xs text-blue-800">{log.userFeedback}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(log.createdAt)}
                            </div>
                            {log.adminUsername && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.adminUsername}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {changes.changeLogs.filter(log => !log.changeDescription.startsWith('Admin adjustment:') && !log.changeDescription.startsWith('Admin limit update:')).length > 5 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{changes.changeLogs.filter(log => !log.changeDescription.startsWith('Admin adjustment:') && !log.changeDescription.startsWith('Admin limit update:')).length - 5} more changes...
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

      {/* Record Change Modal */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Website Change</DialogTitle>
            <DialogDescription>
              Record a new change for a customer's website
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Customer</Label>
              <Select value={selectedUser?.toString() || ""} onValueChange={(value) => {
                setSelectedUser(parseInt(value));
                setSelectedDomain(""); // Reset domain when user changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {users?.users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="space-y-2">
                <Label htmlFor="domain-select">Website Project</Label>
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a website project" />
                  </SelectTrigger>
                  <SelectContent>
                    {getUserWebsites(selectedUser).map((website) => (
                      <SelectItem key={website.domain} value={website.domain}>
                        {website.projectName || website.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="change-description">Change Description</Label>
              <Textarea
                id="change-description"
                placeholder="Describe the change that was made..."
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRecordChange}
              disabled={recordChangeMutation.isPending}
            >
              {recordChangeMutation.isPending ? "Recording..." : "Record Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Changes Modal */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Changes Quota</DialogTitle>
            <DialogDescription>
              Increase or decrease the changes used for {selectedChangesRecord?.projectName || selectedChangesRecord?.domain}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedChangesRecord && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm">
                  <strong>Current:</strong> {selectedChangesRecord.changesUsed} / {selectedChangesRecord.changesAllowed === -1 ? '∞' : selectedChangesRecord.changesAllowed} changes used
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="adjustment">Adjustment Amount</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustmentAmount(adjustmentAmount - 1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="adjustment"
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(parseInt(e.target.value) || 0)}
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustmentAmount(adjustmentAmount + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Positive numbers increase used changes, negative numbers decrease them
              </p>
            </div>

            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdjustChanges}
              disabled={adjustChangesMutation.isPending}
            >
              {adjustChangesMutation.isPending ? "Adjusting..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Limit Modal */}
      <Dialog open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Changes Limit</DialogTitle>
            <DialogDescription>
              Update the monthly changes limit for {selectedChangesRecord?.projectName || selectedChangesRecord?.domain}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedChangesRecord && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm">
                  <strong>Current Limit:</strong> {selectedChangesRecord.changesAllowed === -1 ? 'Unlimited' : selectedChangesRecord.changesAllowed} changes per month
                </p>
                <p className="text-sm">
                  <strong>Currently Used:</strong> {selectedChangesRecord.changesUsed} changes this month
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-limit">New Monthly Limit</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-limit"
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="Enter new limit"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewLimit(-1)}
                >
                  Unlimited
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Set to -1 or click "Unlimited" for unlimited changes
              </p>
            </div>

            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLimitModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateLimit}
              disabled={updateLimitMutation.isPending}
            >
              {updateLimitMutation.isPending ? "Updating..." : "Update Limit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={isStatusUpdateModalOpen} onOpenChange={setIsStatusUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Change Request Status</DialogTitle>
            <DialogDescription>
              Change the status of this change request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedChangeLog && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm mb-1">
                  <strong>Change:</strong> {selectedChangeLog.changeDescription}
                </p>
                <p className="text-sm">
                  <strong>Current Status:</strong> {getChangeLogStatusBadge(selectedChangeLog.status)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newStatus === "completed" && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="send-email"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
                  Send email notification to customer
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStatus}
              disabled={updateChangeLogStatusMutation.isPending}
            >
              {updateChangeLogStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}