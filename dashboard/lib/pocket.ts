import { getAssignments } from "./assignments";

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
  contextKey: string;
  createdAt: string;
  summaryMarkdown: string;
  actionItems: ActionItem[];
}

/** Groups recurring meeting series (e.g. "AUS-BIOGAS | Call w/ Heart Energy")
 * under a stable key so recipient assignments persist day to day, even
 * though each recording gets a new id and a slightly different title.
 *
 * Matching is keyword-based rather than strict-prefix: if a title contains
 * (anywhere, case-insensitively) a key we've already used for a previous
 * meeting, it's folded into that same series. The longest matching known
 * key wins, since e.g. "Condor" could be a substring of a longer key.
 * Falls back to the text before the first "|" (or the full title) when no
 * known key matches, which seeds the very first meeting of a new series.
 */
export function contextKeyFor(title: string, knownKeys: string[] = []): string {
  const lowerTitle = title.toLowerCase();
  const matches = knownKeys.filter((key) => key && lowerTitle.includes(key.toLowerCase()));
  if (matches.length > 0) {
    return matches.sort((a, b) => b.length - a.length)[0];
  }
  const [head] = title.split("|");
  return head.trim();
}

function pocketHeaders() {
  const apiKey = process.env.POCKET_API_KEY;
  if (!apiKey) throw new Error("POCKET_API_KEY is not set");
  return { Authorization: `Bearer ${apiKey}` };
}

async function listRecordings(limit = 50) {
  const url = new URL(`${POCKET_BASE_URL}/public/recordings`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "-created_at");

  const resp = await fetch(url, { headers: pocketHeaders() });
  if (!resp.ok) throw new Error(`Pocket list error ${resp.status}`);
  const json = await resp.json();
  return json.data as Array<{ id: string; title: string; created_at: string; state: string }>;
}

async function getRecordingDetail(id: string) {
  const resp = await fetch(`${POCKET_BASE_URL}/public/recordings/${id}`, {
    headers: pocketHeaders(),
  });
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

/** Pulls recordings from the given start of day (inclusive) to now, skipping
 * daily-highlights digests (we want individual meetings) and anything not
 * yet processed.
 */
export async function getMeetingsSince(sinceISO: string): Promise<Meeting[]> {
  const recordings = await listRecordings(50);
  const since = new Date(sinceISO).getTime();

  const candidates = recordings.filter((r) => {
    if (r.id.startsWith("daily-highlights")) return false;
    if (new Date(r.created_at).getTime() < since) return false;
    return true;
  });

  const [details, assignments] = await Promise.all([
    Promise.all(candidates.map((rec) => getRecordingDetail(rec.id).catch(() => null))),
    getAssignments(),
  ]);
  const knownKeys = Object.keys(assignments);

  const meetings: Meeting[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const rec = candidates[i];
    const detail = details[i];
    if (!detail) continue;
    if (detail.state !== "completed" && !detail.summarizations) continue;

    const { summary, actionItems } = extractSummaryAndActionItems(detail);
    if (!summary) continue;

    const contextKey = contextKeyFor(rec.title, knownKeys);
    if (!knownKeys.includes(contextKey)) knownKeys.push(contextKey);

    meetings.push({
      id: rec.id,
      title: rec.title,
      contextKey,
      createdAt: rec.created_at,
      summaryMarkdown: summary,
      actionItems,
    });
  }

  return meetings;
}
