import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDemoMode } from "@/hooks/use-demo-mode";

type Style = { id: string; name: string; label: string; previewUrl: string | null };
type Job = {
  id: number;
  fileName: string;
  styleName: string;
  status: "processing" | "completed" | "failed";
  error: string | null;
  createdAt: string | null;
  retentionDays: number;
};
type VideoList = {
  jobs: Job[];
  usage: { count: number; limit: number };
  retentionDays: number;
  maxSeconds: number;
};

async function readError(response: Response) {
  const data = await response.json().catch(() => ({}));
  return data.error || "Κάτι πήγε στραβά.";
}

function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration)) reject(new Error("Δεν διαβάστηκε η διάρκεια. Χρησιμοποίησε mp4."));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Δεν διαβάστηκε το βίντεο."));
    };
    video.src = url;
  });
}

export function VideoPanel({ websiteId }: { websiteId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { blockIfDemo } = useDemoMode();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [styleId, setStyleId] = useState("");
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery<VideoList>({
    queryKey: ["/api/websites", websiteId, "videos"],
    queryFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/videos`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
    refetchInterval: (query) => query.state.data?.jobs.some((job) => job.status === "processing") ? 5000 : false,
  });

  const stylesQuery = useQuery<{ styles: Style[] }>({
    queryKey: ["/api/websites", websiteId, "videos", "styles"],
    queryFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/videos/styles`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await fetch(`/api/websites/${websiteId}/videos/${jobId}/download`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const usage = listQuery.data?.usage;
  const count = usage?.count ?? 0;
  const limit = usage?.limit ?? 10;
  const maxSeconds = listQuery.data?.maxSeconds ?? 90;
  const retentionDays = listQuery.data?.retentionDays ?? 30;
  const styles = stylesQuery.data?.styles || [];
  const atLimit = count >= limit;

  const start = async () => {
    if (blockIfDemo()) return;
    if (!file || !styleId) return;
    setBusy(true);
    try {
      const duration = await readDuration(file);
      if (duration > maxSeconds) {
        throw new Error(t("dashboard.videoTooLong", { seconds: maxSeconds }) || `Το βίντεο πρέπει να είναι έως ${maxSeconds} δευτερόλεπτα.`);
      }
      const lowerName = file.name.toLowerCase();
      const contentType = file.type === "video/quicktime" || lowerName.endsWith(".mov")
        ? "video/quicktime"
        : file.type === "video/mp4" || lowerName.endsWith(".mp4")
          ? "video/mp4"
          : "";
      if (!contentType) throw new Error("Το αρχείο πρέπει να είναι mp4 ή mov.");
      const uploadResponse = await fetch(`/api/websites/${websiteId}/videos/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error(await readError(uploadResponse));
      const uploaded = await uploadResponse.json() as { key: string };
      const createResponse = await fetch(`/api/websites/${websiteId}/videos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: uploaded.key,
          styleId,
          fileName: file.name,
          durationSeconds: duration,
        }),
      });
      if (!createResponse.ok) throw new Error(await readError(createResponse));
      setFile(null);
      setStyleId("");
      await queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "videos"] });
      toast({ description: t("dashboard.videoStarted") || "Η επεξεργασία ξεκίνησε." });
    } catch (error) {
      const message = error instanceof TypeError
        ? "Η σύνδεση με τον server κόπηκε. Έλεγξε ότι τρέχει και δοκίμασε ξανά."
        : error instanceof Error ? error.message : "Κάτι πήγε στραβά.";
      toast({ description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="section-video">
      <div>
        <h2 className="text-2xl font-semibold">{t("dashboard.video") || "Επεξεργασία βίντεο"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.videoDescription") || "Ανέβασε ένα βίντεο. Προσθέτουμε κινούμενους ελληνικούς υπότιτλους."}
        </p>
        <p className="mt-2 text-sm" data-testid="video-usage">
          {t("dashboard.videoUsage", { count, limit }) || `${count} / ${limit} βίντεο αυτόν τον μήνα`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.videoRetention", { days: retentionDays }) || `Διαθέσιμο για λήψη για ${retentionDays} ημέρες`}
        </p>
        {atLimit ? (
          <p className="mt-2 text-sm text-destructive">{t("dashboard.videoMonthlyLimit") || "Έχετε φτάσει τα 10 βίντεο για αυτόν τον μήνα."}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.videoNew") || "Νέο βίντεο"}</CardTitle>
          <CardDescription>
            {t("dashboard.videoMax", { seconds: maxSeconds }) || `Έως ${maxSeconds} δευτερόλεπτα.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            data-testid="input-video-file"
          />
          {stylesQuery.isError ? (
            <p className="text-sm text-destructive">{(stylesQuery.error as Error).message}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyleId(style.id)}
                  className={`rounded-md border p-3 text-left ${styleId === style.id ? "border-primary" : ""}`}
                  data-testid={`video-style-${style.id}`}
                >
                  {style.previewUrl ? (
                    <img src={style.previewUrl} alt="" className="mb-2 h-24 w-full rounded object-cover" />
                  ) : null}
                  <span className="font-medium">{style.label}</span>
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={start}
            disabled={busy || atLimit || !file || !styleId}
            data-testid="button-video-start"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("dashboard.videoStart") || "Ανέβασμα και επεξεργασία"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3" data-testid="video-list">
        {(listQuery.data?.jobs || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.videoEmpty") || "Δεν υπάρχουν βίντεο ακόμα."}</p>
        ) : listQuery.data?.jobs.map((job) => (
          <div key={job.id} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{job.fileName}</p>
              <p className="text-sm text-muted-foreground">{job.styleName}</p>
              {job.status === "failed" && job.error ? <p className="mt-1 text-sm text-destructive">{job.error}</p> : null}
            </div>
            {job.status === "completed" ? (
              <Button
                variant="secondary"
                disabled={downloadMutation.isPending}
                onClick={() => downloadMutation.mutate(job.id)}
                data-testid={`button-video-download-${job.id}`}
              >
                {t("dashboard.videoDownload") || "Λήψη"}
              </Button>
            ) : (
              <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>
                {job.status === "failed"
                  ? t("dashboard.videoFailed") || "Απέτυχε"
                  : t("dashboard.videoProcessing") || "Επεξεργασία..."}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
