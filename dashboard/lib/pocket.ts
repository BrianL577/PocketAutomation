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

async function pocketFetch(url: string | URL, canRetry = true): Promise<Response> {
  const resp = await fetch(url, {
    headers: pocketHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  // A transient 429/5xx from Pocket used to get silently swallowed by the
  // caller's .catch(() => null) and shown as "still processing" - retrying
  // once here means a blip doesn't make a finished meeting flicker between
  // "done" and "processing" depending on which poll happened to land on it.
  if ((resp.status === 429 || resp.status >= 500) && canRetry) {
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

function actionItemsFrom(rawActions: any[]): ActionItem[] {
  return rawActions.map((a: any) => ({
    label: a.label,
    assignee: a.assignee,
    priority: a.priority,
    dueDate: a.dueDate ?? null,
    isCompleted: !!(a.isCompleted ?? a.is_completed),
  }));
}

/** Pocket recordings can carry more than one summarization run (e.g. a
 * retry), so the first key isn't necessarily the finished one - check each
 * until one actually has markdown. If none of them do (or the recording
 * predates that nested shape), fall back to whatever plausible top-level
 * summary field is present rather than declaring the meeting unprocessed.
 */
function extractSummaryAndActionItems(detail: any): { summary: string; actionItems: ActionItem[] } {
  const summarizations = detail.summarizations || {};
  for (const key of Object.keys(summarizations)) {
    const v2 = summarizations[key]?.v2;
    const markdown = v2?.summary?.markdown;
    if (markdown) {
      return { summary: markdown, actionItems: actionItemsFrom(v2.actionItems?.actions || []) };
    }
  }

  const fallbackSummary = detail.summary || detail.ai_summary || detail.summary_markdown || "";
  return { summary: fallbackSummary, actionItems: [] };
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
    candidates.map((rec) =>
      getRecordingDetail(rec.id).catch((err) => {
        // Previously swallowed entirely, which made a fetch failure look
        // identical to "genuinely still processing" - log it so a
        // persistent "still processing" panel is diagnosable from the
        // Vercel function logs instead of being a black box.
        console.error(`Pocket detail fetch failed for recording ${rec.id}:`, err?.message ?? err);
        return null;
      })
    )
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
      // Trust whatever Pocket actually handed back over its own state
      // label: some recordings carry a finished summary under a state
      // string that never equals exactly "completed", which made the
      // dashboard show "still processing" even though Pocket itself
      // considers the content ready.
      isProcessingComplete: !!detail && (detail.state === "completed" || !!summary),
    });
  }

  return meetings;
}
