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
import { Input } from "@/components/ui/input";

type WebsiteContactSubmission = {
  id: number;
  websiteProgressId: number | null;
  siteId: string;
  siteLabel: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  extraFields: Record<string, string> | null;
  ownerEmail: string;
  createdAt: string | null;
};

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-all whitespace-pre-wrap">
        {value === null || value === undefined || value === "" ? (
          <span className="text-muted-foreground italic">—</span>
        ) : (
          String(value)
        )}
      </span>
    </>
  );
}

export default function AdminWebsiteContactSubmissions() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WebsiteContactSubmission | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/website-contact-submissions", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("q", search);
      const res = await fetch(
        `/api/admin/website-contact-submissions?${params}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{
        submissions: WebsiteContactSubmission[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>;
    },
  });

  const submissions = data?.submissions ?? [];
  const pagination = data?.pagination;

  return (
    <section>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">Website contact forms</h2>
        <form
          className="flex gap-2 w-full sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, site..."
            className="sm:w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Sent to</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && submissions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No contact form submissions yet.
              </TableCell>
            </TableRow>
          )}
          {submissions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
              </TableCell>
              <TableCell>{s.siteLabel || s.siteId}</TableCell>
              <TableCell>{s.name}</TableCell>
              <TableCell>{s.email}</TableCell>
              <TableCell>{s.ownerEmail}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(s)}
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
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Contact form #{selected?.id}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <Field
                label="Date"
                value={
                  selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : null
                }
              />
              <Field label="Website" value={selected.siteLabel} />
              <Field label="Site ID" value={selected.siteId} />
              <Field label="Sent to" value={selected.ownerEmail} />
              <Field label="From" value={selected.name} />
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Message" value={selected.message} />
              {selected.extraFields &&
                Object.entries(selected.extraFields).map(([key, value]) => (
                  <Field key={key} label={key} value={value} />
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
