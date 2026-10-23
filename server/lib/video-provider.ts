export const VIDEO_LIMIT_PER_MONTH = 10;
export const VIDEO_MAX_SECONDS = 90;
export const VIDEO_RETENTION_DAYS = 30;

export type VideoStyle = {
  id: string;
  name: string;
  label: string;
  previewUrl: string | null;
};

export type ProviderJobStatus = "processing" | "completed" | "failed";

export type VideoProvider = {
  id: string;
  retentionDays: number;
  listStyles(): Promise<VideoStyle[]>;
  submit(input: { sourceUrl: string; styleId: string }): Promise<{
    providerVideoId: string;
    providerTaskId: string;
    received: boolean;
  }>;
  status(input: { providerVideoId: string; providerTaskId: string }): Promise<{
    status: ProviderJobStatus;
    stage?: string;
    error?: string;
  }>;
  downloadUrl(input: { providerVideoId: string; providerTaskId: string }): Promise<string>;
};

export function mapProviderStatus(value: unknown): ProviderJobStatus {
  const status = String(value || "").toLowerCase();
  if (status === "completed" || status === "complete" || status === "done") return "completed";
  if (status === "failed" || status === "error" || status === "cancelled" || status === "canceled") return "failed";
  return "processing";
}
