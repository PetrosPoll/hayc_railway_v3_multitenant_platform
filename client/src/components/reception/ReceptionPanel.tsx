import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ListItem = {
  id: number;
  typeKey: string;
  typeLabel: string;
  kindLabel: string;
  status: string;
  statusLabel: string;
  crossSell: { value: string; label: string }[];
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  stuck: boolean;
  missingCount: number;
  receivedCount: number;
};

type Detail = {
  id: number;
  typeLabel: string;
  kindLabel: string;
  allowUploads: boolean;
  status: string;
  statuses: { key: string; label: string }[];
  policyRef: string | null;
  data: Record<string, string>;
  fields: { key: string; label: string }[];
  crossSell: { value: string; label: string }[];
  contact: { name: string; email: string; phone: string | null };
  stuck: boolean;
  docs: {
    id: number;
    docKey: string;
    label: string;
    required: boolean;
    received: boolean;
    files: { url: string | null; mime: string | null; ext: string }[];
  }[];
  events: { id: number; type: string; actor: string; payload: Record<string, unknown>; createdAt: string }[];
};

const EVENT_LABELS: Record<string, string> = {
  created: "Υποβολή",
  status_changed: "Αλλαγή κατάστασης",
  doc_received: "Έγγραφο",
  doc_requested: "Αίτημα εγγράφων",
  file_uploaded: "Ανέβασμα αρχείου",
  zip_downloaded: "Λήψη φακέλου",
};

const FIELD_LABELS: Record<string, string> = {
  notes: "Σημειώσεις",
  branch: "Κλάδος",
  care_type: "Είδος",
  policy_ref: "Αριθμός συμβολαίου",
};

async function readError(res: Response) {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || "Αποτυχία");
}

export function ReceptionPanel({ websiteId }: { websiteId: number }) {
  const queryClient = useQueryClient();
  const [typeKey, setTypeKey] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [askIds, setAskIds] = useState<number[]>([]);
  const [freeText, setFreeText] = useState("");

  const listQuery = useQuery({
    queryKey: ["/api/websites", websiteId, "requests", typeKey, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeKey !== "all") params.set("type", typeKey);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/websites/${websiteId}/requests?${params}`, {
        credentials: "include",
      });
      if (!res.ok) await readError(res);
      return res.json() as Promise<{ requests: ListItem[] }>;
    },
  });

  const detailQuery = useQuery({
    queryKey: ["/api/websites", websiteId, "requests", selectedId],
    enabled: selectedId != null,
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/requests/${selectedId}`, {
        credentials: "include",
      });
      if (!res.ok) await readError(res);
      return res.json() as Promise<Detail>;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "requests"] });
  };

  const statusMutation = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch(`/api/websites/${websiteId}/requests/${selectedId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) await readError(res);
    },
    onSuccess: invalidate,
  });

  const docMutation = useMutation({
    mutationFn: async ({ docId, received }: { docId: number; received: boolean }) => {
      const res = await fetch(`/api/websites/${websiteId}/requests/${selectedId}/docs/${docId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });
      if (!res.ok) await readError(res);
    },
    onSuccess: invalidate,
  });

  const askMutation = useMutation({
    mutationFn: async () => {
      const labels = freeText
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await fetch(`/api/websites/${websiteId}/requests/${selectedId}/ask-docs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docIds: askIds, labels }),
      });
      if (!res.ok) await readError(res);
    },
    onSuccess: () => {
      setAskIds([]);
      setFreeText("");
      invalidate();
    },
  });

  const detail = detailQuery.data;
  const requests = listQuery.data?.requests || [];

  return (
    <div className="space-y-4" data-testid="section-reception">
      <div>
        <h2 className="text-xl font-semibold">Υποδοχή</h2>
        <p className="text-sm text-muted-foreground">Αιτήματα που περιμένουν ενέργεια.</p>
      </div>

      {!selectedId ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Select value={typeKey} onValueChange={setTypeKey}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Τύπος" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                <SelectItem value="quote">Προσφορά</SelectItem>
                <SelectItem value="claim_health">Υγεία</SelectItem>
                <SelectItem value="claim_vehicle">Όχημα</SelectItem>
                <SelectItem value="claim_home">Κατοικία</SelectItem>
                <SelectItem value="general">Γενικό</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Κατάσταση" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
                <SelectItem value="new">Νέο</SelectItem>
                <SelectItem value="missing_docs">Λείπουν έγγραφα</SelectItem>
                <SelectItem value="complete">Πλήρες</SelectItem>
                <SelectItem value="sent">Στάλθηκε στην εταιρεία</SelectItem>
                <SelectItem value="closed">Κλειστό</SelectItem>
                <SelectItem value="contacted">Επικοινωνία</SelectItem>
                <SelectItem value="quoted">Προσφορά</SelectItem>
                <SelectItem value="won">Έγινε πελάτης</SelectItem>
                <SelectItem value="lost">Χάθηκε</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {listQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν αιτήματα.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {requests.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div>
                    <div className="font-medium">{item.contactName}</div>
                    <div className="text-sm text-muted-foreground">{item.typeLabel}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{item.kindLabel}</Badge>
                    <Badge variant="outline">{item.statusLabel}</Badge>
                    {item.crossSell.map((sell) => (
                      <Badge key={sell.value}>{sell.label}</Badge>
                    ))}
                    {item.stuck && <Badge className="bg-red-600 hover:bg-red-600">Κολλημένο</Badge>}
                    {item.missingCount > 0 && (
                      <Badge variant="outline">Λείπουν {item.missingCount}</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : detailQuery.isLoading || !detail ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            Πίσω στη λίστα
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{detail.contact.name}</h3>
              <p className="text-sm text-muted-foreground">
                {detail.contact.email}
                {detail.contact.phone ? ` · ${detail.contact.phone}` : ""}
              </p>
              <p className="text-sm mt-1">{detail.typeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{detail.kindLabel}</Badge>
              {detail.crossSell.map((sell) => (
                <Badge key={sell.value}>{sell.label}</Badge>
              ))}
              {detail.stuck && <Badge className="bg-red-600 hover:bg-red-600">Κολλημένο</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={detail.status} onValueChange={(value) => statusMutation.mutate(value)}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {detail.statuses.map((item) => (
                  <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detail.allowUploads && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `/api/websites/${websiteId}/requests/${detail.id}/zip`;
                }}
              >
                <Download className="mr-1 h-4 w-4" />
                Κατέβασε φάκελο
              </Button>
            )}
          </div>

          {detail.policyRef && (
            <p className="text-sm">Αριθμός συμβολαίου: {detail.policyRef}</p>
          )}

          <div className="space-y-1 text-sm">
            {Object.entries(detail.data || {})
              .filter(([key]) => key !== "policy_ref")
              .map(([key, value]) => (
                <p key={key}>
                  <span className="text-muted-foreground">
                    {detail.fields.find((field) => field.key === key)?.label || FIELD_LABELS[key] || key}:
                  </span>{" "}
                  {value}
                </p>
              ))}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Έγγραφα</h4>
            {detail.docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν ζητήθηκαν έγγραφα.</p>
            ) : (
              detail.docs.map((doc) => (
                <div key={doc.id} className="rounded-md border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {doc.received ? "✓" : "✗"} {doc.label}
                      {!doc.required ? " (προαιρετικό)" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => docMutation.mutate({ docId: doc.id, received: !doc.received })}
                    >
                      {doc.received ? "Σήμανση ως εκκρεμές" : "Παρελήφθη"}
                    </Button>
                  </div>
                  {doc.files.map((file, index) =>
                    file.url ? (
                      file.mime?.startsWith("image/") ? (
                        <a key={index} href={file.url} target="_blank" rel="noreferrer">
                          <img src={file.url} alt={doc.label} className="max-h-40 rounded" />
                        </a>
                      ) : (
                        <a key={index} href={file.url} target="_blank" rel="noreferrer" className="underline">
                          Αρχείο {index + 1}
                        </a>
                      )
                    ) : null,
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={askIds.includes(doc.id)}
                      onChange={(e) =>
                        setAskIds((current) =>
                          e.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id),
                        )
                      }
                    />
                    Ζήτα αυτό
                  </label>
                </div>
              ))
            )}
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Άλλο έγγραφο, χωρισμένα με κόμμα"
            />
            <Button size="sm" onClick={() => askMutation.mutate()} disabled={askMutation.isPending}>
              Ζήτα έγγραφο
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Ιστορικό</h4>
            {detail.events.map((event) => (
              <p key={event.id} className="text-sm text-muted-foreground">
                {new Date(event.createdAt).toLocaleString("el-GR")} · {EVENT_LABELS[event.type] || event.type}
                {typeof event.payload.label === "string" ? ` · ${event.payload.label}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
