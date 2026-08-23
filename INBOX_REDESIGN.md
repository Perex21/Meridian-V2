# Inbox redesign implementation

The inbox screen now uses a **Simulation Control Room** layout inspired by the approved mockup, while keeping factual content grounded in the existing backend response.

## Changed files

- `frontend/components/screens/Inbox.tsx` — added the run/status strip, message queue, selected-message detail panel, dataset summary, provenance block, recovered-record count, next-action panel, responsive layout, and simulation-oriented action labels. The existing `GET /sessions/{id}/inbox` request and `POST /sessions/{id}/archive/unlock` flow are preserved.
- `frontend/app/globals.css` — added the inbox console styles, responsive breakpoints, status indicators, record-count treatment, queue rows, and footer status rail.

## Data integrity

The inbox dynamically displays the backend values for sender, department, time, subject, body, attachment filename, record count, and archive state. For the default dataset, the attachment reports 2,000 records through `mail.attachment.records`; a different seed can produce a different value without requiring a frontend change.

The redesign deliberately does not display fabricated schema-match, completeness, anomaly, confidence, portfolio-value, exposure, tracking-error, model-time, or waveform telemetry. The surrounding queue items remain contextual flavor messages, matching the original inbox behavior, and only the archive item can advance the simulation.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000/terminal` with the backend running according to the root README.

## Verification

The updated frontend passes:

```bash
npm run typecheck
npm run build
```
