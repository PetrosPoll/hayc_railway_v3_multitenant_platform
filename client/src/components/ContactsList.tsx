import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Edit3, Trash2, Tag as TagIcon, Upload, X, Download, Loader2, Search, Filter } from "lucide-react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useTranslation } from "react-i18next";

interface ContactsListProps {
  websiteProgressId: number;
  planSubscription?: any;
}

export function ContactsList({ websiteProgressId, planSubscription }: ContactsListProps) {
  const { t } = useTranslation();

  const contactFormSchema = z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email(t("forgotPassword.emailRequired")).min(1, t("forgotPassword.emailRequiredMessage")),
    status: z.enum(["pending", "active", "confirmed", "unsubscribed"]),
    tagIds: z.array(z.number()),
  });

  type ContactFormData = z.infer<typeof contactFormSchema>;
  const { toast } = useToast();
  const disabled = planSubscription?.status !== "active";
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkTagsDialog, setShowBulkTagsDialog] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<number[]>([]);
  const [bulkSelectedStatus, setBulkSelectedStatus] = useState<"pending" | "active" | "confirmed" | "unsubscribed">("pending");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // Fetch contacts
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery<any[]>({
    queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`],
    enabled: !!websiteProgressId,
  });

  // Fetch tags
  const { data: tags = [], refetch: refetchTags } = useQuery<any[]>({
    queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`],
    enabled: !!websiteProgressId,
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
      const response = await apiRequest("POST", "/api/contacts", {
        ...data,
        websiteProgressId,
        tags: data.tagIds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.contactCreated"),
        description: t("newsletter.contactCreatedDescription"),
      });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t("forgotPassword.error"),
        description: error?.message || t("newsletter.failedToCreateContact"),
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormData & { id: number }) => {
      const response = await apiRequest("PUT", `/api/contacts/${data.id}`, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        status: data.status,
        websiteProgressId,
      });
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      // Update tags separately
      if (editingContact && variables.tagIds) {
        const currentTagIds = editingContact.tags?.map((t: any) => t.id) || [];
        const newTagIds = variables.tagIds;

        // Tags to add
        const tagsToAdd = newTagIds.filter((id: number) => !currentTagIds.includes(id));
        // Tags to remove
        const tagsToRemove = currentTagIds.filter((id: number) => !newTagIds.includes(id));

        // Add new tags
        for (const tagId of tagsToAdd) {
          await apiRequest("POST", `/api/contacts/${editingContact.id}/tags/${tagId}`);
        }

        // Remove old tags
        for (const tagId of tagsToRemove) {
          await apiRequest("DELETE", `/api/contacts/${editingContact.id}/tags/${tagId}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.contactUpdated"),
        description: t("newsletter.contactUpdatedDescription"),
      });
      setShowEditDialog(false);
      setEditingContact(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t("forgotPassword.error"),
        description: error?.message || t("newsletter.failedToUpdateContact"),
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return await apiRequest("DELETE", `/api/contacts/${contactId}?websiteProgressId=${websiteProgressId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.contactDeleted"),
        description: t("newsletter.contactDeletedDescription"),
      });
      setShowDeleteDialog(false);
      setDeletingContactId(null);
    },
    onError: () => {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.failedToDeleteContact"),
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDeletingContactId(null);
    },
  });

  // Bulk delete contacts mutation
  const bulkDeleteContactsMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const response = await apiRequest("DELETE", "/api/contacts/bulk-delete", {
        contactIds,
        websiteProgressId,
      });
      return response.json();
    },
    onSuccess: (deletedIds) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.contactDeleted"),
        description: t("newsletter.contactDeletedDescription"),
      });
      setSelectedContacts([]);
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.failedToDeleteContact"),
        variant: "destructive",
      });
      setShowBulkDeleteDialog(false);
    },
  });

  const handleAddContact = (data: ContactFormData) => {
    createContactMutation.mutate(data);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    form.reset({
      first_name: contact.firstName || "",
      last_name: contact.lastName || "",
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

  // Bulk assign tags mutation
  const bulkAssignTagsMutation = useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: number[]; tagIds: number[] }) => {
      const assignPromises: Promise<any>[] = [];
      for (const contactId of contactIds) {
        for (const tagId of tagIds) {
          assignPromises.push(apiRequest("POST", `/api/contacts/${contactId}/tags/${tagId}`));
        }
      }
      await Promise.all(assignPromises);
      return { contactIds, tagIds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.tagsAssigned"),
        description: t("newsletter.tagsAssignedDescription"),
      });
      setBulkSelectedTagIds([]);
      setShowBulkTagsDialog(false);
    },
    onError: () => {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.failedToAssignTags"),
        variant: "destructive",
      });
    },
  });

  const handleBulkAssignTags = () => {
    if (selectedContacts.length > 0 && bulkSelectedTagIds.length > 0) {
      bulkAssignTagsMutation.mutate({ contactIds: selectedContacts, tagIds: bulkSelectedTagIds });
    }
  };

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: number[]; status: "pending" | "active" | "confirmed" | "unsubscribed" }) => {
      const updatePromises = contactIds.map((contactId) =>
        apiRequest("PUT", `/api/contacts/${contactId}`, {
          websiteProgressId,
          status,
        })
      );
      await Promise.all(updatePromises);
      return { contactIds, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      toast({
        title: t("newsletter.statusUpdated"),
        description: t("newsletter.statusUpdatedDescription"),
      });
      setShowBulkStatusDialog(false);
    },
    onError: () => {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.failedToUpdateStatus"),
        variant: "destructive",
      });
    },
  });

  const handleBulkUpdateStatus = () => {
    if (selectedContacts.length > 0) {
      bulkUpdateStatusMutation.mutate({ contactIds: selectedContacts, status: bulkSelectedStatus });
    }
  };

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const response = await apiRequest("POST", "/api/tags", {
        name: tagName,
        websiteProgressId,
        color: 'bg-gray-100 text-gray-800',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`] });
    },
  });

  // Extract unique tag names from CSV
  const extractTagNamesFromCSV = (csvContent: string): string[] => {
    // Strip BOM if present (common in Excel/Windows exports)
    const cleanedContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanedContent.trim().split('\n');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').toLowerCase());
    // Support various tag column names from different email platforms
    const tagsIndex = headers.findIndex(h => h === 'tags' || h === 'tag' || h === 'groups' || h === 'group');

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
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    values.push(current.trim());
    return values;
  };

  // Parse CSV file
  const parseCSV = (csvContent: string, currentTags: any[] = tags): { contacts: any[]; duplicates: string[]; existing: string[] } => {
    // Strip BOM if present (common in Excel/Windows exports)
    const cleanedContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanedContent.trim().split('\n');
    if (lines.length < 2) return { contacts: [], duplicates: [], existing: [] };

    // Detect delimiter
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    // Parse headers
    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    // Find column indices
    const emailIndex = headers.findIndex(h => h === 'email' || h === 'user email');
    const firstNameIndex = headers.findIndex(h => h === 'first_name' || h === 'first name' || h === 'firstname');
    const lastNameIndex = headers.findIndex(h => h === 'last_name' || h === 'last name' || h === 'lastname');
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'username' || h === 'display name');
    // Support various status column names from different email platforms
    const statusIndex = headers.findIndex(h => 
      h === 'status' || 
      h === 'email status' || 
      h === 'email_status' || 
      h === 'subscriber status' || 
      h === 'subscriber_status' ||
      h === 'subscription status' ||
      h === 'subscription_status' ||
      h === 'contact status' ||
      h === 'contact_status'
    );
    const tagsIndex = headers.findIndex(h => h === 'tags' || h === 'tag' || h === 'groups' || h === 'group');

    if (emailIndex === -1) {
      throw new Error('CSV must contain an "email" column');
    }

    // Create a map of tag names to tag IDs for quick lookup
    const tagNameToIdMap = new Map<string, number>();
    currentTags.forEach((tag: any) => {
      tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
    });

    const newContacts: any[] = [];
    const emailSet = new Set<string>();
    const duplicateEmails = new Set<string>();
    const existingEmails = new Set<string>();

    // Get existing contact emails for comparison (from fetched contacts)
    const existingContactEmails = new Set(contacts.map((c: any) => c.email?.toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      const email = values[emailIndex]?.toLowerCase().trim();

      if (!email) continue;

      // Check for duplicates within CSV
      if (emailSet.has(email)) {
        duplicateEmails.add(email);
        continue;
      }

      // Check if email already exists in contacts list
      if (existingContactEmails.has(email)) {
        existingEmails.add(email);
        continue;
      }

      emailSet.add(email);

      // Parse tags from CSV if tags column exists
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
        email: values[emailIndex].trim(), // Keep original case
        first_name: first_name,
        last_name: last_name,
        status: statusIndex !== -1 ? (values[statusIndex] || 'pending').toLowerCase() : 'pending',
        tagIds: tagIds,
        tagNames: tagNames, // Store tag names for post-import processing
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
        title: t("forgotPassword.error"),
        description: t("newsletter.pleaseSelectCSVFile"),
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

        let message = `${t("newsletter.found")} ${result.contacts.length} ${t("newsletter.toastContact")} ${t("newsletter.toImport")}`;
        if (result.duplicates.length > 0 || result.existing.length > 0) {
          message += `. ${result.duplicates.length} ${t("newsletter.duplicate")} ${t("newsletter.toastContactAndCSV")} ${result.existing.length} ${t("newsletter.alreadyExist")}`;
        }

        toast({
          title: t("newsletter.fileLoaded"),
          description: message,
          variant: result.duplicates.length > 0 || result.existing.length > 0 ? "default" : "default",
        });
      } catch (error: any) {
        toast({
          title: t("forgotPassword.error"),
          description: error.message || t("newsletter.failedToParseCSVFile"),
          variant: "destructive",
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.failedToReadFile"),
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
  const handleExportContacts = async (exportType: "all" | "selected") => {
    setIsExporting(true);
    try {
      const contactIds = exportType === "selected" ? selectedContacts : [];
      const queryParams = new URLSearchParams({
        websiteProgressId: websiteProgressId.toString(),
      });
      if (contactIds.length > 0) {
        queryParams.set("contactIds", contactIds.join(","));
      }
      
      const response = await fetch(`/api/contacts/export?${queryParams.toString()}`, {
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
      
      const exportCount = exportType === "selected" ? selectedContacts.length : contacts.length;
      toast({
        title: t("newsletter.exportSuccess") || "Export successful",
        description: `${t("newsletter.exported") || "Exported"} ${exportCount} ${t("newsletter.toastContact") || "contacts"}`,
      });
    } catch (error) {
      toast({
        title: t("forgotPassword.error") || "Error",
        description: t("newsletter.failedToExportContacts") || "Failed to export contacts",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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
      const BATCH_SIZE = 500;
      const allResults = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ email: string; error: string }>,
      };

      // Split contacts into batches
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);
        
        // Map tagIds to tags for the API
        const contactsWithTags = batch.map(contact => ({
          ...contact,
          tags: contact.tagIds || [],
        }));
        
        const response = await apiRequest("POST", "/api/contacts/bulk-import", {
          contacts: contactsWithTags,
          websiteProgressId,
        });
        
        const batchResult = await response.json();
        
        // Aggregate results
        allResults.imported += batchResult.imported || 0;
        allResults.skipped += batchResult.skipped || 0;
        if (batchResult.errors && Array.isArray(batchResult.errors)) {
          allResults.errors.push(...batchResult.errors);
        }
      }
      
      return allResults;
    },
    onSuccess: async (data: any, variables: any[]) => {
      // Refetch contacts to get newly imported ones
      await refetchContacts();
      const refetchTagsResult = await refetchTags();
      const updatedTags = refetchTagsResult.data || tags;

      // Create a map of email to tag names from CSV
      const emailToTagNamesMap = new Map<string, string[]>();
      variables.forEach(contact => {
        if (contact.tagNames && contact.tagNames.length > 0) {
          emailToTagNamesMap.set(contact.email.toLowerCase(), contact.tagNames);
        }
      });

      // Get all contacts to find the newly imported ones
      const allContacts = await queryClient.fetchQuery<any[]>({
        queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`],
      });

      // Find imported contacts (those that match emails from CSV)
      const importedContactEmails = new Set(variables.map(c => c.email.toLowerCase()));
      const importedContacts = allContacts.filter((c: any) => 
        importedContactEmails.has(c.email.toLowerCase())
      );

      // Process each imported contact
      const tagNameToIdMap = new Map<string, number>();
      updatedTags.forEach((tag: any) => {
        tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
      });

      const existingTagNames = new Set(updatedTags.map((tag: any) => tag.name.toLowerCase()));
      const tagsToCreate = new Set<string>();
      const tagsToAssign: Array<{ contactId: number; tagId: number }> = [];

      // First pass: identify tags to create and tags to assign (for existing tags)
      for (const contact of importedContacts) {
        const csvTagNames = emailToTagNamesMap.get(contact.email.toLowerCase()) || [];
        
        for (const tagName of csvTagNames) {
          const tagNameLower = tagName.toLowerCase();
          
          // Check if tag exists
          if (!existingTagNames.has(tagNameLower)) {
            tagsToCreate.add(tagName);
          } else {
            // Tag exists, add to assignment list
            const tagId = tagNameToIdMap.get(tagNameLower);
            if (tagId) {
              // Check if contact already has this tag
              const contactTagIds = contact.tags?.map((t: any) => t.id) || [];
              if (!contactTagIds.includes(tagId)) {
                tagsToAssign.push({ contactId: contact.id, tagId });
              }
            }
          }
        }
      }

      // Create missing tags
      if (tagsToCreate.size > 0) {
        const createPromises = Array.from(tagsToCreate).map(tagName => 
          createTagMutation.mutateAsync(tagName)
        );
        await Promise.all(createPromises);
        const finalTagsResult = await refetchTags();
        const finalTags = finalTagsResult.data || updatedTags;
        
        // Update tag map with newly created tags
        finalTags.forEach((tag: any) => {
          tagNameToIdMap.set(tag.name.toLowerCase(), tag.id);
        });
        existingTagNames.clear();
        finalTags.forEach((tag: any) => {
          existingTagNames.add(tag.name.toLowerCase());
        });
      }

      // Second pass: assign all tags (both existing and newly created) to contacts
      for (const contact of importedContacts) {
        const csvTagNames = emailToTagNamesMap.get(contact.email.toLowerCase()) || [];
        const contactTagIds = contact.tags?.map((t: any) => t.id) || [];
        
        for (const tagName of csvTagNames) {
          const tagNameLower = tagName.toLowerCase();
          const tagId = tagNameToIdMap.get(tagNameLower);
          
          if (tagId && !contactTagIds.includes(tagId)) {
            // Check if not already in tagsToAssign to avoid duplicates
            const alreadyQueued = tagsToAssign.some(
              t => t.contactId === contact.id && t.tagId === tagId
            );
            if (!alreadyQueued) {
              tagsToAssign.push({ contactId: contact.id, tagId });
            }
          }
        }
      }

      // Assign all tags to contacts
      for (const { contactId, tagId } of tagsToAssign) {
        try {
          await apiRequest("POST", `/api/contacts/${contactId}/tags/${tagId}`);
        } catch (error) {
          // Tag might already be assigned, ignore error
        }
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/contacts?websiteProgressId=${websiteProgressId}`] });
      
      let description = `Imported ${data.imported} contacts, skipped ${data.skipped} existing contacts`;
      if (tagsToCreate.size > 0) {
        description += `, created ${tagsToCreate.size} new tag${tagsToCreate.size > 1 ? 's' : ''}`;
      }
      if (data.errors.length > 0) {
        description += `, ${data.errors.length} errors`;
      }

      toast({
        title: t("newsletter.importComplete"),
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
        title: t("forgotPassword.error"),
        description: error?.message || "Failed to import contacts",
        variant: "destructive",
      });
    },
  });

  const handleBulkImport = () => {
    if (parsedContacts.length === 0) {
      toast({
        title: t("forgotPassword.error"),
        description: t("newsletter.noContactsToImport"),
        variant: "destructive",
      });
      return;
    }
    bulkImportMutation.mutate(parsedContacts);
  };

  // Filter contacts based on search query, status, and tags
  const filteredContacts = contacts.filter((contact: any) => {
    // Search filter - check name and email
    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower) {
      const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase();
      const email = (contact.email || "").toLowerCase();
      if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
        return false;
      }
    }
    
    // Status filter
    if (statusFilter !== "all" && contact.status !== statusFilter) {
      return false;
    }
    
    // Tag filter
    if (tagFilter !== "all") {
      const contactTagIds = contact.tags?.map((t: any) => t.id.toString()) || [];
      if (!contactTagIds.includes(tagFilter)) {
        return false;
      }
    }
    
    return true;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, tagFilter]);

  if (contactsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("newsletter.loadingContacts")}</p>
      </div>
    );
  }

  const isBulkOperationInProgress = bulkImportMutation.isPending || bulkDeleteContactsMutation.isPending || bulkUpdateStatusMutation.isPending || bulkAssignTagsMutation.isPending;

  return (
    <div className={`space-y-6 ${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t("newsletter.contacts")} ({contacts.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(value) => {
                  if (value === "all" || value === "selected") {
                    handleExportContacts(value);
                  }
                }}
                value=""
                disabled={isExporting}
              >
                <SelectTrigger className="w-[140px]" disabled={contacts.length === 0 || isExporting}>
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? (t("newsletter.exporting") || "Exporting...") : (t("newsletter.export") || "Export")}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("newsletter.exportAll") || "Export All"} ({contacts.length})
                  </SelectItem>
                  <SelectItem value="selected" disabled={selectedContacts.length === 0}>
                    {t("newsletter.exportSelected") || "Export Selected"} ({selectedContacts.length})
                  </SelectItem>
                </SelectContent>
              </Select>
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
                {t("newsletter.addContactButton")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar */}
          {contacts.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("newsletter.searchContacts") || "Search by name or email..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-contacts"
                />
              </div>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t("newsletter.filterByStatus") || "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("newsletter.allStatuses") || "All Statuses"}</SelectItem>
                  <SelectItem value="pending">{t("newsletter.statusPending") || "Pending"}</SelectItem>
                  <SelectItem value="active">{t("newsletter.statusActive") || "Active"}</SelectItem>
                  <SelectItem value="confirmed">{t("newsletter.statusConfirmed") || "Confirmed"}</SelectItem>
                  <SelectItem value="unsubscribed">{t("newsletter.statusUnsubscribed") || "Unsubscribed"}</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Tag Filter */}
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-tag-filter">
                  <TagIcon className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t("newsletter.filterByTag") || "Tag"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("newsletter.allTags") || "All Tags"}</SelectItem>
                  {tags.map((tag: any) => (
                    <SelectItem key={tag.id} value={tag.id.toString()}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Clear Filters Button */}
              {(searchQuery || statusFilter !== "all" || tagFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTagFilter("all");
                  }}
                  className="whitespace-nowrap"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("newsletter.clearFilters") || "Clear"}
                </Button>
              )}
            </div>
          )}
          
          {/* Filter Results Info */}
          {contacts.length > 0 && filteredContacts.length !== contacts.length && (
            <div className="mb-4 text-sm text-muted-foreground">
              {t("newsletter.showingResults") || "Showing"} {filteredContacts.length} {t("newsletter.of") || "of"} {contacts.length} {t("newsletter.contacts") || "contacts"}
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {t("newsletter.noContacts")}
              </p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {t("newsletter.noMatchingContacts") || "No contacts match your filters"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTagFilter("all");
                }}
              >
                {t("newsletter.clearFilters") || "Clear Filters"}
              </Button>
            </div>
          ) : (
            <>
              {selectedContacts.length > 0 && (
                <div className="mb-4 flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {selectedContacts.length} {selectedContacts.length === 1 ? t("newsletter.contactSelected") : t("newsletter.contactsSelected")}
                    </span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedContacts(filteredContacts.map((contact: any) => contact.id));
                          } else {
                            setSelectedContacts([]);
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">{t("newsletter.selectAll")}</span>
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
                      {t("newsletter.changeStatus")}
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
                    <TableHead>{t("newsletter.firstName") || "First Name"}</TableHead>
                    <TableHead>{t("newsletter.lastName") || "Last Name"}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{t("newsletter.tags")}</TableHead>
                    <TableHead>{t("newsletter.status")}</TableHead>
                    <TableHead>{t("newsletter.subscribed")}</TableHead>
                    <TableHead className="text-center">{t("newsletter.actions")}</TableHead>
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
                      <TableCell className="font-medium">{contact.firstName || "-"}</TableCell>
                      <TableCell>{contact.lastName || "-"}</TableCell>
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
                            ? t("newsletter.statusActive") 
                            : contact.status === "confirmed"
                              ? t("newsletter.statusConfirmed")
                              : contact.status === "unsubscribed"
                                ? t("newsletter.statusUnsubscribed")
                                : t("newsletter.statusPending")}
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
              <div className="mt-4 flex justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t("newsletter.rowsPerPage")}</span>
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
            <DialogTitle>{t("newsletter.addNewContact")}</DialogTitle>
            <DialogDescription>
              {t("newsletter.addNewContactDescription")}
            </DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
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
              {t("newsletter.singleContact")}
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
              {t("newsletter.importFile")}
            </Button>
          </div>

          {importMode === "bulk" ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">{t("newsletter.csvFile")}</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadSample}
                    className="h-7 text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {t("newsletter.downloadSample")}
                  </Button>
                </div>
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
                <p className="text-xs text-muted-foreground mt-1">
                  {t("newsletter.csvDescription")}
                </p>
              </div>

              {parsedContacts.length > 0 && (
                <div className="border rounded-md p-3 bg-muted/50">
                  <p className="text-sm font-medium mb-2">
                    {t("newsletter.found")} {parsedContacts.length} {t("newsletter.toastContact")}
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
                  {t("newsletter.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={bulkImportMutation.isPending || parsedContacts.length === 0}
                >
                  {bulkImportMutation.isPending ? t("newsletter.importing") : t("newsletter.import")}
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
                      <FormLabel>{t("newsletter.firstName") || "First Name"} {t("newsletter.optional")}</FormLabel>
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
                      <FormLabel>{t("newsletter.lastName") || "Last Name"} {t("newsletter.optional")}</FormLabel>
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
                          <SelectItem value="pending">{t("newsletter.pending")}</SelectItem>
                          <SelectItem value="active">{t("newsletter.active")}</SelectItem>
                          <SelectItem value="confirmed">{t("newsletter.confirmed")}</SelectItem>
                          <SelectItem value="unsubscribed">{t("newsletter.unsubscribed")}</SelectItem>
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
                      <FormLabel>{t("newsletter.tags")} {t("newsletter.optional")}</FormLabel>
                      <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                        {tags.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {t("newsletter.noTagsAvailable")}
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
                    {t("newsletter.cancel")}
                  </Button>
                  <Button type="submit" disabled={createContactMutation.isPending} data-testid="button-submit-contact">
                    {createContactMutation.isPending ? t("newsletter.adding") : t("newsletter.addContact")}
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
            <DialogTitle>{t("newsletter.editContact")}</DialogTitle>
            <DialogDescription>
              {t("newsletter.editContactDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateContact)} className="space-y-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("newsletter.firstName") || "First Name"} {t("newsletter.optional")}</FormLabel>
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
                    <FormLabel>{t("newsletter.lastName") || "Last Name"} {t("newsletter.optional")}</FormLabel>
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
                        <SelectItem value="pending">{t("newsletter.pending")}</SelectItem>
                        <SelectItem value="active">{t("newsletter.active")}</SelectItem>
                        <SelectItem value="confirmed">{t("newsletter.confirmed")}</SelectItem>
                        <SelectItem value="unsubscribed">{t("newsletter.unsubscribed")}</SelectItem>
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
                    <FormLabel>{t("newsletter.tags")} {t("newsletter.optional")}</FormLabel>
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                      {tags.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          {t("newsletter.noTagsAvailable")}
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
                  {t("newsletter.cancel")}
                </Button>
                <Button type="submit" disabled={updateContactMutation.isPending}>
                  {updateContactMutation.isPending ? t("newsletter.updating") : t("newsletter.updateContact")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Status Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newsletter.changeStatus")}</DialogTitle>
            <DialogDescription>
              {t("newsletter.changeStatusDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={bulkSelectedStatus}
              onValueChange={(value: "pending" | "active" | "confirmed" | "unsubscribed") => setBulkSelectedStatus(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("newsletter.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t("newsletter.pending")}</SelectItem>
                <SelectItem value="active">{t("newsletter.active")}</SelectItem>
                <SelectItem value="confirmed">{t("newsletter.confirmed")}</SelectItem>
                <SelectItem value="unsubscribed">{t("newsletter.unsubscribed")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowBulkStatusDialog(false)}>
                {t("newsletter.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleBulkUpdateStatus}
                disabled={bulkUpdateStatusMutation.isPending}
              >
                {bulkUpdateStatusMutation.isPending ? t("newsletter.updating") : t("newsletter.update")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Status Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newsletter.changeStatus")}</DialogTitle>
            <DialogDescription>
              {t("newsletter.changeStatusDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={bulkSelectedStatus}
              onValueChange={(value: "pending" | "active" | "confirmed" | "unsubscribed") => setBulkSelectedStatus(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("newsletter.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t("newsletter.pending")}</SelectItem>
                <SelectItem value="active">{t("newsletter.active")}</SelectItem>
                <SelectItem value="confirmed">{t("newsletter.confirmed")}</SelectItem>
                <SelectItem value="unsubscribed">{t("newsletter.unsubscribed")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowBulkStatusDialog(false)}>
                {t("newsletter.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleBulkUpdateStatus}
                disabled={bulkUpdateStatusMutation.isPending}
              >
                {bulkUpdateStatusMutation.isPending ? t("newsletter.updating") : t("newsletter.update")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Tags Dialog */}
      <Dialog open={showBulkTagsDialog} onOpenChange={setShowBulkTagsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newsletter.assignTags")}</DialogTitle>
            <DialogDescription>
              {t("newsletter.assignTagsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t("newsletter.noTagsAvailable")}
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
                {t("newsletter.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleBulkAssignTags}
                disabled={bulkAssignTagsMutation.isPending || bulkSelectedTagIds.length === 0}
              >
                {bulkAssignTagsMutation.isPending ? t("newsletter.assigning") : t("newsletter.assign")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("newsletter.deleteContact")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("newsletter.deleteContactDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("newsletter.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteContactMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContactMutation.isPending ? t("newsletter.deleting") : t("newsletter.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedContacts.length === 1 ? t("newsletter.deleteContact") : t("newsletter.deleteContacts")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedContacts.length === 1 ? t("newsletter.deleteContactDescription") : t("newsletter.deleteContactsDescription", { count: selectedContacts.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("newsletter.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteContactsMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteContactsMutation.isPending ? t("newsletter.deleting") : t("newsletter.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Operation Loading Overlay */}
      <Dialog open={isBulkOperationInProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">
                {bulkImportMutation.isPending 
                  ? t("newsletter.importing")
                  : bulkDeleteContactsMutation.isPending
                  ? t("newsletter.deleting")
                  : bulkUpdateStatusMutation.isPending
                  ? t("newsletter.updating")
                  : t("newsletter.assigning")
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {bulkImportMutation.isPending 
                  ? t("newsletter.importingDescription")
                  : bulkDeleteContactsMutation.isPending
                  ? t("newsletter.deletingDescription", { count: selectedContacts.length })
                  : bulkUpdateStatusMutation.isPending
                  ? t("newsletter.updatingStatusDescription", { count: selectedContacts.length })
                  : t("newsletter.assigningTagsDescription", { count: selectedContacts.length })
                }
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
