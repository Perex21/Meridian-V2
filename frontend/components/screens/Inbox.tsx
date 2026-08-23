import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { IconArrowRight, IconPaperclip, IconSearch } from "@/components/Icon";
import { useStore } from "@/lib/store";

interface Mail {
  from: string;
  department: string;
  time: string;
  subject: string;
  body: string;
  attachment: { filename: string; records: number };
  unlocked: boolean;
}

type QueueItem = {
  id: string;
  from: string;
  department: string;
  time: string;
  subject: string;
  body: string;
  priority: "HIGH" | "MED" | "LOW";
  source: string;
  status: "NEW" | "READ" | "READY";
  kind: "DATA" | "NOTE" | "SYSTEM";
  attachment?: { filename: string; records: number };
};

function StatusCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="inbox-status-cell">
      <span className="inbox-metric-label">{label}</span>
      <strong className={`mono${accent ? " accent" : ""}`}>{value}</strong>
    </div>
  );
}

export default function Inbox() {
  const { go, sessionId, refreshState } = useStore();
  const [mail, setMail] = useState<Mail | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("archive");

  useEffect(() => {
    if (!sessionId) return;
    api.get<Mail>(`/sessions/${sessionId}/inbox`).then(setMail).catch(() => {});
  }, [sessionId]);

  const archive = mail ?? {
    from: "Devika Rao",
    department: "Operations",
    time: "09:12",
    subject: "Pre-2019 pipeline records",
    body: "Found these on the old shared drive. Every company the firm passed on or wrote off since 2012.",
    attachment: { filename: "pipeline_archive_2012_2019.csv", records: 2000 },
    unlocked: false,
  };

  const sourceLabel = archive.body.toLowerCase().includes("shared drive") ? "Shared Drive" : archive.department;
  const archiveStatus = archive.unlocked ? "UNLOCKED" : "READY";

  const queueItems = useMemo<QueueItem[]>(
    () => [
      {
        id: "archive",
        from: archive.from,
        department: archive.department,
        time: archive.time,
        subject: archive.subject,
        body: archive.body,
        priority: "HIGH",
        source: archive.department,
        status: archive.unlocked ? "READY" : "NEW",
        kind: "DATA",
        attachment: archive.attachment,
      },
      {
        id: "sync",
        from: "Priya Nadar",
        department: "Investment Committee",
        time: "08:14",
        subject: "Re: this week's partner sync",
        body: "Moving our 4pm to Thursday, room booked already.",
        priority: "MED",
        source: "Committee",
        status: "READ",
        kind: "NOTE",
      },
      {
        id: "lunch",
        from: "Jonas Mikkel",
        department: "Partner, Growth",
        time: "08:47",
        subject: "Lunch Thursday?",
        body: "Want to grab something before the LP call",
        priority: "LOW",
        source: "Partner",
        status: "READ",
        kind: "NOTE",
      },
      {
        id: "elevator",
        from: "Facilities",
        department: "Building",
        time: "08:31",
        subject: "Elevator B out of service",
        body: "Maintenance scheduled for the west elevator through Friday",
        priority: "LOW",
        source: "Building",
        status: "READ",
        kind: "SYSTEM",
      },
      {
        id: "payroll",
        from: "Payroll",
        department: "HR",
        time: "09:40",
        subject: "Your Feb payslip is ready",
        body: "Log in to the portal to view or download",
        priority: "LOW",
        source: "HR",
        status: "READ",
        kind: "SYSTEM",
      },
    ],
    [archive],
  );

  const selected = queueItems.find((item) => item.id === selectedId) ?? queueItems[0];
  const canOpenArchive = selected.id === "archive";

  async function open() {
    if (!sessionId || !canOpenArchive) return;
    setBusy(true);
    try {
      await api.post(`/sessions/${sessionId}/archive/unlock`);
      await refreshState();
      await go("evidence");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inbox-console">
      <div className="inbox-console-head">
        <div>
          <div className="eyebrow">Inbox / Simulation Control Room</div>
          <h1 className="inbox-title">
            <span>INBOX</span> / CONTROL ROOM
          </h1>
        </div>
        <div className="inbox-head-actions">
          <span className="inbox-head-state"><i className="status-dot" /> SESSION ACTIVE</span>
          <button className="inbox-icon-button" aria-label="Search inbox"><IconSearch size={15} /></button>
        </div>
      </div>

      <div className="run-strip" aria-label="Archive status">
        <StatusCell label="Archive status" value={archiveStatus} accent />
        <StatusCell label="Message state" value={archive.unlocked ? "PROCESSED" : "NEW"} accent={!archive.unlocked} />
        <StatusCell label="Source" value={sourceLabel.toUpperCase()} />
        <StatusCell label="Attachment" value={`${archive.attachment.records.toLocaleString("en-IN")} RECORDS`} />
        <StatusCell label="Next action" value="EVIDENCE →" accent />
      </div>

      <div className="inbox-workspace">
        <section className="inbox-queue" aria-label="Message queue">
          <div className="inbox-panel-head">
            <span className="eyebrow">Message queue</span>
            <span className="mono inbox-unread">1 unread</span>
          </div>
          <div className="inbox-queue-labels mono" aria-hidden="true">
            <span>Sender</span><span>Time</span><span>Priority</span><span>Source</span><span>Status</span>
          </div>
          <div className="inbox-list">
            {queueItems.map((item) => (
              <button
                key={item.id}
                className={`inbox-row ${selected.id === item.id ? "is-selected" : ""}`}
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selected.id === item.id}
              >
                <span className="inbox-row-main">
                  <span className="inbox-row-from">{item.from}</span>
                  <strong>{item.subject}</strong>
                  <span className="inbox-row-preview">{item.body}</span>
                </span>
                <span className="mono inbox-row-time">{item.time}</span>
                <span className={`inbox-priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
                <span className="inbox-row-source">{item.source}</span>
                <span className="inbox-status"><i className="status-dot" />{item.status}</span>
              </button>
            ))}
          </div>
          <div className="inbox-queue-foot">
            <StatusCell label="Queue" value="MESSAGE LIST" />
            <StatusCell label="Unread" value="01" accent />
            <StatusCell label="Selected" value={selected.id === "archive" ? "ARCHIVE" : "CONTEXT"} />
          </div>
        </section>

        <section className="inbox-detail" aria-live="polite" aria-label="Selected message">
          <div className="inbox-panel-head inbox-detail-head">
            <span className="eyebrow">Selected message</span>
            <span className="inbox-pager mono">‹ PREV&nbsp;&nbsp;&nbsp; NEXT ›</span>
          </div>
          <div className="inbox-detail-body">
            <div className="inbox-detail-meta mono">
              <span>From: <b>{selected.from}</b> · {selected.department}</span>
              <span>Time: <b>{selected.time}</b></span>
              <span>Priority: <b className={`inbox-inline-priority ${selected.priority.toLowerCase()}`}>{selected.priority}</b></span>
              <span>Status: <b className="inbox-inline-status"><i className="status-dot" /> {selected.status}</b></span>
            </div>
            <h2>{selected.subject}</h2>
            <p className="inbox-detail-copy">{selected.body}</p>

            {selected.id === "archive" ? (
              <>
                <div className="inbox-section-label">Dataset summary</div>
                <div className="inbox-dataset-grid inbox-real-data-grid">
                  <div className="inbox-data-table mono">
                    <div><span>File</span><b>{selected.attachment?.filename}</b></div>
                    <div><span>Records</span><b>{selected.attachment?.records.toLocaleString("en-IN")}</b></div>
                    <div><span>Source</span><b>{sourceLabel}</b></div>
                    <div><span>Department</span><b>{archive.department}</b></div>
                    <div><span>Message time</span><b>{archive.time}</b></div>
                  </div>
                  <div className="inbox-record-card">
                    <span className="inbox-section-label">Recovered records</span>
                    <strong className="inbox-record-count mono">{selected.attachment?.records.toLocaleString("en-IN")}</strong>
                    <span className="inbox-record-caption">records listed in the attached archive</span>
                    <div className="inbox-record-rule" />
                    <span className="inbox-record-caption">No quality or confidence score is assigned here.</span>
                  </div>
                </div>

                <div className="inbox-detail-cards">
                  <div className="inbox-mini-card">
                    <span className="inbox-section-label">Message provenance</span>
                    <div className="inbox-data-table mono">
                      <div><span>From</span><b>{archive.from}</b></div>
                      <div><span>Department</span><b>{archive.department}</b></div>
                      <div><span>Reference</span><b>{sourceLabel}</b></div>
                    </div>
                  </div>
                  <div className="inbox-mini-card">
                    <span className="inbox-section-label">What happens next</span>
                    <p className="inbox-next-copy">Open the archive to compare the recovered records with your thesis.</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="inbox-plain-note">
                <span className="inbox-section-label">Message state</span>
                <p>This operational message is visible for context, but it does not alter the simulation evidence set.</p>
              </div>
            )}
          </div>
          <div className="inbox-detail-footer">
            <div className="inbox-attachment mono">
              {selected.attachment ? <><IconPaperclip size={14} /> {selected.attachment.filename} · {selected.attachment.records.toLocaleString("en-IN")} records</> : <span>No evidence attachment</span>}
            </div>
            <button className="pri inbox-open-button" onClick={open} disabled={busy || !canOpenArchive}>
              {busy ? "Opening…" : canOpenArchive ? "Open evidence package" : "Select archive signal"}
              <IconArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>

      <div className="inbox-status-rail mono" aria-label="Inbox status">
        <span><b>ARCHIVE</b> {archiveStatus}</span>
        <span><b>FILE</b> {archive.attachment.filename}</span>
        <span><b>RECORDS</b> {archive.attachment.records.toLocaleString("en-IN")}</span>
        <span><b>NEXT</b> EVIDENCE</span>
      </div>
    </div>
  );
}
