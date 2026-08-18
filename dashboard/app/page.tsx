"use client";

import { useEffect, useMemo, useState } from "react";

interface ActionItem {
  label: string;
  priority?: string;
  dueDate?: string | null;
}

interface Meeting {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  summaryMarkdown: string;
  actionItems: ActionItem[];
  isProcessingComplete: boolean;
}

interface RecapWorkspace {
  id: string;
  name: string;
}

interface MeetingWorkspace {
  id: string;
  name: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`chevron ${open ? "open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecipientChips({
  allRecipients,
  assigned,
  onToggle,
  onSelectAll,
  onAddEmail,
  onDeleteEmail,
}: {
  allRecipients: string[];
  assigned: string[];
  onToggle: (email: string) => void;
  onSelectAll: () => void;
  onAddEmail: (email: string) => void;
  onDeleteEmail: (email: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  function submitNewEmail() {
    if (newEmail.includes("@")) {
      onAddEmail(newEmail.trim());
      setNewEmail("");
    }
    setAdding(false);
  }

  return (
    <div className="chip-row">
      {allRecipients.length > 2 && (
        <button className="chip select-all" onClick={onSelectAll}>
          {assigned.length === allRecipients.length ? "Deselect all" : "Select all"}
        </button>
      )}
      {allRecipients.map((email) => (
        <span key={email} className="chip-wrap">
          <button
            className={`chip ${assigned.includes(email) ? "selected" : ""}`}
            onClick={() => onToggle(email)}
          >
            {email}
          </button>
          <button
            className="chip-delete"
            title={`Remove ${email}`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEmail(email);
            }}
          >
            &times;
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className="chip-add-input"
          placeholder="name@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNewEmail()}
          onBlur={submitNewEmail}
        />
      ) : (
        <button className="chip add-new" onClick={() => setAdding(true)}>
          + New email
        </button>
      )}
    </div>
  );
}

function MeetingPanel({
  meeting,
  allRecipients,
  assigned,
  includedInSend,
  workspaces,
  recapWorkspaces,
  recapConfigured,
  onToggleRecipient,
  onSelectAll,
  onAddEmail,
  onDeleteEmail,
  onToggleIncluded,
  onWorkspacesChange,
}: {
  meeting: Meeting;
  allRecipients: string[];
  assigned: string[];
  includedInSend: boolean;
  workspaces: MeetingWorkspace[];
  recapWorkspaces: RecapWorkspace[];
  recapConfigured: boolean;
  onToggleRecipient: (meetingId: string, email: string) => void;
  onSelectAll: (meetingId: string) => void;
  onAddEmail: (meetingId: string, email: string) => void;
  onDeleteEmail: (email: string) => void;
  onToggleIncluded: (meetingId: string) => void;
  onWorkspacesChange: (meetingId: string, workspaces: MeetingWorkspace[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasWorkspace = workspaces.length > 0;

  function toggleWorkspace(w: RecapWorkspace) {
    const already = workspaces.some((x) => x.id === w.id);
    const next = already ? workspaces.filter((x) => x.id !== w.id) : [...workspaces, { id: w.id, name: w.name }];
    onWorkspacesChange(meeting.id, next);
  }

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setOpen((o) => !o)}>
        <input
          type="checkbox"
          className="panel-checkbox"
          checked={includedInSend}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleIncluded(meeting.id)}
        />
        <Chevron open={open} />
        <div className="panel-header-text">
          <div className="panel-title">{meeting.title}</div>
          <div className="panel-meta">
            {new Date(meeting.createdAt).toLocaleString()}
            {meeting.tags.length > 0 && (
              <>
                {" "}
                &middot;{" "}
                {meeting.tags.map((t) => (
                  <span key={t} className="tag-badge">
                    {t}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        {assigned.length > 0 && (
          <span className="recipient-count">
            {assigned.length} recipient{assigned.length > 1 ? "s" : ""}
          </span>
        )}
        {includedInSend && assigned.length === 0 && (
          <span className="missing-badge">Needs recipients</span>
        )}
        {includedInSend && assigned.length > 0 && recapConfigured && !hasWorkspace && (
          <span className="info-badge">Not synced to Recap</span>
        )}
      </div>

      {open && (
        <div className="panel-body">
          <div className="summary-text">
            {meeting.isProcessingComplete
              ? meeting.summaryMarkdown
              : "Summary still processing..."}
          </div>
          {meeting.actionItems.length > 0 && (
            <ul className="action-items">
              {meeting.actionItems.map((a, i) => (
                <li key={i}>
                  {a.label} {a.dueDate ? `(due ${a.dueDate})` : ""}
                </li>
              ))}
            </ul>
          )}

          <div className="recipients-label">Send to (required)</div>
          <RecipientChips
            allRecipients={allRecipients}
            assigned={assigned}
            onToggle={(email) => onToggleRecipient(meeting.id, email)}
            onSelectAll={() => onSelectAll(meeting.id)}
            onAddEmail={(email) => onAddEmail(meeting.id, email)}
            onDeleteEmail={onDeleteEmail}
          />

          <div className="recipients-label workspace-label">Recap workspaces (optional)</div>
          {recapConfigured ? (
            recapWorkspaces.length === 0 ? (
              <div className="empty">No workspaces available to this Recap key.</div>
            ) : (
              <div className="chip-row">
                {recapWorkspaces.map((w) => (
                  <button
                    key={w.id}
                    className={`chip ${workspaces.some((x) => x.id === w.id) ? "selected" : ""}`}
                    onClick={() => toggleWorkspace(w)}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="workspace-unconfigured">
              Recap isn't connected yet - set RECAP_BASE_URL and RECAP_API_KEY to sync entries there.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagRoutingPanel({
  tags,
  tagRecipients,
}: {
  tags: string[];
  tagRecipients: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel panel-disabled">
      <div className="panel-header" onClick={() => setOpen((o) => !o)}>
        <Chevron open={open} />
        <div className="panel-header-text">
          <div className="panel-title">
            Tag Routing <span className="disabled-badge">Disabled</span>
          </div>
          <div className="panel-meta">
            Auto-routing by tag has been turned off. Assign recipients and a Recap workspace on each
            meeting below instead.
          </div>
        </div>
      </div>

      {open && (
        <div className="panel-body">
          {tags.length === 0 && <div className="empty">No tags seen yet.</div>}
          {tags.map((tag) => (
            <div key={tag} className="tag-route-row">
              <div className="tag-route-label">{tag}</div>
              <div className="chip-row">
                {(tagRecipients[tag] ?? []).length === 0 ? (
                  <span className="chip disabled">no recipients configured</span>
                ) : (
                  (tagRecipients[tag] ?? []).map((email) => (
                    <span key={email} className="chip disabled">
                      {email}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [sendEnabled, setSendEnabledState] = useState<Record<string, boolean>>({});
  const [tagRecipients, setTagRecipients] = useState<Record<string, string[]>>({});
  const [workspaces, setWorkspaces] = useState<Record<string, MeetingWorkspace[]>>({});
  const [recapWorkspaces, setRecapWorkspaces] = useState<RecapWorkspace[]>([]);
  const [recapConfigured, setRecapConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  useEffect(() => {
    refreshAll(true);
    const interval = setInterval(() => refreshAll(false), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function refreshAll(showLoadingScreen: boolean) {
    if (showLoadingScreen) setLoading(true);
    setStatus(null);
    try {
      const [
        meetingsRes,
        recipientsRes,
        assignmentsRes,
        sendEnabledRes,
        tagRecipientsRes,
        workspacesRes,
        recapWorkspacesRes,
      ] = await Promise.all([
        fetch("/api/meetings", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/recipients", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/assignments", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/send-enabled", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/tag-recipients", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/workspace", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/recap/workspaces", { cache: "no-store" }).then((r) => r.json()),
      ]);
      const firstError =
        meetingsRes.error || recipientsRes.error || assignmentsRes.error || sendEnabledRes.error ||
        tagRecipientsRes.error || workspacesRes.error || recapWorkspacesRes.error;
      if (firstError) {
        setStatus(`Error loading data: ${firstError}`);
        setStatusIsError(true);
      }
      setMeetings(meetingsRes.meetings ?? []);
      setRecipients(recipientsRes.recipients ?? []);
      setAssignments(assignmentsRes.assignments ?? {});
      setSendEnabledState(sendEnabledRes.sendEnabled ?? {});
      setTagRecipients(tagRecipientsRes.tagRecipients ?? {});
      setWorkspaces(workspacesRes.workspaces ?? {});
      setRecapWorkspaces(recapWorkspacesRes.workspaces ?? []);
      setRecapConfigured(recapWorkspacesRes.configured !== false);
    } catch (err: any) {
      setStatus(`Error loading data: ${err.message}`);
      setStatusIsError(true);
    } finally {
      if (showLoadingScreen) setLoading(false);
    }
  }

  function effectiveRecipients(meeting: Meeting): string[] {
    return assignments[meeting.id] ?? [];
  }

  async function persistAssignment(meetingId: string, emails: string[]) {
    setAssignments((prev) => ({ ...prev, [meetingId]: emails }));
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, emails }),
    });
  }

  function toggleRecipient(meetingId: string, email: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    const current = meeting ? effectiveRecipients(meeting) : assignments[meetingId] ?? [];
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    persistAssignment(meetingId, next);
  }

  function selectAll(meetingId: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    const current = meeting ? effectiveRecipients(meeting) : assignments[meetingId] ?? [];
    const next = current.length === recipients.length ? [] : recipients;
    persistAssignment(meetingId, next);
  }

  async function persistWorkspaces(meetingId: string, meetingWorkspaces: MeetingWorkspace[]) {
    setWorkspaces((prev) => ({ ...prev, [meetingId]: meetingWorkspaces }));
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, workspaces: meetingWorkspaces }),
    });
  }

  async function addEmail(meetingId: string, email: string) {
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    const updatedRecipients: string[] = data.recipients ?? [];
    setRecipients(updatedRecipients);

    const meeting = meetings.find((m) => m.id === meetingId);
    const current = meeting ? effectiveRecipients(meeting) : assignments[meetingId] ?? [];
    if (!current.includes(email)) {
      persistAssignment(meetingId, [...current, email]);
    }
  }

  async function deleteEmail(email: string) {
    const res = await fetch("/api/recipients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setRecipients(data.recipients ?? []);
    setAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const [key, emails] of Object.entries(prev)) {
        next[key] = emails.filter((e) => e !== email);
      }
      return next;
    });
    setTagRecipients((prev) => {
      const next: Record<string, string[]> = {};
      for (const [key, emails] of Object.entries(prev)) {
        next[key] = emails.filter((e) => e !== email);
      }
      return next;
    });
  }

  async function persistSendEnabled(meetingId: string, enabled: boolean) {
    setSendEnabledState((prev) => ({ ...prev, [meetingId]: enabled }));
    await fetch("/api/send-enabled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, enabled }),
    });
  }

  function toggleIncluded(meetingId: string) {
    const current = sendEnabled[meetingId] ?? true;
    persistSendEnabled(meetingId, !current);
  }

  function toggleSelectAllPanels() {
    const allIncluded = meetings.every((m) => (sendEnabled[m.id] ?? true));
    meetings.forEach((m) => persistSendEnabled(m.id, !allIncluded));
  }

  async function handleSend() {
    setSending(true);
    setStatus(null);
    setStatusIsError(false);
    try {
      const res = await fetch("/api/send", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
        setStatusIsError(true);
      } else {
        const recapNote =
          data.recapFailed?.length > 0
            ? ` ${data.recapFailed.length} Recap push${data.recapFailed.length > 1 ? "es" : ""} failed (email still sent).`
            : data.recapPushed?.length > 0
              ? ` Pushed ${data.recapPushed.length} entr${data.recapPushed.length > 1 ? "ies" : "y"} to Recap.`
              : "";
        setStatus(
          (data.sent.length > 0
            ? `Sent ${data.sent.length} digest${data.sent.length > 1 ? "s" : ""}.`
            : "Nothing to send — no meeting has assigned recipients yet.") + recapNote
        );
        setStatusIsError(data.recapFailed?.length > 0);
        await refreshAll(false);
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      setStatusIsError(true);
    } finally {
      setSending(false);
    }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of meetings) for (const t of m.tags) set.add(t);
    for (const t of Object.keys(tagRecipients)) set.add(t);
    return Array.from(set).sort();
  }, [meetings, tagRecipients]);

  if (loading) return <div className="loading-screen">Loading...</div>;

  // Only recipients gate whether the button is clickable at all - a meeting
  // missing its (also-required) workspace still shows the "needs" badge and
  // is skipped server-side, but doesn't lock out sending everything else.
  const sendableMeetingIds = meetings
    .filter((m) => (sendEnabled[m.id] ?? true) && effectiveRecipients(m).length > 0)
    .map((m) => m.id);
  const allPanelsIncluded = meetings.every((m) => sendEnabled[m.id] ?? true);

  return (
    <div className="page">
      <div className="header">
        <h1>Pocket Meeting Dashboard</h1>
        <p>
          New recordings show up here automatically. Sending is manual: assign recipients per meeting,
          then hit Send. Recap workspaces are optional - pick one or more to also sync that meeting's
          entry there.
        </p>
      </div>

      <div className="section-title">Tag Routing</div>
      <TagRoutingPanel tags={allTags} tagRecipients={tagRecipients} />

      <div className="section-title">Meetings</div>
      {meetings.length === 0 && <div className="empty">No meetings found in the last 7 days.</div>}
      {meetings.map((m) => (
        <MeetingPanel
          key={m.id}
          meeting={m}
          allRecipients={recipients}
          assigned={effectiveRecipients(m)}
          includedInSend={sendEnabled[m.id] ?? true}
          workspaces={workspaces[m.id] ?? []}
          recapWorkspaces={recapWorkspaces}
          recapConfigured={recapConfigured}
          onToggleRecipient={toggleRecipient}
          onSelectAll={selectAll}
          onAddEmail={addEmail}
          onDeleteEmail={deleteEmail}
          onToggleIncluded={toggleIncluded}
          onWorkspacesChange={persistWorkspaces}
        />
      ))}

      <div className="footer-bar">
        {meetings.length > 1 && (
          <button className="select-all-panels" onClick={toggleSelectAllPanels}>
            {allPanelsIncluded ? "Deselect all panels" : "Select all panels"}
          </button>
        )}
        <button className="send-button" onClick={handleSend} disabled={sending || sendableMeetingIds.length === 0}>
          {sending ? "Sending..." : "Send Now"}
        </button>
        {status && <div className={`status-message ${statusIsError ? "error" : ""}`}>{status}</div>}
      </div>
    </div>
  );
}
