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
  createdAt: string;
  summaryMarkdown: string;
  actionItems: ActionItem[];
}

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Set<string>>(new Set());
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    const [meetingsRes, recipientsRes] = await Promise.all([
      fetch("/api/meetings").then((r) => r.json()),
      fetch("/api/recipients").then((r) => r.json()),
    ]);
    setMeetings(meetingsRes.meetings ?? []);
    setRecipients(recipientsRes.recipients ?? []);
    setLoading(false);
  }

  function toggleMeeting(id: string) {
    setSelectedMeetingIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRecipient(email: string) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  function toggleSelectAllRecipients() {
    setSelectedRecipients((prev) =>
      prev.size === recipients.length ? new Set() : new Set(recipients)
    );
  }

  async function handleAddEmail() {
    if (!newEmail.includes("@")) return;
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });
    const data = await res.json();
    setRecipients(data.recipients ?? []);
    setNewEmail("");
  }

  async function handleDeleteEmail(email: string) {
    const res = await fetch("/api/recipients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setRecipients(data.recipients ?? []);
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  }

  async function handleSend() {
    setSending(true);
    setStatus(null);
    const meetingsToSend = meetings.filter((m) => selectedMeetingIds.has(m.id));
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetings: meetingsToSend,
        recipients: Array.from(selectedRecipients),
      }),
    });
    const data = await res.json();
    setSending(false);
    setStatus(data.ok ? "Sent!" : `Error: ${data.error}`);
  }

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Pocket Meeting Dashboard</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Meetings (since yesterday)</h2>
        {meetings.length === 0 && <p>No meetings found.</p>}
        {meetings.map((m) => (
          <label
            key={m.id}
            style={{
              display: "block",
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selectedMeetingIds.has(m.id)}
              onChange={() => toggleMeeting(m.id)}
              style={{ marginRight: 8 }}
            />
            <strong>{m.title}</strong>
            <div style={{ fontSize: 12, color: "#666" }}>
              {new Date(m.createdAt).toLocaleString()}
            </div>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.summaryMarkdown}</p>
            {m.actionItems.length > 0 && (
              <ul style={{ fontSize: 14 }}>
                {m.actionItems.map((a, i) => (
                  <li key={i}>
                    {a.label} {a.dueDate ? `(due ${a.dueDate})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </label>
        ))}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Recipients</h2>
        <div style={{ marginBottom: 8 }}>
          <button onClick={toggleSelectAllRecipients}>
            {selectedRecipients.size === recipients.length ? "Deselect All" : "Select All"}
          </button>
        </div>
        {recipients.map((email) => (
          <div key={email} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={selectedRecipients.has(email)}
              onChange={() => toggleRecipient(email)}
            />
            <span style={{ flex: 1 }}>{email}</span>
            <button onClick={() => handleDeleteEmail(email)}>Delete</button>
          </div>
        ))}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            type="email"
            placeholder="new.email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: 1, padding: 6 }}
          />
          <button onClick={handleAddEmail}>Add</button>
        </div>
      </section>

      <button
        onClick={handleSend}
        disabled={sending || selectedMeetingIds.size === 0 || selectedRecipients.size === 0}
        style={{ padding: "10px 20px", fontSize: 16 }}
      >
        {sending ? "Sending..." : "Send Selected Summaries"}
      </button>
      {status && <p>{status}</p>}
    </main>
  );
}
