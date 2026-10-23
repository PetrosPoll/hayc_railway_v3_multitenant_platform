import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = {
  typeLabel: string;
  allowUploads: boolean;
  missing: { id: number; key: string; label: string }[];
};

export default function ReceptionUploadPage() {
  const { token = "" } = useParams();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [done, setDone] = useState(false);

  const query = useQuery({
    queryKey: ["/public/reception", token],
    queryFn: async () => {
      const res = await fetch(`/public/reception/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Ο σύνδεσμος δεν ισχύει");
      return body as View;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      const data = new FormData();
      for (const [key, file] of Object.entries(files)) {
        if (file) data.append(key, file);
      }
      const res = await fetch(`/public/reception/${token}`, { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Αποτυχία ανεβάσματος");
      return body as View;
    },
    onSuccess: () => setDone(true),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    upload.mutate();
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">Έγγραφα αιτήματος</h1>
      {query.isLoading ? (
        <Loader2 className="mt-6 h-5 w-5 animate-spin" />
      ) : query.isError ? (
        <p className="mt-4 text-sm">{query.error.message}</p>
      ) : done ? (
        <p className="mt-4 text-sm">Τα αρχεία στάλθηκαν. Ευχαριστούμε.</p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <p className="text-sm text-muted-foreground">{query.data?.typeLabel}</p>
          {query.data?.missing.length === 0 ? (
            <p className="text-sm">Δεν λείπει κάποιο έγγραφο.</p>
          ) : (
            query.data?.missing.map((doc) => (
              <label key={doc.id} className="block space-y-1 text-sm">
                <span>{doc.label}</span>
                {query.data?.allowUploads ? (
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="block w-full text-sm"
                    onChange={(e) =>
                      setFiles((current) => ({ ...current, [doc.key]: e.target.files?.[0] || null }))
                    }
                  />
                ) : (
                  <p className="text-muted-foreground">Στείλτε το στον ασφαλιστή σας. Δεν ανεβαίνει αρχείο από εδώ.</p>
                )}
              </label>
            ))
          )}
          {query.data?.allowUploads && (query.data.missing.length || 0) > 0 && (
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? "Αποστολή…" : "Αποστολή"}
            </Button>
          )}
          {upload.isError && <p className="text-sm text-red-600">{upload.error.message}</p>}
        </form>
      )}
    </main>
  );
}
