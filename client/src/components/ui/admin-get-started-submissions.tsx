import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-yellow-100 text-yellow-800 border-yellow-200",
  draft: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-all">
        {value === null || value === undefined || value === "" ? (
          <span className="text-muted-foreground italic">—</span>
        ) : Array.isArray(value) ? (
          value.join(", ")
        ) : (
          String(value)
        )}
      </span>
    </>
  );
}

export function SubmissionDetailDialog({
  submissionId,
  open,
  onClose,
}: {
  submissionId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/get-started-submissions", submissionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/get-started-submissions/${submissionId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!submissionId && open,
  });

  const s = data?.submission;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Submission #{submissionId}
            {s && <StatusBadge status={s.status} />}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {s && (
          <div className="flex flex-col gap-6">
            <Section title="Account">
              <Field label="Full Name" value={s.fullName} />
              <Field label="Email" value={s.email} />
              <Field label="Phone" value={s.contactPhone} />
              <Field label="Document Type" value={s.documentType} />
              <Field label="VAT Number" value={s.vatNumber} />
              <Field label="City" value={s.city} />
              <Field
                label="Street"
                value={s.street ? `${s.street} ${s.streetNumber}` : null}
              />
              <Field label="Postal Code" value={s.postalCode} />
            </Section>

            <Section title="Plan">
              <Field label="Selected Plan" value={s.selectedPlan} />
              <Field label="Billing Period" value={s.billingPeriod} />
              <Field label="Status" value={s.status} />
              <Field label="Current Step" value={s.currentStep} />
              <Field label="Website Progress ID" value={s.websiteProgressId} />
              <Field label="Submission ID" value={s.submissionId} />
            </Section>

            <Section title="Pre-checkout">
              <Field label="Business Type" value={s.businessType} />
              <Field label="Website Goals" value={s.websiteGoals} />
              <Field label="Suggested Structure" value={s.suggestedStructure} />
              <Field label="Suggested Addons" value={s.suggestedAddons} />
              <Field label="Selected Addons" value={s.selectedAddons} />
              <Field label="Design Direction" value={s.designDirection} />
            </Section>

            <Section title="Onboarding — Step 6">
              <Field label="Business Name" value={s.businessName} />
              <Field label="Business Description" value={s.businessDescription} />
              <Field label="Services" value={s.services} />
              <Field label="Had Website Before" value={s.hadWebsiteBefore} />
              <Field label="Previous Platform" value={s.previousWebsitePlatform} />
            </Section>

            <Section title="Onboarding — Step 7">
              <Field label="Self Description" value={s.selfDescription} />
              <Field label="Biggest Concerns" value={s.biggestConcerns} />
              <Field label="Heard About Us" value={s.heardAboutUs} />
            </Section>

            <Section title="Onboarding — Step 8">
              <Field label="Confirmed Pages" value={s.confirmedPages} />
              <Field label="Pages Notes" value={s.pagesNotes} />
            </Section>

            <Section title="Onboarding — Step 9">
              <Field label="Website Content" value={s.websiteContent} />
              <Field label="Success Vision" value={s.successVision} />
              <Field
                label="Media URLs"
                value={
                  s.mediaUrls?.length ? `${s.mediaUrls.length} file(s)` : null
                }
              />
            </Section>

            <Section title="Meta">
              <Field label="Session ID" value={s.sessionId} />
              <Field label="Checkout Session ID" value={s.checkoutSessionId} />
              <Field label="Language" value={s.websiteLanguage} />
              <Field
                label="Created At"
                value={
                  s.createdAt ? new Date(s.createdAt).toLocaleString() : null
                }
              />
              <Field
                label="Updated At"
                value={
                  s.updatedAt ? new Date(s.updatedAt).toLocaleString() : null
                }
              />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminGetStartedSubmissions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/get-started-submissions", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      const res = await fetch(
        `/api/admin/get-started-submissions?${params}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const submissions = data?.submissions ?? [];
  const pagination = data?.pagination;

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Get Started Submissions</h2>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Business Type</TableHead>
            <TableHead>Step</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && submissions.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground"
              >
                No submissions found.
              </TableCell>
            </TableRow>
          )}
          {submissions.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.id}</TableCell>
              <TableCell>{s.email ?? "—"}</TableCell>
              <TableCell>{s.fullName ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={s.status} />
              </TableCell>
              <TableCell>{s.selectedPlan ?? "—"}</TableCell>
              <TableCell>{s.businessType ?? "—"}</TableCell>
              <TableCell>{s.currentStep ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.createdAt
                  ? new Date(s.createdAt).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedId(s.id);
                    setDialogOpen(true);
                  }}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
            total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <SubmissionDetailDialog
        submissionId={selectedId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  );
}
