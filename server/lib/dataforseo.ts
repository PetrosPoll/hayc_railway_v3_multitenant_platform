export type KeywordResearch = {
  keyword: string;
  searchVolume: number | null;
  topResults: Array<{ title: string; description: string }>;
};

type DataForSeoTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<Record<string, unknown>> | null;
};

const GREECE_LOCATION_CODE = 2300;
const GREEK_LANGUAGE_CODE = "el";

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not set");
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function postTasks(path: string, body: unknown): Promise<DataForSeoTask> {
  const response = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DataForSEO request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json() as { tasks?: DataForSeoTask[] };
  const task = payload.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(task?.status_message || "DataForSEO returned no result");
  }
  return task;
}

export function readSearchVolume(task: DataForSeoTask): number | null {
  const row = task.result?.[0];
  const volume = row?.search_volume;
  return typeof volume === "number" ? volume : null;
}

export function readOrganicResults(task: DataForSeoTask): Array<{ title: string; description: string }> {
  const result = task.result?.[0];
  const items = Array.isArray(result?.items) ? result.items : [];
  const organic: Array<{ title: string; description: string }> = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "organic") continue;
    const title = String(row.title || "").trim();
    const description = String(row.description || "").trim();
    if (!title) continue;
    organic.push({ title, description });
    if (organic.length >= 8) break;
  }
  return organic;
}

export async function researchKeyword(keyword: string): Promise<KeywordResearch> {
  const phrase = keyword.trim().slice(0, 80);
  const [volumeTask, serpTask] = await Promise.all([
    postTasks("/v3/keywords_data/google_ads/search_volume/live", [{
      location_code: GREECE_LOCATION_CODE,
      language_code: GREEK_LANGUAGE_CODE,
      keywords: [phrase],
    }]),
    postTasks("/v3/serp/google/organic/live/advanced", [{
      keyword: phrase,
      location_code: GREECE_LOCATION_CODE,
      language_code: GREEK_LANGUAGE_CODE,
      depth: 10,
    }]),
  ]);
  return {
    keyword: phrase,
    searchVolume: readSearchVolume(volumeTask),
    topResults: readOrganicResults(serpTask),
  };
}
