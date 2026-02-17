
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Calendar } from "lucide-react";

interface Tip {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  createdBy: number;
  createdByUsername: string;
}

export function TipsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tipToDelete, setTipToDelete] = useState<Tip | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  // Get current user permissions
  const { data: userData } = useQuery<{ user: any; permissions: any }>({
    queryKey: ["/api/user"],
  });
  const userPermissions = userData?.permissions;

  const { data: settingsData } = useQuery<{ tipsVisibleInUserDashboard?: boolean }>({
    queryKey: ["/api/settings"],
    enabled: !!userPermissions?.canManageTips || !!userPermissions?.canManageSettings,
  });

  const { data: tipsData, isLoading } = useQuery<{ tips: Tip[] }>({
    queryKey: ["/api/tips"]
  });

  const tipsVisibleMutation = useMutation({
    mutationFn: async (visible: boolean) => {
      const response = await fetch("/api/settings/tips-visible", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible }),
      });
      if (!response.ok) throw new Error("Failed to update setting");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ description: "Tips visibility updated" });
    },
    onError: () => {
      toast({ description: "Failed to update tips visibility", variant: "destructive" });
    },
  });

  const createTipMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await fetch("/api/admin/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create tip");
      }
      return response.json();
    },
    onSuccess: () => {
      // Close dialog first
      setShowCreateDialog(false);
      // Reset form data
      setFormData({ title: "", content: "" });
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/tips"] });
      // Show success toast
      toast({
        title: "Success",
        description: "Tip created successfully",
      });
    },
    onError: (error: any) => {
      console.error("Create tip error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create tip",
        variant: "destructive",
      });
    },
  });

  const deleteTipMutation = useMutation({
    mutationFn: async (tipId: number) => {
      const response = await fetch(`/api/admin/tips/${tipId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete tip");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips"] });
      setShowDeleteDialog(false);
      setTipToDelete(null);
      toast({
        title: "Success",
        description: "Tip deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tip",
        variant: "destructive",
      });
    },
  });

  const handleCreateTip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createTipMutation.mutate(formData);
  };

  const handleDeleteTip = (tip: Tip) => {
    setTipToDelete(tip);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (tipToDelete) {
      deleteTipMutation.mutate(tipToDelete.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const tipsVisibleInUserDashboard = settingsData?.tipsVisibleInUserDashboard ?? true;

  return (
    <div className="space-y-6">
      {(userPermissions?.canManageTips || userPermissions?.canManageSettings) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User dashboard</CardTitle>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="tips-visible-toggle" className="text-sm font-medium">
                  Show tips section in user dashboard
                </Label>
                <p className="text-sm text-muted-foreground">
                  When off, the Tips menu and section are hidden from users.
                </p>
              </div>
              <Switch
                id="tips-visible-toggle"
                checked={tipsVisibleInUserDashboard}
                onCheckedChange={(checked) => tipsVisibleMutation.mutate(checked)}
                disabled={tipsVisibleMutation.isPending}
              />
            </div>
          </CardHeader>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tips Management</CardTitle>
            {userPermissions?.canManageTips && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Tip
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!tipsData?.tips || tipsData.tips.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No tips created yet.</p>
              {userPermissions?.canManageTips && (
                <Button 
                  className="mt-4" 
                  onClick={() => setShowCreateDialog(true)}
                >
                  Create Your First Tip
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Content Preview</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipsData.tips.map((tip) => (
                  <TableRow key={tip.id}>
                    <TableCell className="font-medium">{tip.title}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">
                        {tip.content.substring(0, 100)}...
                      </p>
                    </TableCell>
                    <TableCell>{tip.createdByUsername}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(tip.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {userPermissions?.canManageTips && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTip(tip)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Tip Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Tip</DialogTitle>
            <DialogDescription>
              Create a valuable tip for your users. This will appear in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTip} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter tip title..."
                required
              />
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Enter tip content..."
                className="min-h-[200px]"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTipMutation.isPending}
              >
                {createTipMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Tip"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tipToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteTipMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
