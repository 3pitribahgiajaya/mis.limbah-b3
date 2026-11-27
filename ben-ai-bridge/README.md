# BEN AI Bridge (scaffold)

This directory contains the deployment scaffold for the BEN AI bridge between Cloudflare Workers and Google Apps Script.

## Security notice

The parent repository is **public**. Never commit:
- `MCP_BEARER_TOKEN`
- `BEN_MCP_TOKEN` / `BEN_MCP_SHARED_SECRET`
- Google Apps Script deployment URLs if they are treated as private
- OAuth tokens, service-account keys, passwords, or customer data

Secrets must be configured in Cloudflare Worker **Settings → Variables and Secrets** and Apps Script **Project Settings → Script Properties**. Do not put secrets in source files or GitHub Actions logs.

## Required secret mapping

| Location | Name | Purpose |
|---|---|---|
| Cloudflare Worker secret | `MCP_BEARER_TOKEN` | Authenticates MCP clients to the Worker |
| Cloudflare Worker secret | `BEN_MCP_TOKEN` | Shared secret used by Worker when calling Apps Script |
| Apps Script Script Property | `BEN_MCP_SHARED_SECRET` | Must exactly match Cloudflare `BEN_MCP_TOKEN` |
| Cloudflare Worker variable/secret | `GAS_WEB_APP_URL` | Apps Script Web App endpoint |

The two tokens are intentionally different. Do not use `MCP_BEARER_TOKEN` as the Apps Script shared secret.

## Current integration contract

The existing Apps Script backend supplied for this project exposes:
- `apiPing()`
- `apiLoadDatabase()`
- `apiSaveDatabase(json, expectedVersion)`

It also uses `doGet()` for the HTML application and user allow-list. Before adding an MCP `doPost(e)`, inspect the entire Apps Script project: Apps Script permits only one `doPost` function per project. The bridge must preserve the current `doGet`, allow-list, and database version checks.

## Deployment status

This is a source-control scaffold only. It does not claim that the Worker, Apps Script deployment, or MCP connection is live. Deployment must be performed and verified in the user's Cloudflare and Google accounts.

## Next steps

1. Add the reviewed Worker source as `worker.js` after checking the currently deployed source.
2. Add the Apps Script bridge in the existing Apps Script project, preserving its current entry points.
3. Configure secrets out-of-band (never commit them).
4. Deploy Worker and Apps Script.
5. Verify in order: authenticated `initialize`, `tools/list`, `ben_ping`, `ben_get_database`, then a controlled test write/read-back.
6. Do not run `ben_save_database` against production data until a backup and version-conflict test are complete.
