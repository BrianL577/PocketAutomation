export interface RecapWorkspace {
  id: string;
  name: string;
}

export class RecapNotConfiguredError extends Error {
  constructor() {
    super("RECAP_API_KEY / RECAP_BASE_URL are not set");
    this.name = "RecapNotConfiguredError";
  }
}

function recapConfig() {
  const baseUrl = process.env.RECAP_BASE_URL;
  const apiKey = process.env.RECAP_API_KEY;
  if (!baseUrl || !apiKey) throw new RecapNotConfiguredError();
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

/** Every workspace the configured personal API key currently has upload
 * (canAddEntry) access to. Recap checks access live on each call, so a
 * short revalidate window (rather than no-store) is enough to stay current
 * with membership changes while keeping the dashboard's 2-minute poll from
 * running into Recap's per-key rate limit (30-60 req/min).
 */
export async function listRecapWorkspaces(): Promise<RecapWorkspace[]> {
  const { baseUrl, apiKey } = recapConfig();
  const resp = await fetch(`${baseUrl}/api/external/v1/workspaces`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 30 },
  });
  if (!resp.ok) throw new Error(`Recap workspaces error ${resp.status}`);
  const json = await resp.json();
  return (json.workspaces ?? json.data ?? json) as RecapWorkspace[];
}

export interface RecapEntryInput {
  source: string;
  externalId: string;
  text: string;
  title?: string;
  tagNames?: string[];
}

/** Pushes (or updates, on a repeat externalId) one entry into a Recap
 * workspace. Throws on any non-2xx response - callers decide whether a
 * failed push should block the rest of a batch.
 */
export async function pushRecapEntry(workspaceId: string, entry: RecapEntryInput): Promise<void> {
  const { baseUrl, apiKey } = recapConfig();
  const resp = await fetch(`${baseUrl}/api/external/v1/workspaces/${workspaceId}/entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entry),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Recap entry push error ${resp.status}: ${body}`);
  }
}
