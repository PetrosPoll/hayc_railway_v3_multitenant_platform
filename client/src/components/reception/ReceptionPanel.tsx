import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ListItem = {
  id: number;
  typeKey: string;
  typeLabel: string;
  kind: string;
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
  createdAt: string;
  lastActivityAt: string;
};

const TYPE_SHORT: Record<string, string> = {
  quote: "Προσφορά",
  claim_health: "Υγεία",
  claim_vehicle: "Όχημα",
  claim_home: "Κατοικία",
  general: "Γενικό",
};

type SortKey = "name" | "type" | "status" | "activity";

const STATUS_ROW: Record<string, string> = {
  new: "bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/45",
  missing_docs: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/45",
  complete: "bg-lime-50 hover:bg-lime-100 dark:bg-lime-950/30 dark:hover:bg-lime-950/45",
  sent: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/45",
  closed: "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/40 dark:hover:bg-stone-800/55",
  won: "bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-950/45",
  lost: "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/45",
};

const COUNT_WORDS = ["", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "εφτά", "οκτώ", "εννιά", "δέκα"];

function missingDocsLabel(count: number) {
  if (count <= 0) return "";
  if (count === 1) return "Λείπει ένα έγγραφο";
  const word = COUNT_WORDS[count];
  return word ? `Λείπουν ${word} έγγραφα` : `Λείπουν ${count} έγγραφα`;
}

function kindText(kind: string) {
  return kind === "lead" ? "Πιθανός πελάτης" : "Υπηρεσία";
}

type Detail = {
  id: number;
  typeLabel: string;
  kind: string;
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

export function ReceptionPanel({
  websiteId,
  homeToken,
  onSelectionChange,
}: {
  websiteId: number;
  homeToken: number;
  onSelectionChange: (name: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeKey, setTypeKey] = useState("all");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState<"lead" | "service">("lead");
  const [stuckOnly, setStuckOnly] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [askIds, setAskIds] = useState<number[]>([]);
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    setSelectedId(null);
    setSearch("");
    setTypeKey("all");
    setStatus("all");
    setKind("lead");
    setStuckOnly("all");
    setSortKey("activity");
    setSortDir("desc");
    setAskIds([]);
    setFreeText("");
    onSelectionChange(null);
  }, [homeToken, onSelectionChange]);

  const listQuery = useQuery({
    queryKey: ["/api/websites", websiteId, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/requests`, {
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
  const query = search.trim().toLowerCase();
  const visible = requests
    .filter((item) => {
      if (typeKey !== "all" && item.typeKey !== typeKey) return false;
      if (status !== "all" && item.status !== status) return false;
      if (kind !== "all" && item.kind !== kind) return false;
      if (stuckOnly === "stuck" && !item.stuck) return false;
      if (!query) return true;
      const haystack = [
        item.contactName,
        item.contactEmail,
        item.contactPhone,
        item.typeLabel,
        TYPE_SHORT[item.typeKey],
        item.statusLabel,
        item.kindLabel,
        ...item.crossSell.map((sell) => sell.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "activity") {
        return (new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()) * dir;
      }
      const left = sortKey === "name" ? a.contactName : sortKey === "type" ? (TYPE_SHORT[a.typeKey] || a.typeLabel) : a.statusLabel;
      const right = sortKey === "name" ? b.contactName : sortKey === "type" ? (TYPE_SHORT[b.typeKey] || b.typeLabel) : b.statusLabel;
      return left.localeCompare(right, "el") * dir;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "activity" ? "desc" : "asc");
  };

  return (
    <div className="space-y-4" data-testid="section-reception">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Leads</h2>
          <p className="text-sm text-muted-foreground">
            {kind === "lead"
              ? "Άνθρωποι που ζήτησαν να ασφαλιστούν."
              : "Ζημιές από ανθρώπους που είναι ήδη πελάτες."}
          </p>
        </div>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            setKind(value as "lead" | "service");
            setTypeKey("all");
            setStatus("all");
            setSelectedId(null);
            onSelectionChange(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="lead">Πιθανοί πελάτες</TabsTrigger>
            <TabsTrigger value="service">Ζημιές</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!selectedId ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση ονόματος, email, τηλεφώνου"
              className="w-full sm:w-[280px]"
            />
            <Select value={typeKey} onValueChange={setTypeKey}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Τύπος" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                {kind === "lead" ? (
                  <SelectItem value="quote">Προσφορά</SelectItem>
                ) : (
                  <>
                    <SelectItem value="claim_health">Υγεία</SelectItem>
                    <SelectItem value="claim_vehicle">Όχημα</SelectItem>
                    <SelectItem value="claim_home">Κατοικία</SelectItem>
                    <SelectItem value="general">Γενικό</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Κατάσταση" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
                {kind === "lead" ? (
                  <>
                    <SelectItem value="missing_docs">Λείπουν έγγραφα</SelectItem>
                    <SelectItem value="won">Έγινε πελάτης</SelectItem>
                    <SelectItem value="lost">Χάθηκε</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="new">Νέο</SelectItem>
                    <SelectItem value="missing_docs">Λείπουν έγγραφα</SelectItem>
                    <SelectItem value="complete">Πλήρες</SelectItem>
                    <SelectItem value="sent">Στάλθηκε στην εταιρεία</SelectItem>
                    <SelectItem value="closed">Κλειστό</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <Select value={stuckOnly} onValueChange={setStuckOnly}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Κολλημένα" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                <SelectItem value="stuck">Μόνο κολλημένα</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {listQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {kind === "lead" ? "Δεν υπάρχουν πιθανοί πελάτες." : "Δεν υπάρχουν ζημιές."}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {kind === "lead" ? "Κανένας πιθανός πελάτης δεν ταιριάζει." : "Καμία ζημιά δεν ταιριάζει."}
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Πελάτης" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                    <TableHead>Email</TableHead>
                    <SortableHead label="Τύπος" active={sortKey === "type"} dir={sortDir} onClick={() => toggleSort("type")} />
                    <SortableHead label="Κατάσταση" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                    <SortableHead label="Τελευταία κίνηση" active={sortKey === "activity"} dir={sortDir} onClick={() => toggleSort("activity")} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer ${STATUS_ROW[item.status] || ""}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        onSelectionChange(item.contactName);
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{item.contactName}</div>
                        {(item.stuck || item.missingCount > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.stuck && <Badge className="bg-red-600 hover:bg-red-600">Κολλημένο</Badge>}
                            {item.missingCount > 0 && (
                              <Badge variant="outline" className="bg-background">{missingDocsLabel(item.missingCount)}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.contactEmail}</TableCell>
                      <TableCell>
                        <div>{TYPE_SHORT[item.typeKey] || item.typeLabel}</div>
                        <div className="text-xs text-muted-foreground">{kindText(item.kind)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-background">{item.statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(item.lastActivityAt).toLocaleString("el-GR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : detailQuery.isLoading || !detail ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => {
            setSelectedId(null);
            onSelectionChange(null);
          }}>
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
              <Badge variant="secondary">{kindText(detail.kind)}</Badge>
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

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <button type="button" className="inline-flex items-center gap-1" onClick={onClick}>
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}
