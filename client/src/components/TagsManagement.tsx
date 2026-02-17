import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tag as TagIcon, Plus, Edit3, Trash2, Shield } from "lucide-react";
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

interface TagsManagementProps {
  websiteProgressId: number;
  planSubscription?: any;
}

const tagFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

type TagFormData = z.infer<typeof tagFormSchema>;

const defaultColors = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
];

export function TagsManagement({ websiteProgressId, planSubscription }: TagsManagementProps) {
  const { toast } = useToast();
  const disabled = planSubscription?.status !== "active";
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [deletingTagId, setDeletingTagId] = useState<number | null>(null);

  // Fetch tags
  const { data: tags = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`],
    enabled: !!websiteProgressId,
  });

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: defaultColors[0],
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      return await apiRequest("POST", "/api/tags", {
        ...data,
        websiteProgressId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: "Tag created",
        description: "Tag has been created successfully",
      });
      setShowAddDialog(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async (data: TagFormData & { id: number }) => {
      return await apiRequest("PUT", `/api/tags/${data.id}`, {
        ...data,
        websiteProgressId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: "Tag updated",
        description: "Tag has been updated successfully",
      });
      setShowEditDialog(false);
      setEditingTag(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      return await apiRequest("DELETE", `/api/tags/${tagId}?websiteProgressId=${websiteProgressId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: "Tag deleted",
        description: "Tag has been deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingTagId(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to delete tag";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDeletingTagId(null);
    },
  });

  const handleAddTag = (data: TagFormData) => {
    createTagMutation.mutate(data);
  };

  const handleEditTag = (tag: any) => {
    setEditingTag(tag);
    form.reset({
      name: tag.name,
      description: tag.description || "",
      color: tag.color || defaultColors[0],
    });
    setShowEditDialog(true);
  };

  const handleUpdateTag = (data: TagFormData) => {
    if (!editingTag) return;
    updateTagMutation.mutate({ ...data, id: editingTag.id });
  };

  const handleDeleteTag = (tagId: number) => {
    setDeletingTagId(tagId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingTagId) {
      deleteTagMutation.mutate(deletingTagId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading tags...</p>
      </div>
    );
  }

  const systemTags = tags.filter((tag) => tag.isSystem);
  const userTags = tags.filter((tag) => !tag.isSystem);

  return (
    <div className={`space-y-6 ${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TagIcon className="w-5 h-5" />
                Tags
              </CardTitle>
              <CardDescription className="mt-2">
                Organize your contacts with tags. Tags allow flexible categorization - contacts can have multiple tags.
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                form.reset();
                setShowAddDialog(true);
              }}
              data-testid="button-add-tag"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No tags yet. Create your first tag to start organizing contacts.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Tag
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* System Tags Section */}
              {systemTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">System Tags</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {systemTags.map((tag) => (
                      <Card key={tag.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TagIcon className="w-4 h-4" style={{ color: tag.color || "#888" }} />
                              <h3 className="font-semibold">{tag.name} ({tag.contactCount || 0})</h3>
                              <Badge variant="outline" className="text-xs">System</Badge>
                            </div>
                          </div>
                          {tag.description && (
                            <p className="text-sm text-muted-foreground mt-2">{tag.description}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* User Tags Section */}
              {userTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Your Tags</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {userTags.map((tag) => (
                      <Card key={tag.id} className="border border-gray-200" data-testid={`card-tag-${tag.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TagIcon className="w-4 h-4" style={{ color: tag.color || "#888" }} />
                              <h3 className="font-semibold">{tag.name} ({tag.contactCount || 0})</h3>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditTag(tag)}
                                className="h-6 w-6"
                                data-testid={`button-edit-tag-${tag.id}`}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteTag(tag.id)}
                                className="h-6 w-6"
                                data-testid={`button-delete-tag-${tag.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {tag.description && (
                            <p className="text-sm text-muted-foreground">{tag.description}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tag Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to organize your contacts.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddTag)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., VIP Customer" data-testid="input-tag-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Optional description for this tag"
                        rows={2}
                        data-testid="input-tag-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormDescription>Choose a color to identify this tag</FormDescription>
                    <div className="flex gap-2 flex-wrap">
                      {defaultColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-md border-2 ${field.value === color ? "border-gray-900 dark:border-white" : "border-transparent"
                            }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                          data-testid={`button-color-${color}`}
                        />
                      ))}
                    </div>
                    <FormControl>
                      <Input {...field} type="text" placeholder="#000000" className="mt-2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTagMutation.isPending} data-testid="button-submit-tag">
                  {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update tag information.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateTag)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., VIP Customer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Optional description for this tag"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormDescription>Choose a color to identify this tag</FormDescription>
                    <div className="flex gap-2 flex-wrap">
                      {defaultColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-md border-2 ${field.value === color ? "border-gray-900 dark:border-white" : "border-transparent"
                            }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        />
                      ))}
                    </div>
                    <FormControl>
                      <Input {...field} type="text" placeholder="#000000" className="mt-2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTagMutation.isPending}>
                  {updateTagMutation.isPending ? "Updating..." : "Update Tag"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove the tag from all contacts, but contacts will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteTagMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTagMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
