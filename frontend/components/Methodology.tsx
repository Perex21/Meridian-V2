"use client";

import { IconArrowRight, IconCheck, IconLock } from "@/components/Icon";

interface MethodologyProps { onClose: () => void }

const steps = [
  ["01", "Research", "Find what the record supports"],
  ["02", "Thesis", "State what you believe and how strongly"],
  ["03", "Model", "Turn the thesis into explicit weights"],
  ["04", "Reflection", "Compare belief with outcome"],
] as const;

const principles = [
  ["Evidence first", "Ideas begin with what the record actually shows."],
  ["Process over luck", "A repeatable process creates better decisions."],
  ["Revision is the test", "Learning happens when we update in light of outcomes."],
] as const;

export default function Methodology({ onClose }: MethodologyProps) {
  return (
    <section className="methodology-page fade" aria-labelledby="methodology-title">
      <div className="methodology-heading-row">
        <div>
          <div className="eyebrow">Methodology and validation</div>
          <h1 id="methodology-title" className="methodology-title">The exercise is designed as a sequence</h1>
          <p className="methodology-intro">Each stage asks you to make your reasoning visible before the next piece of evidence arrives.</p>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="methodology-timeline" aria-label="Methodology stages">
        {steps.map(([number, title, description], index) => (
          <div className="methodology-step" key={title}>
            <div className="methodology-step-number">{number}</div>
            <div className="methodology-step-copy"><h2>{title}</h2><p>{description}</p></div>
            {index < steps.length - 1 && <span className="methodology-connector" aria-hidden="true" />}
          </div>
        ))}
      </div>

      <div className="methodology-principles">
        {principles.map(([title, description], index) => (
          <article className="methodology-principle" key={title}>
            <span className="methodology-principle-icon" aria-hidden="true">{index === 0 ? <IconCheck size={17} /> : index === 1 ? <IconArrowRight size={17} /> : <IconLock size={17} />}</span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </article>
        ))}
      </div>

      <div className="methodology-bottom-note">
        <span><span className="methodology-info-mark" aria-hidden="true">i</span> Some dimensions are intentionally not scored.</span>
        <button className="pri" type="button" onClick={onClose}>Return to terminal <IconArrowRight size={14} /></button>
      </div>
    </section>
  );
}
