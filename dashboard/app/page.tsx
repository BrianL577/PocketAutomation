"use client";

import { useEffect, useState } from "react";

interface ActionItem {
  label: string;
  priority?: string;
  dueDate?: string | null;
}

interface Meeting {
  id: string;
  title: string;
  contextKey: string;
  createdAt: string;
  summaryMarkdown: string;
  actionItems: ActionItem[];
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

function MeetingPanel({
  meeting,
  allRecipients,
  assigned,
  onToggleRecipient,
  onSelectAll,
  onAddEmail,
  onDeleteEmail,
}: {
  meeting: Meeting;
  allRecipients: string[];
  assigned: string[];
  onToggleRecipient: (contextKey: string, email: string) => void;
  onSelectAll: (contextKey: string) => void;
  onAddEmail: (contextKey: string, email: string) => void;
  onDeleteEmail: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  function submitNewEmail() {
    if (newEmail.includes("@")) {
      onAddEmail(meeting.contextKey, newEmail.trim());
      setNewEmail("");
    }
    setAdding(false);
  }

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setOpen((o) => !o)}>
        <Chevron open={open} />
        <div className="panel-header-text">
          <div className="panel-title">{meeting.title}</div>
          <div className="panel-meta">{new Date(meeting.createdAt).toLocaleString()}</div>
        </div>
        {assigned.length > 0 && (
          <span className="recipient-count">
            {assigned.length} recipient{assigned.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {open && (
        <div className="panel-body">
          <div className="summary-text">{meeting.summaryMarkdown}</div>
          {meeting.actionItems.length > 0 && (
            <ul className="action-items">
              {meeting.actionItems.map((a, i) => (
                <li key={i}>
                  {a.label} {a.dueDate ? `(due ${a.dueDate})` : ""}
                </li>
              ))}
            </ul>
          )}

          <div className="recipients-label">Send to</div>
          <div className="chip-row">
            {allRecipients.length > 2 && (
              <button
                className="chip select-all"
                onClick={() => onSelectAll(meeting.contextKey)}
              >
                {assigned.length === allRecipients.length ? "Deselect all" : "Select all"}
              </button>
            )}
            {allRecipients.map((email) => (
              <span key={email} className="chip-wrap">
                <button
                  className={`chip ${assigned.includes(email) ? "selected" : ""}`}
                  onClick={() => onToggleRecipient(meeting.contextKey, email)}
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
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
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
      const [meetingsRes, recipientsRes, assignmentsRes] = await Promise.all([
        fetch("/api/meetings").then((r) => r.json()),
        fetch("/api/recipients").then((r) => r.json()),
        fetch("/api/assignments").then((r) => r.json()),
      ]);
      const firstError = meetingsRes.error || recipientsRes.error || assignmentsRes.error;
      if (firstError) {
        setStatus(`Error loading data: ${firstError}`);
        setStatusIsError(true);
      }
      setMeetings(meetingsRes.meetings ?? []);
      setRecipients(recipientsRes.recipients ?? []);
      setAssignments(assignmentsRes.assignments ?? {});
    } catch (err: any) {
      setStatus(`Error loading data: ${err.message}`);
      setStatusIsError(true);
    } finally {
      if (showLoadingScreen) setLoading(false);
    }
  }

  async function persistAssignment(contextKey: string, emails: string[]) {
    setAssignments((prev) => ({ ...prev, [contextKey]: emails }));
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextKey, emails }),
    });
  }

  function toggleRecipient(contextKey: string, email: string) {
    const current = assignments[contextKey] ?? [];
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    persistAssignment(contextKey, next);
  }

  function selectAll(contextKey: string) {
    const current = assignments[contextKey] ?? [];
    const next = current.length === recipients.length ? [] : recipients;
    persistAssignment(contextKey, next);
  }

  async function addEmail(contextKey: string, email: string) {
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    const updatedRecipients: string[] = data.recipients ?? [];
    setRecipients(updatedRecipients);

    const current = assignments[contextKey] ?? [];
    if (!current.includes(email)) {
      persistAssignment(contextKey, [...current, email]);
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
        setStatus(
          data.sent.length > 0
            ? `Sent ${data.sent.length} digest${data.sent.length > 1 ? "s" : ""}.`
            : "Nothing to send — no meeting has assigned recipients yet."
        );
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      setStatusIsError(true);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="loading-screen">Loading...</div>;

  const hasAnyAssignment = Object.values(assignments).some((v) => v.length > 0);

  return (
    <div className="page">
      <div className="header">
        <h1>Pocket Meeting Dashboard</h1>
        <p>Review yesterday&rsquo;s meetings, assign who should hear about each one, and send.</p>
      </div>

      <div className="section-title">Meetings</div>
      {meetings.length === 0 && <div className="empty">No meetings found since yesterday.</div>}
      {meetings.map((m) => (
        <MeetingPanel
          key={m.id}
          meeting={m}
          allRecipients={recipients}
          assigned={assignments[m.contextKey] ?? []}
          onToggleRecipient={toggleRecipient}
          onSelectAll={selectAll}
          onAddEmail={addEmail}
          onDeleteEmail={deleteEmail}
        />
      ))}

      <div className="footer-bar">
        <button className="send-button" onClick={handleSend} disabled={sending || !hasAnyAssignment}>
          {sending ? "Sending..." : "Send Now"}
        </button>
        {status && <div className={`status-message ${statusIsError ? "error" : ""}`}>{status}</div>}
      </div>
    </div>
  );
}
