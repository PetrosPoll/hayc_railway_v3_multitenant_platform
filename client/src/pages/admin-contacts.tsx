import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Edit3, Trash2, Tag as TagIcon, Upload, X, Download, ArrowLeft, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const contactFormSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email").min(1, "Email is required"),
  status: z.enum(["pending", "active", "confirmed", "unsubscribed"]),
  tagIds: z.array(z.number()),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function AdminContacts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deletingContactId, setDeletingContactId] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<"single" | "bulk">("single");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [parsedContacts, setParsedContacts] = useState<any[]>([]);
  const [csvDuplicates, setCsvDuplicates] = useState<string[]>([]);
  const [csvExisting, setCsvExisting] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkTagsDialog, setShowBulkTagsDialog] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<number[]>([]);
  const [bulkSelectedStatus, setBulkSelectedStatus] = useState<"pending" | "active" | "confirmed" | "unsubscribed">("pending");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin contacts
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts"],
    queryFn: async () => {
      const response = await fetch("/api/admin/contacts", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      return response.json();
    },
  });

  // Fetch admin tags
  const { data: tags = [], refetch: refetchTags } = useQuery<any[]>({
    queryKey: ["/api/admin/tags"],
    queryFn: async () => {
      const response = await fetch("/api/admin/tags", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    },
  });

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      status: "pending",
      tagIds: [],
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/admin/contacts", {
        ...data,
        tags: data.tagIds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Contact created",
        description: "Contact has been created successfully",
      });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormData & { id: number }) => {
      const response = await apiRequest("PUT", `/api/admin/contacts/${data.id}`, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        status: data.status,
      });
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      // Update tags separately
      if (editingContact && variables.tagIds) {
        const currentTagIds = editingContact.tags?.map((t: any) => t.id) || [];
        const newTagIds = variables.tagIds;

        const tagsToAdd = newTagIds.filter((id: number) => !currentTagIds.includes(id));
        const tagsToRemove = currentTagIds.filter((id: number) => !newTagIds.includes(id));

        for (const tagId of tagsToAdd) {
          await apiRequest("POST", `/api/admin/contacts/${editingContact.id}/tags/${tagId}`);
        }

        for (const tagId of tagsToRemove) {
          await apiRequest("DELETE", `/api/admin/contacts/${editingContact.id}/tags/${tagId}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Contact updated",
        description: "Contact has been updated successfully",
      });
      setShowEditDialog(false);
      setEditingContact(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return await apiRequest("DELETE", `/api/admin/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact has been deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingContactId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDeletingContactId(null);
    },
  });

  // Bulk delete contacts mutation
  const bulkDeleteContactsMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const response = await apiRequest("DELETE", "/api/admin/contacts/bulk-delete", {
        contactIds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Contacts deleted",
        description: "Selected contacts have been deleted successfully",
      });
      setSelectedContacts([]);
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contacts",
        variant: "destructive",
      });
      setShowBulkDeleteDialog(false);
    },
  });

  // Bulk assign tags mutation
  const bulkAssignTagsMutation = useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: number[]; tagIds: number[] }) => {
      const assignPromises: Promise<any>[] = [];
      for (const contactId of contactIds) {
        for (const tagId of tagIds) {
          assignPromises.push(apiRequest("POST", `/api/admin/contacts/${contactId}/tags/${tagId}`));
        }
      }
      await Promise.all(assignPromises);
      return { contactIds, tagIds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Tags assigned",
        description: "Tags have been assigned to selected contacts",
      });
      setBulkSelectedTagIds([]);
      setShowBulkTagsDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign tags",
        variant: "destructive",
      });
    },
  });

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: number[]; status: "pending" | "active" | "confirmed" | "unsubscribed" }) => {
      const updatePromises = contactIds.map((contactId) =>
        apiRequest("PUT", `/api/admin/contacts/${contactId}`, {
          status,
        })
      );
      await Promise.all(updatePromises);
      return { contactIds, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Status updated",
        description: "Status has been updated for selected contacts",
      });
      setShowBulkStatusDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const handleAddContact = (data: ContactFormData) => {
    createContactMutation.mutate(data);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    form.reset({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email,
      status: contact.status,
      tagIds: contact.tags?.map((t: any) => t.id) || [],
    });
    setShowEditDialog(true);
  };

  const handleUpdateContact = (data: ContactFormData) => {
    if (!editingContact) return;
    updateContactMutation.mutate({ ...data, id: editingContact.id });
  };

  const handleDeleteContact = (contactId: number) => {
    setDeletingContactId(contactId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingContactId) {
      deleteContactMutation.mutate(deletingContactId);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedContacts.length > 0) {
      bulkDeleteContactsMutation.mutate(selectedContacts);
    }
  };

  const handleBulkAssignTags = () => {
    if (selectedContacts.length > 0 && bulkSelectedTagIds.length > 0) {
      bulkAssignTagsMutation.mutate({ contactIds: selectedContacts, tagIds: bulkSelectedTagIds });
    }
  };

  const handleBulkUpdateStatus = () => {
    if (selectedContacts.length > 0) {
      bulkUpdateStatusMutation.mutate({ contactIds: selectedContacts, status: bulkSelectedStatus });
    }
  };

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const response = await apiRequest("POST", "/api/admin/tags", {
        name: tagName,
        color: '#888888',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tags"] });
    },
  });

  // Extract unique tag names from CSV
  const extractTagNamesFromCSV = (csvContent: string): string[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').toLowerCase());
    const tagsIndex = headers.findIndex(h => h === 'tags' || h === 'tag');

    if (tagsIndex === -1) return [];

    const tagNamesSet = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values[tagsIndex]) {
        const tagNames = values[tagsIndex]
          .split(',')
          .map((name: string) => name.trim())
          .filter((name: string) => name.length > 0);
        tagNames.forEach(name => tagNamesSet.add(name));
      }
    }
    return Array.from(tagNamesSet);
  };

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  };

  // Parse CSV file
  const parseCSV = (csvContent: string, currentTags: any[] = tags): { contacts: any[]; duplicates: string[]; existing: string[] } => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return { contacts: [], duplicates: [], existing: [] };

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const emailIndex = headers.findIndex(h => h === 'email' || h === 'user email');
    const firstNameIndex = headers.findIndex(h => h === 'first_name' || h === 'first name' || h === 'firstname');
    const lastNameIndex = headers.findIndex(h => h === 'last_name' || h === 'last name' || h === 'lastname');
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'username' || h === 'display name');
    const statusIndex = headers.findIndex(h => h === 'status');
    const tagsIndex = headers.findIndex(h => h === 'tags' || h === 'tag');

    if (emailIndex === -1) {
      throw new Error('CSV must contain an "email" column');
    }

    const tagNameToIdMap = new Map<string, number>();
    currentTags.forEach((tag: any) => {
      tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
    });

    const newContacts: any[] = [];
    const emailSet = new Set<string>();
    const duplicateEmails = new Set<string>();
    const existingEmails = new Set<string>();

    const existingContactEmails = new Set(contacts.map((c: any) => c.email?.toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      const email = values[emailIndex]?.toLowerCase().trim();

      if (!email) continue;

      if (emailSet.has(email)) {
        duplicateEmails.add(email);
        continue;
      }

      if (existingContactEmails.has(email)) {
        existingEmails.add(email);
        continue;
      }

      emailSet.add(email);

      let tagIds: number[] = [];
      let tagNames: string[] = [];
      if (tagsIndex !== -1 && values[tagsIndex]) {
        tagNames = values[tagsIndex]
          .split(',')
          .map((name: string) => name.trim())
          .filter((name: string) => name.length > 0);
        
        tagIds = tagNames
          .map((tagName: string) => tagNameToIdMap.get(tagName.toLowerCase()))
          .filter((tagId: number | undefined): tagId is number => tagId !== undefined);
      }

      let first_name = '';
      let last_name = '';
      
      if (firstNameIndex !== -1 && lastNameIndex !== -1) {
        first_name = values[firstNameIndex] || '';
        last_name = values[lastNameIndex] || '';
      } else if (nameIndex !== -1) {
        // Split name into first and last if only name column exists
        const fullName = values[nameIndex] || '';
        const nameParts = fullName.trim().split(/\s+/);
        first_name = nameParts[0] || '';
        last_name = nameParts.slice(1).join(' ') || '';
      }

      newContacts.push({
        email: values[emailIndex].trim(),
        first_name: first_name,
        last_name: last_name,
        status: statusIndex !== -1 ? (values[statusIndex] || 'pending').toLowerCase() : 'pending',
        tagIds: tagIds,
        tagNames: tagNames,
      });
    }

    return {
      contacts: newContacts,
      duplicates: Array.from(duplicateEmails),
      existing: Array.from(existingEmails),
    };
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseCSV(content);
        setCsvContent(content);
        setParsedContacts(result.contacts);
        setCsvDuplicates(result.duplicates);
        setCsvExisting(result.existing);
        setCsvFile(file);

        let message = `Found ${result.contacts.length} contacts to import`;
        if (result.duplicates.length > 0 || result.existing.length > 0) {
          message += `. ${result.duplicates.length} duplicate contacts in CSV, ${result.existing.length} already exist`;
        }

        toast({
          title: "File loaded",
          description: message,
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to parse CSV file",
          variant: "destructive",
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
  };

  // Clear file
  const handleClearFile = () => {
    setCsvFile(null);
    setCsvContent("");
    setParsedContacts([]);
    setCsvDuplicates([]);
    setCsvExisting([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export contacts as CSV
  const handleExportContacts = async () => {
    try {
      const response = await fetch("/api/admin/contacts/export", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export contacts");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "contacts_export.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: `Exported ${contacts.length} contacts`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export contacts",
        variant: "destructive",
      });
    }
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const escapeCsvValue = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Sample data showing various status values that are auto-mapped during import:
    // - "subscribed", "active", "yes", "true" → active
    // - "confirmed", "verified" → confirmed
    // - "unsubscribed", "cleaned", "bounced", "inactive" → unsubscribed
    // - empty or unknown → pending
    const sampleData = [
      ["email", "first_name", "last_name", "status"],
      ["john.doe@example.com", "John", "Doe", "subscribed"],
      ["jane.smith@example.com", "Jane", "Smith", "active"],
      ["bob.johnson@example.com", "Bob", "Johnson", "confirmed"],
      ["alice.brown@example.com", "Alice", "Brown", "unsubscribed"],
      ["charlie.wilson@example.com", "Charlie", "Wilson", ""],
    ];
    const csvContent = sampleData.map(row => row.map(escapeCsvValue).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_contacts.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (contacts: any[]) => {
      const chunkSize = 500;
      const totalContacts = contacts.length;
      let importedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ email: string; error: string }> = [];
      const allImportedContacts: any[] = [];

      for (let i = 0; i < totalContacts; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize);
        const contactsWithTags = chunk.map(contact => ({
          ...contact,
          tags: contact.tagIds || [],
        }));
        const response = await apiRequest("POST", "/api/admin/contacts/bulk-import", {
          contacts: contactsWithTags,
        });
        const data = await response.json();
        importedCount += data.imported;
        skippedCount += data.skipped;
        errors.push(...data.errors);
        allImportedContacts.push(...chunk);
      }
      return { imported: importedCount, skipped: skippedCount, errors, allImportedContacts };
    },
    onSuccess: async (data: any, variables: any[]) => {
      await refetchContacts();
      const refetchTagsResult = await refetchTags();
      const updatedTags = refetchTagsResult.data || tags;

      const emailToTagNamesMap = new Map<string, string[]>();
      variables.forEach(contact => {
        if (contact.tagNames && contact.tagNames.length > 0) {
          emailToTagNamesMap.set(contact.email.toLowerCase(), contact.tagNames);
        }
      });

      const allContacts = await queryClient.fetchQuery<any[]>({
        queryKey: ["/api/admin/contacts"],
      });

      const importedContactEmails = new Set(variables.map(c => c.email.toLowerCase()));
      const importedContacts = allContacts.filter((c: any) => 
        importedContactEmails.has(c.email.toLowerCase())
      );

      const tagNameToIdMap = new Map<string, number>();
      updatedTags.forEach((tag: any) => {
        tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
      });

      const existingTagNames = new Set(updatedTags.map((tag: any) => tag.name.toLowerCase()));
      const tagsToCreate = new Set<string>();
      const tagsToAssign: Array<{ contactId: number; tagId: number }> = [];

      for (const contact of importedContacts) {
        const csvTagNames = emailToTagNamesMap.get(contact.email.toLowerCase()) || [];
        
        for (const tagName of csvTagNames) {
          const tagNameLower = tagName.toLowerCase();
          
          if (!existingTagNames.has(tagNameLower)) {
            tagsToCreate.add(tagName);
          } else {
            const tagId = tagNameToIdMap.get(tagNameLower);
            if (tagId) {
              const contactTagIds = contact.tags?.map((t: any) => t.id) || [];
              if (!contactTagIds.includes(tagId)) {
                tagsToAssign.push({ contactId: contact.id, tagId });
              }
            }
          }
        }
      }

      if (tagsToCreate.size > 0) {
        const createPromises = Array.from(tagsToCreate).map(tagName => 
          createTagMutation.mutateAsync(tagName)
        );
        await Promise.all(createPromises);
        const finalTagsResult = await refetchTags();
        const finalTags = finalTagsResult.data || updatedTags;
        
        finalTags.forEach((tag: any) => {
          tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
        });
        existingTagNames.clear();
        finalTags.forEach((tag: any) => {
          existingTagNames.add(tag.name.toLowerCase());
        });
      }

      for (const contact of importedContacts) {
        const csvTagNames = emailToTagNamesMap.get(contact.email.toLowerCase()) || [];
        const contactTagIds = contact.tags?.map((t: any) => t.id) || [];
        
        for (const tagName of csvTagNames) {
          const tagNameLower = tagName.toLowerCase();
          const tagId = tagNameToIdMap.get(tagNameLower);
          
          if (tagId && !contactTagIds.includes(tagId)) {
            const alreadyQueued = tagsToAssign.some(
              t => t.contactId === contact.id && t.tagId === tagId
            );
            if (!alreadyQueued) {
              tagsToAssign.push({ contactId: contact.id, tagId });
            }
          }
        }
      }

      for (const { contactId, tagId } of tagsToAssign) {
        try {
          await apiRequest("POST", `/api/admin/contacts/${contactId}/tags/${tagId}`);
        } catch (error) {
          // Tag might already be assigned, ignore error
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      
      let description = `Imported ${data.imported} contacts, skipped ${data.skipped} existing contacts`;
      if (tagsToCreate.size > 0) {
        description += `, created ${tagsToCreate.size} new tag${tagsToCreate.size > 1 ? 's' : ''}`;
      }
      if (data.errors.length > 0) {
        description += `, ${data.errors.length} errors`;
      }

      toast({
        title: "Import complete",
        description,
      });
      setShowAddDialog(false);
      setCsvFile(null);
      setCsvContent("");
      setParsedContacts([]);
      setCsvDuplicates([]);
      setCsvExisting([]);
      setImportMode("single");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to import contacts",
        variant: "destructive",
      });
    },
  });

  const handleBulkImport = () => {
    if (parsedContacts.length === 0) {
      toast({
        title: "Error",
        description: "No contacts to import",
        variant: "destructive",
      });
      return;
    }
    bulkImportMutation.mutate(parsedContacts);
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(contacts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = contacts.slice(startIndex, endIndex);

  // Calculate which pages to show
  const getPagesToShow = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Show current page ± 3 pages
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, currentPage + 3);
    
    // Adjust if we're near the beginning
    if (currentPage <= 4) {
      startPage = 1;
      endPage = 7;
    }
    // Adjust if we're near the end
    else if (currentPage >= totalPages - 3) {
      startPage = totalPages - 6;
      endPage = totalPages;
    }
    
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };
  
  const pagesToShow = getPagesToShow();

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [contacts.length, currentPage, totalPages]);

  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Clear selection when contacts change
  useEffect(() => {
    setSelectedContacts([]);
  }, [contacts.length]);

  if (contactsLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 mt-16">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin?tab=newsletter`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Admin Contacts</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Contacts ({contacts.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportContacts}
                  disabled={contacts.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={() => {
                    form.reset({
                      first_name: "",
                      last_name: "",
                      email: "",
                      status: "pending",
                      tagIds: [],
                    });
                    setShowAddDialog(true);
                  }}
                  data-testid="button-add-contact"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No contacts yet. Add your first contact to get started.
                </p>
              </div>
            ) : (
              <>
                {selectedContacts.length > 0 && (
                  <div className="mb-4 flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {selectedContacts.length} {selectedContacts.length === 1 ? "contact selected" : "contacts selected"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedContacts.length === contacts.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContacts(contacts.map((contact) => contact.id));
                            } else {
                              setSelectedContacts([]);
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">Select All</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBulkSelectedStatus("pending");
                          setShowBulkStatusDialog(true);
                        }}
                        disabled={bulkUpdateStatusMutation.isPending}
                      >
                        Change Status
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setBulkSelectedTagIds([]);
                          setShowBulkTagsDialog(true);
                        }}
                        className="h-8 w-8"
                        disabled={bulkAssignTagsMutation.isPending}
                      >
                        <TagIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        className="h-8 w-8 text-red-600 hover:text-red-800"
                        disabled={bulkDeleteContactsMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                        </TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Subscribed</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContacts.map((contact) => (
                        <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedContacts((prev) => [...prev, contact.id]);
                                } else {
                                  setSelectedContacts((prev) => prev.filter((id) => id !== contact.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{contact.first_name || "-"}</TableCell>
                          <TableCell>{contact.last_name || "-"}</TableCell>
                          <TableCell>{contact.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {contact.tags && contact.tags.length > 0 ? (
                                contact.tags.map((tag: any) => (
                                  <Badge key={tag.id} variant="secondary" style={{ borderColor: tag.color }}>
                                    <TagIcon className="w-3 h-3 mr-1" style={{ color: tag.color }} />
                                    {tag.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No tags</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contact.status === "active" || contact.status === "confirmed"
                                  ? "default"
                                  : contact.status === "unsubscribed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {contact.status === "active" 
                                ? "Subscribed" 
                                : contact.status === "confirmed"
                                  ? "Confirmed"
                                  : contact.status === "unsubscribed"
                                    ? "Unsubscribed"
                                    : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contact.subscribedAt
                              ? new Date(contact.subscribedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditContact(contact)}
                                className="h-8 w-8"
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteContact(contact.id)}
                                className="h-8 w-8 text-red-600 hover:text-red-800"
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => setItemsPerPage(Number(value))}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination className="ml-auto !mx-0 !w-auto !justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage((prev) => prev - 1);
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {pagesToShow.map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Contact Dialog */}
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          setShowAddDialog(open);
          if (open) {
            form.reset({
              first_name: "",
              last_name: "",
              email: "",
              status: "pending",
              tagIds: [],
            });
          } else {
            setImportMode("single");
            handleClearFile();
            form.reset({
              first_name: "",
              last_name: "",
              email: "",
              status: "pending",
              tagIds: [],
            });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
              <DialogDescription>
                Add a new contact to your list
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={importMode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setImportMode("single");
                  handleClearFile();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Single Contact
              </Button>
              <Button
                type="button"
                variant={importMode === "bulk" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setImportMode("bulk");
                  form.reset();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import File
              </Button>
            </div>

            {importMode === "bulk" ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">CSV File</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadSample}
                      className="h-7 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download Sample
                    </Button>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="flex-1"
                          />
                          {csvFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={handleClearFile}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TooltipTrigger>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV should contain columns: email, first_name/last_name or name (optional), status (optional), tags (optional)
                  </p>
                </div>

                {parsedContacts.length > 0 && (
                  <div className="border rounded-md p-3 bg-muted/50">
                    <p className="text-sm font-medium mb-2">
                      Found {parsedContacts.length} contacts
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {parsedContacts.slice(0, 10).map((contact, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {contact.email} {contact.first_name || contact.last_name ? `(${[contact.first_name, contact.last_name].filter(Boolean).join(' ')})` : ''}
                        </div>
                      ))}
                      {parsedContacts.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {parsedContacts.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={bulkImportMutation.isPending || parsedContacts.length === 0}
                  >
                    {bulkImportMutation.isPending ? "Importing..." : "Import"}
                  </Button>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddContact)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John" data-testid="input-contact-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Doe" data-testid="input-contact-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="john@example.com" data-testid="input-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contact-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="active">Subscribed</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tagIds"
                    render={() => (
                      <FormItem>
                        <FormLabel>Tags (Optional)</FormLabel>
                        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                          {tags.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No tags available
                            </p>
                          ) : (
                            tags.map((tag: any) => (
                              <FormField
                                key={tag.id}
                                control={form.control}
                                name="tagIds"
                                render={({ field }) => {
                                  return (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(tag.id)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            if (checked) {
                                              field.onChange([...currentValue, tag.id]);
                                            } else {
                                              field.onChange(currentValue.filter((id: number) => id !== tag.id));
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <div className="flex items-center gap-2">
                                        <TagIcon className="h-3 w-3" style={{ color: tag.color || "#888" }} />
                                        <FormLabel className="text-sm font-normal cursor-pointer">
                                          {tag.name}
                                        </FormLabel>
                                      </div>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createContactMutation.isPending} data-testid="button-submit-contact">
                      {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingContact(null);
            form.reset();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>
                Update contact information
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateContact)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="john@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="active">Subscribed</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tagIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>Tags (Optional)</FormLabel>
                      <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                        {tags.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No tags available
                          </p>
                        ) : (
                          tags.map((tag: any) => (
                            <FormField
                              key={tag.id}
                              control={form.control}
                              name="tagIds"
                              render={({ field }) => {
                                return (
                                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(tag.id)}
                                        onCheckedChange={(checked) => {
                                          const currentValue = field.value || [];
                                          if (checked) {
                                            field.onChange([...currentValue, tag.id]);
                                          } else {
                                            field.onChange(currentValue.filter((id: number) => id !== tag.id));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <div className="flex items-center gap-2">
                                      <TagIcon className="h-3 w-3" style={{ color: tag.color || "#888" }} />
                                      <FormLabel className="text-sm font-normal cursor-pointer">
                                        {tag.name}
                                      </FormLabel>
                                    </div>
                                  </FormItem>
                                );
                              }}
                            />
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateContactMutation.isPending}>
                    {updateContactMutation.isPending ? "Updating..." : "Update Contact"}
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
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contact? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteContactMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedContacts.length === 1 ? "Delete Contact" : "Delete Contacts"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedContacts.length === 1
                  ? "Are you sure you want to delete this contact? This action cannot be undone."
                  : `Are you sure you want to delete ${selectedContacts.length} contacts? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                disabled={bulkDeleteContactsMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkDeleteContactsMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Update Status Dialog */}
        <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status</DialogTitle>
              <DialogDescription>
                Select a new status for the selected contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={bulkSelectedStatus}
                onValueChange={(value: "pending" | "active" | "confirmed" | "unsubscribed") => setBulkSelectedStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Subscribed</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowBulkStatusDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkUpdateStatus}
                  disabled={bulkUpdateStatusMutation.isPending}
                >
                  {bulkUpdateStatusMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Assign Tags Dialog */}
        <Dialog open={showBulkTagsDialog} onOpenChange={setShowBulkTagsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Tags</DialogTitle>
              <DialogDescription>
                Select tags to assign to the selected contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No tags available
                  </p>
                ) : (
                  tags.map((tag: any) => (
                    <div key={tag.id} className="flex items-center space-x-3">
                      <Checkbox
                        checked={bulkSelectedTagIds.includes(tag.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkSelectedTagIds((prev) => [...prev, tag.id]);
                          } else {
                            setBulkSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <TagIcon className="h-3 w-3" style={{ color: tag.color || "#888" }} />
                        <label className="text-sm font-normal cursor-pointer">
                          {tag.name}
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowBulkTagsDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkAssignTags}
                  disabled={bulkAssignTagsMutation.isPending || bulkSelectedTagIds.length === 0}
                >
                  {bulkAssignTagsMutation.isPending ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Operation Loading Overlay */}
        <Dialog open={bulkImportMutation.isPending || bulkDeleteContactsMutation.isPending || bulkUpdateStatusMutation.isPending || bulkAssignTagsMutation.isPending} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">
                  {bulkImportMutation.isPending
                    ? "Importing"
                    : bulkDeleteContactsMutation.isPending
                    ? "Deleting"
                    : bulkUpdateStatusMutation.isPending
                    ? "Updating"
                    : "Assigning"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {bulkImportMutation.isPending
                    ? "Importing contacts, please wait..."
                    : bulkDeleteContactsMutation.isPending
                    ? `Deleting ${selectedContacts.length} contact${selectedContacts.length > 1 ? "s" : ""}, please wait...`
                    : bulkUpdateStatusMutation.isPending
                    ? `Updating status for ${selectedContacts.length} contact${selectedContacts.length > 1 ? "s" : ""}, please wait...`
                    : `Assigning tags to ${selectedContacts.length} contact${selectedContacts.length > 1 ? "s" : ""}, please wait...`}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
