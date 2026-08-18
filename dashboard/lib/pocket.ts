const POCKET_BASE_URL = "https://public.heypocketai.com/api/v1";

export interface ActionItem {
  label: string;
  assignee?: string;
  priority?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  summaryMarkdown: string;
  actionItems: ActionItem[];
  isProcessingComplete: boolean;
}

function pocketHeaders() {
  const apiKey = process.env.POCKET_API_KEY;
  if (!apiKey) throw new Error("POCKET_API_KEY is not set");
  return { Authorization: `Bearer ${apiKey}` };
}

// Pocket's API is rate-limited, and the dashboard polls every 2 minutes
// (plus whatever manual reloads happen on top of that) - a 30s revalidate
// window means bursts of near-simultaneous requests share one upstream
// call instead of each hitting Pocket directly, while still keeping the
// dashboard well within "real time" for a meeting summary tool.
const REVALIDATE_SECONDS = 30;

async function pocketFetch(url: string | URL, retryOn429 = true): Promise<Response> {
  const resp = await fetch(url, {
    headers: pocketHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (resp.status === 429 && retryOn429) {
    const retryAfter = Number(resp.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1500));
    return pocketFetch(url, false);
  }
  return resp;
}

async function listRecordings(limit = 100) {
  const url = new URL(`${POCKET_BASE_URL}/public/recordings`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "-created_at");

  const resp = await pocketFetch(url);
  if (!resp.ok) throw new Error(`Pocket list error ${resp.status}`);
  const json = await resp.json();
  return json.data as Array<{
    id: string;
    title: string;
    created_at: string;
    state: string;
    tags?: Array<{ name: string }>;
  }>;
}

async function getRecordingDetail(id: string) {
  const resp = await pocketFetch(`${POCKET_BASE_URL}/public/recordings/${id}`);
  if (!resp.ok) throw new Error(`Pocket detail error ${resp.status}`);
  const json = await resp.json();
  return json.data;
}

function extractSummaryAndActionItems(detail: any): { summary: string; actionItems: ActionItem[] } {
  const summarizations = detail.summarizations || {};
  const firstKey = Object.keys(summarizations)[0];
  if (!firstKey) return { summary: "", actionItems: [] };

  const v2 = summarizations[firstKey].v2 || {};
  const summary = v2.summary?.markdown || "";
  const rawActions = v2.actionItems?.actions || [];

  const actionItems: ActionItem[] = rawActions.map((a: any) => ({
    label: a.label,
    assignee: a.assignee,
    priority: a.priority,
    dueDate: a.dueDate ?? null,
    isCompleted: !!(a.isCompleted ?? a.is_completed),
  }));

  return { summary, actionItems };
}

/** Pulls recordings from the given start (inclusive) to now, skipping
 * daily-highlights digests (we want individual meetings) and anything not
 * yet processed. Each recording is its own panel/meeting - there is no
 * series grouping.
 */
export async function getMeetingsSince(sinceISO: string): Promise<Meeting[]> {
  const recordings = await listRecordings(100);
  const since = new Date(sinceISO).getTime();

  const candidates = recordings.filter((r) => {
    if (r.id.startsWith("daily-highlights")) return false;
    if (new Date(r.created_at).getTime() < since) return false;
    return true;
  });

  const details = await Promise.all(
    candidates.map((rec) => getRecordingDetail(rec.id).catch(() => null))
  );

  const meetings: Meeting[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const rec = candidates[i];
    const detail = details[i];
    const { summary, actionItems } = detail
      ? extractSummaryAndActionItems(detail)
      : { summary: "", actionItems: [] };

    meetings.push({
      id: rec.id,
      title: rec.title,
      tags: (rec.tags ?? []).map((t) => t.name),
      createdAt: rec.created_at,
      summaryMarkdown: summary,
      actionItems,
      isProcessingComplete: !!detail && detail.state === "completed",
    });
  }

  return meetings;
}
