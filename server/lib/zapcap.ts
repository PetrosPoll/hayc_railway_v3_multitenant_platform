import { mapProviderStatus, VIDEO_RETENTION_DAYS, type VideoProvider, type VideoStyle } from "./video-provider";

const API = "https://api.zapcap.ai";
const STYLE_ORDER = ["basic", "highlighted", "animated"] as const;
const STYLE_LABELS: Record<string, string> = {
  basic: "Απλό",
  highlighted: "Έντονο",
  animated: "Κινηματογραφικό",
};

type Json = Record<string, unknown>;

function apiKey() {
  const key = process.env.ZAPCAP_API_KEY || "";
  if (!key) throw new Error("Το ZapCap δεν είναι ρυθμισμένο.");
  return key;
}

async function zapcap(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const record = data && typeof data === "object" ? data as Json : {};
    const message = typeof record.message === "string" ? record.message : typeof record.error === "string" ? record.error : `ZapCap ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function previewOf(item: Json): string | null {
  const previews = asRecord(item.previews);
  if (typeof previews.previewGif === "string" && previews.previewGif) return previews.previewGif;
  if (typeof item.previewUrl === "string" && item.previewUrl) return item.previewUrl;
  return null;
}

function categoryOf(item: Json): string {
  const categories = Array.isArray(item.categories) ? item.categories.map(String) : [];
  return STYLE_ORDER.find((category) => categories.includes(category)) || categories[0] || "basic";
}

function asList(data: unknown): Json[] {
  if (Array.isArray(data)) return data.filter((item): item is Json => !!item && typeof item === "object" && !Array.isArray(item));
  const record = asRecord(data);
  for (const key of ["videos", "data", "items", "templates"]) {
    if (Array.isArray(record[key])) return asList(record[key]);
  }
  return [];
}

let styleCache: { at: number; styles: VideoStyle[] } | null = null;

async function listStyles(): Promise<VideoStyle[]> {
  if (styleCache && Date.now() - styleCache.at < 10 * 60 * 1000) return styleCache.styles;
  const list = asList(await zapcap("/templates")).filter((item) => item.id);
  const picked: Json[] = [];
  for (const category of STYLE_ORDER) {
    const match = list.find((item) => categoryOf(item) === category && !picked.includes(item));
    if (match) picked.push(match);
  }
  for (const item of list) {
    if (picked.length >= 3) break;
    if (!picked.includes(item)) picked.push(item);
  }
  const styles = picked.slice(0, 3).map((item) => {
    const category = categoryOf(item);
    return {
      id: String(item.id),
      name: category,
      label: STYLE_LABELS[category] || category,
      previewUrl: previewOf(item),
    };
  });
  if (styles.length) styleCache = { at: Date.now(), styles };
  return styles;
}

function videoStatus(item: Json): string {
  return String(item.status || "");
}

async function sourceReceived(videoId: string, initial: Json): Promise<boolean> {
  const first = videoStatus(initial);
  if (first === "uploaded") return true;
  if (first === "aborted") return false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const match = asList(await zapcap("/videos")).find((item) => String(item.id || "") === videoId);
      if (!match) continue;
      const status = videoStatus(match);
      if (status === "uploaded") return true;
      if (status === "aborted") return false;
    } catch {
      // the list route can fail while the upload is still finishing
    }
  }
  return false;
}

export function createZapcapProvider(): VideoProvider {
  return {
    id: "zapcap",
    retentionDays: VIDEO_RETENTION_DAYS,
    listStyles,
    async submit({ sourceUrl, styleId }) {
      const uploaded = asRecord(await zapcap(`/videos/url?ttl=1d`, {
        method: "POST",
        body: JSON.stringify({ url: sourceUrl }),
      }));
      const providerVideoId = String(uploaded.id || "");
      if (!providerVideoId) throw new Error("Το ZapCap δεν επέστρεψε βίντεο.");
      const received = await sourceReceived(providerVideoId, uploaded);
      if (!received) throw new Error("Το ZapCap δεν πρόλαβε να πάρει το βίντεο. Δοκίμασε ξανά.");
      const task = asRecord(await zapcap(`/videos/${providerVideoId}/task?ttl=30d`, {
        method: "POST",
        body: JSON.stringify({
          templateId: styleId,
          autoApprove: true,
          language: "el",
        }),
      }));
      const providerTaskId = String(task.taskId || task.id || "");
      if (!providerTaskId) throw new Error("Το ZapCap δεν ξεκίνησε την επεξεργασία.");
      return { providerVideoId, providerTaskId, received };
    },
    async status({ providerVideoId, providerTaskId }) {
      const task = asRecord(await zapcap(`/videos/${providerVideoId}/task/${providerTaskId}`));
      const status = mapProviderStatus(task.status);
      const error = typeof task.error === "string" ? task.error : typeof task.message === "string" && status === "failed" ? task.message : undefined;
      return { status, error };
    },
    async downloadUrl({ providerVideoId, providerTaskId }) {
      const task = asRecord(await zapcap(`/videos/${providerVideoId}/task/${providerTaskId}`));
      if (mapProviderStatus(task.status) !== "completed" || typeof task.downloadUrl !== "string" || !task.downloadUrl) {
        throw new Error("Το βίντεο δεν είναι έτοιμο για λήψη.");
      }
      return task.downloadUrl;
    },
  };
}
