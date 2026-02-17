import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, Send, FileText } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ email: string; error: string }>;
  resetTokens: Array<{ email: string; token: string; resetUrl: string }>;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export function UserMigrationManager() {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [singleEmail, setSingleEmail] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all users for password reset
  const { data: userData } = useQuery<{ users: User[] }>({
    queryKey: ["/api/admin/users"],
  });

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
      const content = e.target?.result as string;
      setCsvContent(content);
      setUploadedFileName(file.name);
      toast({
        title: "File Uploaded",
        description: `Successfully loaded ${file.name}`,
      });
    };

    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read the file",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
  };

  // Clear uploaded file
  const handleClearFile = () => {
    setCsvContent("");
    setUploadedFileName("");
    setTestResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Test CSV parsing
  const handleTestCsv = async () => {
    if (!csvContent.trim()) {
      toast({
        title: "Error",
        description: "Please paste CSV content first",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/admin/test-csv-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(data);
        toast({
          title: "CSV Parsed Successfully",
          description: `Found ${data.usersFound} users in CSV`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to parse CSV",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test CSV parsing",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Import users mutation
  const importUsersMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      const response = await fetch("/api/admin/import-wordpress-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });
      if (!response.ok) {
        throw new Error("Failed to import users");
      }
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResults(data);
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} users, skipped ${data.skipped} existing users`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send password reset emails mutation
  const sendResetEmailsMutation = useMutation({
    mutationFn: async (data: { email?: string; selectedUsers?: Array<{ email: string }> }) => {
      const response = await fetch("/api/admin/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to send password reset emails");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      toast({
        title: "Password Reset Emails Sent",
        description: `Successfully sent ${successCount} password reset emails`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Emails",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = async () => {
    if (!csvContent.trim()) {
      toast({
        title: "Error",
        description: "Please paste your CSV content",
        variant: "destructive",
      });
      return;
    }
    importUsersMutation.mutate(csvContent);
  };

  const handleSendToSelected = () => {
    if (selectedEmails.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one user",
        variant: "destructive",
      });
      return;
    }

    const selectedUsers = selectedEmails.map(email => ({ email }));
    sendResetEmailsMutation.mutate({ selectedUsers });
  };

  const handleSendToSingle = () => {
    if (!singleEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    sendResetEmailsMutation.mutate({ email: singleEmail });
  };

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const downloadResetTokens = () => {
    if (!importResults?.resetTokens.length) return;

    const csvContent = [
      "Email,Username,Reset Token,Reset URL",
      ...importResults.resetTokens.map(item => 
        `${item.email},"N/A","${item.token}","${item.resetUrl}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'password-reset-tokens.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* CSV Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import WordPress Users (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">
                Upload CSV File from WordPress Export
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {uploadedFileName && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">{uploadedFileName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFile}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div>
              <Label htmlFor="csv-content">
                Paste CSV Content Manually
              </Label>
              <Textarea
                id="csv-content"
                placeholder="Email,Username,Display Name,Phone&#10;user@example.com,username,Display Name,1234567890&#10;..."
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Expected CSV format: Email, Username, Display Name, Phone (header row required)
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTestCsv}
              disabled={isTesting || !csvContent.trim()}
              variant="outline"
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing CSV...
                </>
              ) : (
                "Test CSV Parse"
              )}
            </Button>

            <Button 
              onClick={handleImport}
              disabled={isImporting || !csvContent.trim()}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing Users...
                </>
              ) : (
                "Import WordPress Users"
              )}
            </Button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">CSV Parse Test Results</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p><strong>Users Found:</strong> {testResults.usersFound}</p>
                <p className="mt-2"><strong>First 5 Users Preview:</strong></p>
                <div className="mt-2 space-y-2">
                  {testResults.users.map((user: any, index: number) => (
                    <div key={index} className="bg-white p-2 rounded text-sm">
                      <strong>{user.display_name || user['Display Name'] || user.username}</strong> ({user.email || user.user_email || user['User Email']})
                      <br />
                      <span className="text-gray-600">Registration: {user['User Registered(date)'] || user['User Registered'] || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {importResults && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Import Results:</h4>
              <ul className="text-sm space-y-1">
                <li>✅ Imported: {importResults.imported} users</li>
                <li>⏭️ Skipped: {importResults.skipped} existing users</li>
                <li>❌ Errors: {importResults.errors.length}</li>
                <li>🔑 Password reset tokens generated: {importResults.resetTokens.length}</li>
              </ul>

              {importResults.resetTokens.length > 0 && (
                <Button 
                  onClick={downloadResetTokens}
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Reset Tokens CSV
                </Button>
              )}

              {importResults.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-destructive">
                    View Errors ({importResults.errors.length})
                  </summary>
                  <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-y-auto">
                    {importResults.errors.map((error, index) => (
                      <li key={index} className="text-destructive">
                        {error.email}: {error.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Reset Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Password Reset Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Single Email */}
          <div>
            <Label htmlFor="single-email">Send to Single Email</Label>
            <div className="flex gap-2">
              <Input
                id="single-email"
                type="email"
                placeholder="user@example.com"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
              />
              <Button 
                onClick={handleSendToSingle}
                disabled={sendResetEmailsMutation.isPending}
              >
                {sendResetEmailsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Bulk Selection */}
          <div>
            <Label>Select Users for Bulk Password Reset</Label>
            <div className="max-h-64 overflow-y-auto border rounded-md p-3">
              <div className="space-y-2">
                {userData?.users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedEmails.includes(user.email)}
                      onCheckedChange={() => toggleEmailSelection(user.email)}
                    />
                    <label 
                      htmlFor={`user-${user.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {user.username} ({user.email})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-muted-foreground">
                {selectedEmails.length} users selected
              </span>
              <Button
                onClick={handleSendToSelected}
                disabled={sendResetEmailsMutation.isPending || selectedEmails.length === 0}
              >
                {sendResetEmailsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Selected ({selectedEmails.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}