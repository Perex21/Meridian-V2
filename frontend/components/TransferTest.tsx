"use client";

import { useMemo, useState } from "react";
import { IconArrowRight, IconCheck } from "@/components/Icon";

interface TransferTestProps {
  onBack: () => void;
}

const SCENARIOS = [
  {
    label: "Health system",
    title: "A hospital is considering a new monitoring system.",
    body: "A small pilot on one ward showed strong early results: fewer adverse events, nurses found the system easy to use, and alerts were more accurate. The pilot included 18 patients over three weeks.",
  },
  {
    label: "City budget",
    title: "A city is choosing between two transit proposals.",
    body: "Both proposals would serve similar neighborhoods and cost roughly the same. Each has different ridership estimates, construction timelines, and impacts during construction.",
  },
  {
    label: "Hiring decision",
    title: "A company is choosing between two senior candidates.",
    body: "Both candidates have impressive interviews and relevant experience. One has stronger references, while the other has delivered similar work in a smaller, faster-moving team.",
  },
  {
    label: "Climate project",
    title: "A region is considering a flood-prevention project.",
    body: "The proposed infrastructure is expected to reduce near-term flood damage. The estimate depends on changing rainfall patterns, maintenance quality, and how quickly new neighborhoods are built.",
  },
] as const;

export default function TransferTest({ onBack }: TransferTestProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => SCENARIOS.map(() => ""));
  const complete = current >= SCENARIOS.length;
  const scenario = SCENARIOS[current];
  const answer = complete ? "" : answers[current];
  const progress = complete ? 100 : (current / SCENARIOS.length) * 100;

  const canContinue = answer.trim().length >= 3;
  const summary = useMemo(() => answers.map((text, index) => ({ ...SCENARIOS[index], answer: text.trim() })), [answers]);

  function saveAndContinue() {
    if (!canContinue) return;
    setCurrent((value) => value + 1);
  }

  async function downloadResults() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 52;
    const contentWidth = pageWidth - margin * 2;
    let y = 58;

    pdf.setFillColor(5, 8, 7);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");
    pdf.setTextColor(94, 234, 212);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(9);
    pdf.text("MERIDIAN PARTNERS  ·  TRANSFER TEST", margin, y);
    y += 26;
    pdf.setTextColor(245, 247, 246);
    pdf.setFont("times", "normal");
    pdf.setFontSize(28);
    pdf.text("Carry the habit beyond investing", margin, y);
    y += 22;
    pdf.setTextColor(180, 195, 190);
    pdf.setFontSize(11);
    pdf.text("The missing information identified across four reflection scenarios.", margin, y);
    y += 24;
    pdf.setDrawColor(40, 93, 85);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 30;

    summary.forEach((item) => {
      const answerLines = pdf.splitTextToSize(`Missing information: ${item.answer}`, contentWidth - 32);
      const blockHeight = 62 + answerLines.length * 15;
      if (y + blockHeight > pdf.internal.pageSize.getHeight() - 56) {
        pdf.addPage();
        pdf.setFillColor(5, 8, 7);
        pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");
        y = 58;
      }
      pdf.setDrawColor(40, 93, 85);
      pdf.setFillColor(11, 21, 19);
      pdf.roundedRect(margin, y, contentWidth, blockHeight, 4, 4, "FD");
      pdf.setTextColor(94, 234, 212);
      pdf.setFont("times", "normal");
      pdf.setFontSize(16);
      pdf.text(item.label, margin + 16, y + 25);
      pdf.setTextColor(245, 247, 246);
      pdf.setFontSize(11);
      pdf.text(item.title, margin + 16, y + 43, { maxWidth: contentWidth - 32 });
      pdf.setTextColor(190, 205, 200);
      pdf.setFont("courier", "normal");
      pdf.setFontSize(9);
      pdf.text(answerLines, margin + 16, y + 64);
      y += blockHeight + 14;
    });

    if (y + 70 > pdf.internal.pageSize.getHeight() - 56) { pdf.addPage(); y = 58; }
    pdf.setTextColor(94, 234, 212);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(9);
    pdf.text("WHAT YOU PRACTICED", margin, y + 18);
    pdf.setTextColor(220, 230, 226);
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    pdf.text("1. Name the missing evidence", margin, y + 40);
    pdf.text("2. Calibrate the conclusion", margin + 175, y + 40);
    pdf.text("3. State what would change your mind", margin + 350, y + 40);
    pdf.save("meridian-transfer-test-results.pdf");
  }

  if (complete) {
    return (
      <section className="transfer-test-page fade" aria-labelledby="transfer-title">
        <div className="eyebrow">Session complete</div>
        <h1 id="transfer-title" className="transfer-title">That’s everything.</h1>
        <p className="transfer-subtitle">The habit transfers when you keep asking what the evidence does not yet tell you.</p>
        <div className="transfer-summary-list">
          {summary.map((item, index) => (
            <div className="transfer-summary-row" key={item.label}>
              <span className="transfer-summary-check"><IconCheck size={14} /></span>
              <strong>{item.label}</strong>
              <span>Missing information: {item.answer}</span>
            </div>
          ))}
        </div>
        <div className="transfer-practice-panel">
          <div className="eyebrow">What you practiced</div>
          <div className="transfer-practice-items"><span>1. Name the missing evidence</span><span>2. Calibrate the conclusion</span><span>3. State what would change your mind</span></div>
        </div>
        <div className="transfer-actions"><button className="pri" type="button" onClick={downloadResults}>Download PDF</button><button type="button" onClick={onBack}>Return to scorecard</button></div>
      </section>
    );
  }

  return (
    <section className="transfer-test-page fade" aria-labelledby="transfer-title">
      <div className="eyebrow">Transfer test</div>
      <h1 id="transfer-title" className="transfer-title">Carry the habit beyond investing</h1>
      <p className="transfer-subtitle">The exercise changes context. Your job stays the same: ask what is missing.</p>

      <div className="transfer-progress-nav" aria-label="Transfer test progress">
        {SCENARIOS.map((item, index) => {
          const done = index < current;
          const active = index === current;
          return <div className={`transfer-progress-step ${active ? "active" : ""} ${done ? "done" : ""}`} key={item.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{done ? "Complete" : active ? "In progress" : "Queued"}</small></div>;
        })}
      </div>

      <div className="transfer-scenario-card">
        <div className="transfer-scenario-number">{String(current + 1).padStart(2, "0")}</div>
        <div className="transfer-scenario-content">
          <h2>{scenario.title}</h2>
          <div className="eyebrow">Situation</div>
          <p>{scenario.body}</p>
          <div className="transfer-question"><div className="eyebrow">Your task</div><p>What is the single most important piece of information that is missing?</p></div>
          <label className="transfer-answer-label" htmlFor="transfer-answer">Your response</label>
          <textarea id="transfer-answer" rows={4} value={answer} onChange={(event) => setAnswers((values) => values.map((value, index) => index === current ? event.target.value : value))} placeholder="Type your answer here…" />
        </div>
        <aside className="transfer-side-note"><div className="eyebrow">A note</div><p>The scenario is unrelated to startups.</p></aside>
      </div>

      <div className="transfer-footer"><span><IconCheck size={15} /> {current} of {SCENARIOS.length} completed</span><button className="pri" type="button" disabled={!canContinue} onClick={saveAndContinue}>{current === SCENARIOS.length - 1 ? "Finish" : "Save answer and continue"} <IconArrowRight size={14} /></button></div>
    </section>
  );
}
