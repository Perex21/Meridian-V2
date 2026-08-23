"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { IconArrowRight, IconCheck } from "@/components/Icon";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

const CONTENTS = [
  ["summary", "Executive summary"],
  ["thesis", "Thesis"],
  ["model", "Scoring model"],
  ["portfolio", "Portfolio outcomes"],
  ["scorecard", "Standard scorecard"],
  ["process", "Process detail"],
  ["closing", "Closing note"],
] as const;

export default function Report() {
  const { sessionId, state, toast } = useStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setError(null);
    api
      .post<{ html: string; stored: boolean }>(`/sessions/${sessionId}/report`)
      .then((response) => {
        if (!cancelled) setHtml(response.html);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not generate the report.");
        toast("Report failed", "Could not generate the report.");
      });
    return () => { cancelled = true; };
  }, [sessionId, toast, attempt]);

  function download() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meridian-investment-report.html";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { document.body.removeChild(anchor); URL.revokeObjectURL(url); }, 0);
  }

  function downloadPdf() { iframeRef.current?.contentWindow?.print(); }

  function jumpTo(id: string) {
    iframeRef.current?.contentDocument?.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const thesisCount = state?.thesis_variables?.length;
  const evidenceCount = state?.summary?.combined_records ?? state?.summary?.total_companies;

  return (
    <div className="report-workspace">
      <div className="report-heading">
        <div><div className="eyebrow">Fund IV / Analyst file / Stage 14 of {state?.rail.length ?? 14}</div><h1 className="report-title">Investment report</h1><p className="report-subtitle">The final record of what you believed, what you did, what happened, and how you reasoned.</p></div>
        <div className="report-heading-actions"><button onClick={() => setAttempt((value) => value + 1)} disabled={!sessionId}><IconArrowRight size={13} /> Regenerate</button><button onClick={download} disabled={!html}><IconArrowRight size={13} /> Download HTML</button><button onClick={downloadPdf} disabled={!html}><IconArrowRight size={13} /> Download PDF</button>
</div>
      </div>

      <div className="report-status-strip"><div><IconCheck size={14} /><span><strong>Saved to session record</strong><small>Your facilitator can retrieve this file.</small></span></div><div><span className="eyebrow">Thesis variables</span><strong>{thesisCount ?? "—"}</strong></div><div><span className="eyebrow">Evidence universe</span><strong>{evidenceCount != null ? evidenceCount.toLocaleString("en-IN") : "—"}</strong></div><div><span className="eyebrow">Document</span><strong>{html ? "Ready" : "Generating…"}</strong></div></div>

      {error && <div className="report-error"><div className="eyebrow">Report not generated</div><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>Try again <IconArrowRight size={13} /></button></div>}

      <div className="report-viewer-layout">
        <aside className="report-contents"><div className="eyebrow">Contents</div><h2>Analyst file</h2><nav>{CONTENTS.map(([id, label], index) => <button key={id} onClick={() => jumpTo(id)} disabled={!html}><span>{String(index + 1).padStart(2, "0")}</span>{label}</button>)}</nav><div className="report-print-note"><div className="eyebrow">Printable document</div><p>The report stays on a light paper ground so it can be downloaded, emailed, and printed.</p></div></aside>
        <section className="report-document-shell"><div className="report-document-toolbar"><span>{html ? "Live preview" : "Preparing preview"}</span><span>{html ? "Printable HTML" : "Please wait"}</span></div>{html ? <iframe ref={iframeRef} title="Investment report" className="report-iframe" srcDoc={html} /> : <div className="report-loading"><div className="report-loading-mark">M</div><strong>Generating investment report…</strong><span>Assembling your final analyst file from the session record.</span></div>}</section>
      </div>
    </div>
  );
}
