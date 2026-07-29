
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RolePermissionsType } from "@shared/schema";

type RolePermissions = RolePermissionsType;

interface CustomRole {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  permissions: RolePermissions;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  canViewUsers: false,
  canManageUsers: false,
  canViewSubscriptions: false,
  canManageSubscriptions: false,
  canViewWebsites: false,
  canManageWebsites: false,
  canViewTemplates: false,
  canManageTemplates: false,
  canViewTips: false,
  canManageTips: false,
  canViewSettings: false,
  canManageSettings: false,
  canViewPlatformUsage: false,
  canViewNewsletter: false,
};

const permissionLabels: Record<keyof RolePermissions, string> = {
  canViewUsers: "View Users",
  canManageUsers: "Manage Users",
  canViewSubscriptions: "View Subscriptions",
  canManageSubscriptions: "Manage Subscriptions",
  canViewWebsites: "View Websites",
  canManageWebsites: "Manage Websites",
  canViewTemplates: "View Templates",
  canManageTemplates: "Manage Templates",
  canViewTips: "View Tips",
  canManageTips: "Manage Tips",
  canViewSettings: "View Settings",
  canManageSettings: "Manage Settings",
  canViewPlatformUsage: "View Platform Usage",
  canViewNewsletter: "View Newsletter",
};

function normalizePermissions(permissions: Partial<RolePermissions> | null | undefined): RolePermissions {
  return { ...DEFAULT_PERMISSIONS, ...(permissions || {}) };
}

export function RoleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState({
    displayName: "",
    description: "",
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  const { data: roles, isLoading } = useQuery<CustomRole[]>({
    queryKey: ["/api/admin/roles"],
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: typeof roleForm & { name: string }) => {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({ title: "Success", description: "Role created successfully" });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof roleForm }) => {
      const response = await fetch(`/api/admin/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({ title: "Success", description: "Role updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({ title: "Success", description: "Role deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete role", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setRoleForm({
      displayName: "",
      description: "",
      permissions: { ...DEFAULT_PERMISSIONS },
    });
  };

  const handleCreateRole = () => {
    const name = roleForm.displayName.toLowerCase().replace(/\s+/g, '_');
    createRoleMutation.mutate({ ...roleForm, name });
  };

  const handleEditRole = (role: CustomRole) => {
    setSelectedRole(role);
    setRoleForm({
      displayName: role.displayName,
      description: role.description || "",
      permissions: normalizePermissions(role.permissions),
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data: roleForm });
    }
  };

  const togglePermission = (key: keyof RolePermissions) => {
    const newValue = !roleForm.permissions[key];
    const updatedPermissions = { ...roleForm.permissions, [key]: newValue };

    // Hierarchical permission rules: manage permissions automatically enable view permissions
    const hierarchyMap: Record<string, string> = {
      'canManageUsers': 'canViewUsers',
      'canManageSubscriptions': 'canViewSubscriptions',
      'canManageWebsites': 'canViewWebsites',
      'canManageTemplates': 'canViewTemplates',
      'canManageTips': 'canViewTips',
      'canManageSettings': 'canViewSettings',
    };

    // If enabling a manage permission, also enable the corresponding view permission
    if (newValue && key in hierarchyMap) {
      const viewPermission = hierarchyMap[key] as keyof RolePermissions;
      updatedPermissions[viewPermission] = true;
    }

    // If disabling a view permission, also disable the corresponding manage permission
    if (!newValue) {
      const managePermission = Object.entries(hierarchyMap).find(([, view]) => view === key)?.[0];
      if (managePermission) {
        updatedPermissions[managePermission as keyof RolePermissions] = false;
      }
    }

    setRoleForm({
      ...roleForm,
      permissions: updatedPermissions,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Management</CardTitle>
              <CardDescription>Create and manage custom roles with specific permissions</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{role.displayName}</div>
                        {role.description && (
                          <div className="text-sm text-muted-foreground">{role.description}</div>
                        )}
                      </div>
                      {role.isSystem && <Badge variant="secondary">System</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(normalizePermissions(role.permissions))
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {permissionLabels[key as keyof RolePermissions]}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {!role.isSystem && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditRole(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRoleMutation.mutate(role.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Define a new role with custom permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-displayName">Display Name</Label>
              <Input
                id="create-displayName"
                value={roleForm.displayName}
                onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground">
                Note: Manage permissions automatically include view permissions
              </p>
              {Object.keys(permissionLabels).map((key) => {
                const isViewPermission = key.startsWith("canView");
                const managePermissionKey = key.replace("canView", "canManage") as keyof RolePermissions;
                const isAutoEnabled =
                  isViewPermission &&
                  managePermissionKey in roleForm.permissions &&
                  roleForm.permissions[managePermissionKey];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`create-${key}`} className="font-normal">
                      {permissionLabels[key as keyof RolePermissions]}
                    </Label>
                    <Switch
                      id={`create-${key}`}
                      checked={roleForm.permissions[key as keyof RolePermissions]}
                      onCheckedChange={() => togglePermission(key as keyof RolePermissions)}
                      disabled={Boolean(isAutoEnabled)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} disabled={createRoleMutation.isPending || !roleForm.displayName}>
              {createRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role permissions and details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                value={roleForm.displayName}
                onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground">
                Note: Manage permissions automatically include view permissions
              </p>
              {Object.keys(permissionLabels).map((key) => {
                const isViewPermission = key.startsWith("canView");
                const managePermissionKey = key.replace("canView", "canManage") as keyof RolePermissions;
                const isAutoEnabled =
                  isViewPermission &&
                  managePermissionKey in roleForm.permissions &&
                  roleForm.permissions[managePermissionKey];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`edit-${key}`} className="font-normal">
                      {permissionLabels[key as keyof RolePermissions]}
                    </Label>
                    <Switch
                      id={`edit-${key}`}
                      checked={roleForm.permissions[key as keyof RolePermissions]}
                      onCheckedChange={() => togglePermission(key as keyof RolePermissions)}
                      disabled={Boolean(isAutoEnabled)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
