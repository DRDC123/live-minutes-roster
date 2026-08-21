# Live Minutes Roster v2

A Vite + React prototype prepared for Vercel and a Teams Website tab.

## Included in v2
- Editable team list: add, rename and deactivate members.
- Editable meeting slots: override as a meeting, mark no meeting, or return to calendar control.
- Standard CPSR slots in AEDT: Tuesday 1–3 pm; Wednesday and Thursday 9 am–12 pm; Friday 1–3 pm. Each slot is one hour.
- Every standard slot remains visible, including when there is no meeting.
- Vercel serverless calendar endpoint at `api/calendar.js`.
- Five-minute calendar polling.
- Only events identified as Busy are loaded. Tentative events are ignored.

## Run
```bash
npm install
npm run dev
```

## Deploy
Upload the project to GitHub, import it into Vercel and deploy with the Vite preset.

## Important limitations
The Outlook published HTML format is not a stable documented data API. The included parser is defensive, but it must be tested against the live published page after deployment. If the page does not expose date, time and Busy state in its HTML, replace the HTML source with the published ICS feed or Microsoft Graph.

Team edits, meeting overrides and assignments currently use browser localStorage. They persist for one browser but are not shared across different users. A shared backend is required before multiple CPSR members can see the same live edits and claims.
