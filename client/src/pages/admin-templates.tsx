import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Eye, Trash2, Mail, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function AdminTemplates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch admin templates (no websiteProgressId needed)
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/templates"],
    queryFn: async () => {
      const response = await fetch("/api/admin/templates", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest("DELETE", `/api/admin/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      toast({
        title: "Template deleted",
        description: "Template has been deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingTemplateId(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to delete template";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDeletingTemplateId(null);
    },
  });

  const handleDeleteTemplate = (templateId: number) => {
    setDeletingTemplateId(templateId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingTemplateId) {
      deleteTemplateMutation.mutate(deletingTemplateId);
    }
  };

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
            <h1 className="text-2xl font-semibold">Admin Email Templates</h1>
            <p className="text-muted-foreground mt-2">
              View and manage your saved email templates
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate(`/admin/email-builder`)}
          data-testid="button-create-new-template"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Template
        </Button>
      </div>

      {templatesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-templates" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-muted rounded-md">
                  <Mail className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No templates saved yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first email template using the email builder
              </p>
              <Button onClick={() => navigate(`/admin/email-builder`)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:border-primary transition-colors flex flex-col"
              data-testid={`template-card-${template.id}`}
            >
              <CardHeader className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold mb-1">
                      {template.name}
                    </CardTitle>
                    {template.category && (
                      <Badge variant="outline" className="mb-2">
                        {template.category}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Last updated:{" "}
                      {new Date(
                        template.updatedAt || template.createdAt,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      sessionStorage.setItem(
                        "loadTemplateId",
                        template.id.toString(),
                      );
                      navigate(`/admin/email-builder`);
                    }}
                    className="flex-1"
                    data-testid={`button-edit-${template.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const previewWindow = window.open("", "_blank");
                      if (previewWindow) {
                        previewWindow.document.write(template.html);
                        previewWindow.document.close();
                      }
                    }}
                    className="flex-1"
                    data-testid={`button-preview-${template.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="flex-1 text-destructive hover:text-destructive"
                    data-testid={`button-delete-${template.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteTemplateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}