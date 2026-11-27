# BEN AI Autonomous B2B Workforce

Free-first, semi-automatic workforce control plane for the BEN AI B2B waste-management CRM.

## Safety defaults
- Outbound email, WhatsApp, campaign publishing: disabled.
- Contract signing, payments, order placement, price commitments and waste dispatch: blocked pending human approval.
- Approval records are authorization records only; this bridge does not execute external actions.
- No secrets are stored in Google Sheets.

## Components
- Google Sheets: CRM and workforce records.
- Google Apps Script: JSON bridge, task queue, approvals, audit log and 15-minute internal worker.
- ChatGPT / connected plugins: human-supervised research, drafting and analysis. This Apps Script does not autonomously call an LLM.

## Deploy
1. Open the existing Apps Script project attached to the BEN AI Bridge deployment.
2. Set Script Property `BEN_AI_API_KEY` to a long random secret (never put it in Sheets or GitHub).
3. Add `Code.gs` and `appsscript.json` from this repository branch.
4. Run `setupWorkforce()` once and authorize Spreadsheet access.
5. Run `dryRunSelfTest()`; expected result: `passed: true`, `externalSideEffects: 0`.
6. Run `createDailyTriggers()` to install the 15-minute internal queue trigger.
7. Deploy a new Web App version, execute as the project owner, and restrict access according to your account policy.
8. Test `?action=health` (public health only), then authenticated POST actions.

## API
POST JSON:
- `{"action":"dashboard_summary","key":"..."}`
- `{"action":"create_task","key":"...","taskType":"CRM_DATA_QUALITY","department":"CRM","assigneeId":"CRM-001","payload":{}}`
- `{"action":"create_approval","key":"...","actionType":"SEND_WHATSAPP","summary":"Review draft","payload":{}}`
- `{"action":"self_test","key":"..."}`

GET is public health only. All authenticated reads (list tasks, list approvals, dashboard summary) use POST JSON so the API key is not exposed in URL logs.

## Important limits
This is the control plane, not a fully autonomous LLM. The 15-minute trigger only processes deterministic internal task types (health check, dashboard refresh, CRM data quality). AI research and drafting must be invoked by a connected model/worker. Continuous 24/7 availability depends on Google Apps Script quotas and account limits; no free service can promise unlimited uptime.
