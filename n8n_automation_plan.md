# Nexus Automation Roadmap — Final Revision

This maps your original 7-phase plan against what's actually built, corrects the parts that drifted from spec, and fills in Phases 5–7 in enough detail that each is a clean, self-contained build — no redesigning later.

**Ground truth used for this revision:** the Phase 1–4 code walkthrough (actual files created/modified) and the n8n setup summary (Docker, single dispatcher workflow, webhook tested). Where the original plan and the actual implementation disagree, it's called out explicitly rather than silently resolved either direction.

---

## Status at a glance

| Phase | Original goal | Real status |
|---|---|---|
| 1 — Foundation | Gateway, types, logger, retry, client | ✅ Done, matches spec |
| 2 — Event-Driven Refactor | All business actions emit events | ⚠️ Done, but 2 planned events were never implemented — see 2.1 |
| 3 — n8n Infrastructure | Deploy n8n, generic webhook, Switch routing | ⚠️ Half done — webhook exists and is tested, **Switch/router does not exist yet** |
| 4 — Core Business Automations | 4 working production workflows | ⚠️ Half done — all 4 Next.js endpoints + email templates exist, **none of them are wired to n8n yet** |
| 5 — Monitoring | `automation_logs` + dashboard | ❌ Not started |
| 6 — Approval Workflow | Attendance correction example | ❌ Not started |
| 7 — Extensibility | Pattern for future automations | ❌ Not formalized — this revision turns it into a concrete checklist |

The honest read: **Phases 1–2 are genuinely complete. Phases 3–4 are complete on the Nexus side and incomplete on the n8n side** — the router and the Cron workflows still need to be built before you can call either phase done. Everything below is written so finishing that n8n-side gap is Step 1, and Phases 5–7 build cleanly on top of it.

---

## Phase 2 correction — event list gap

Your original plan specified `attendance.updated` and `task.completed` as events. The actual implementation only emits: `user.created`, `user.deleted`, `user.invited`, `organization.created`, `task.created`, `task.assigned`, `task.deleted`, `attendance.clocked_in`, `attendance.clocked_out`, `report.generated` — **10 events, missing those 2.**

Before moving on, decide one of:
- **(a)** These were intentionally deferred (no current feature needs "task marked complete" or "attendance record edited" as a trigger) — fine, just note it so it's not mistaken for an oversight later.
- **(b)** They're needed now — add them the same way the other 10 were added: register in `types.ts`/`registry.ts`, emit from the relevant route/component (likely `KanbanBoard.tsx` for `task.completed`, and wherever attendance records get edited for `attendance.updated`).

Don't let this block Phase 3/4 completion below — it's independent. Just make a decision and log it.

---

## Phase 3 (finish) — Build the actual router

The webhook and n8n deployment exist; the Switch node described in your own Phase 3 spec ("n8n decides what workflow to execute" instead of "20 webhook URLs") does not exist yet. This is the first real build item.

### 3.1 Router structure
```
Webhook (POST /webhook/events)
  ↓
Switch — value: {{$json.body.event}}
  ├─ user.created           → (Phase 4) welcome-email
  ├─ task.assigned          → (Phase 4) task-assignment
  ├─ user.deleted           → Respond 200, no automation yet
  ├─ user.invited           → Respond 200, no automation yet
  ├─ organization.created   → Respond 200, no automation yet
  ├─ task.created            → Respond 200, no automation yet
  ├─ task.deleted            → Respond 200, no automation yet
  ├─ attendance.clocked_in  → Respond 200, no automation yet
  ├─ attendance.clocked_out → Respond 200, no automation yet
  ├─ report.generated       → Respond 200, no automation yet
  └─ default/fallback       → Respond 200, log unrecognized event
```
Rename the workflow from "Nexus Event Dispatcher" to **"Nexus — Master Router"**. Keep the old logging-only version disabled as a rollback reference rather than deleting it.

### 3.2 Payload forwarding rule (applies to every branch you build from here on)
Forward the **full envelope**, not just `payload`:
```
Body: {{$json.body}}
```
The envelope's `id`, `timestamp`, and `actorId` cost nothing to pass through now and become free idempotency + audit data for Phase 5 — retrofitting this later means touching every branch twice.

### 3.3 Test checklist
- [ ] Send all 10 (or 12, per your Phase 2 decision) event types, confirm each hits its correct branch in n8n's execution log.
- [ ] Send an unregistered event name → confirm fallback branch, still 200.
- [ ] Confirm zero Gateway retries during normal-path testing.

**Phase 3 is done once this checklist passes.**

---

## Phase 4 (finish) — Wire the 4 endpoints + build the 2 Cron workflows

Nothing here requires new Next.js code — every endpoint already exists. This is n8n configuration and end-to-end testing only.

### 4.1 Auth — confirm before wiring anything
The internal route (`/api/internal/automation`) uses header `X-Automation-Key` with `N8N_API_KEY`. **Verify the four `workflows/*` route files use the same header/key** before assuming it — if even one uses a different scheme, your HTTP Request nodes will silently 401 and you'll debug it as an n8n problem when it's actually a mismatch.

### 4.2 Event-triggered: `user.created` → Welcome Email
```
Switch [user.created] → HTTP Request (POST .../workflows/welcome-email, X-Automation-Key header, body = {{$json.body}}) → Respond 200
```
- [ ] `curl` the endpoint directly first, confirm it sends independent of n8n.
- [ ] Wrong/missing key → `401`, no email.
- [ ] Real registration end to end → email arrives.
- [ ] Stop the n8n container → confirm registration still completes (Gateway degrades gracefully).

### 4.3 Event-triggered: `task.assigned` → Task Assignment Email
Same shape, pointed at `workflows/task-assignment`.
- **Known detail:** `TaskModal.tsx` emits `task.assigned` once per assignee, not once per task. Confirm the endpoint expects a single-assignee payload per call.
- [ ] `curl` directly, confirm email sends.
- [ ] Assign to 1 user → 1 email. Assign to 3 users → 3 separate emails, not 1 malformed or 3 duplicates to the same person.

### 4.4 Cron-triggered: Attendance Reminder
Per your original spec: **every weekday, 8:15 AM**.
```
Cron (weekdays, 8:15 AM) → HTTP Request (POST .../workflows/attendance-reminder, X-Automation-Key) → log
```
Before building the schedule, confirm (check the route file, don't guess):
- [ ] Does the endpoint already query "who hasn't clocked in," or does it expect a list of user IDs in the request body?
- [ ] Is "8:15 AM" per-organization local time, or one fixed time for all orgs? If Nexus supports multiple timezones, this needs to be resolved before the Cron node is built, not after.

### 4.5 Cron-triggered: Weekly Supervisor Summary
Per spec: **every Friday**. Your original plan describes a richer payload than a simple trigger — Attendance Summary + Pending Tasks + Hours Rendered + generated HTML — confirm the existing `weekly-summary` endpoint actually assembles all four pieces, not just a placeholder subset.
```
Cron (Friday, time TBD) → HTTP Request (POST .../workflows/weekly-summary, X-Automation-Key) → log
```

### 4.6 Test checklist (both Cron workflows)
- [ ] Manually trigger in n8n (don't wait for real Cron) → correct output.
- [ ] Zero-results edge case (everyone clocked in / nothing to summarize) → no email, no error.
- [ ] Run against real data, not fixtures.

**Phase 4 is done once 4.2–4.6 all pass.** At this point your original plan's "4 production workflows" deliverable is actually true, not just true on the Nexus side.

### 4.7 Router cleanup (optional, do once 4.2–4.6 are stable)
Refactor the flat Switch into grouped sub-workflows via **Execute Workflow** nodes (Users / Organizations / Kanban / Attendance / Reports), so the canvas stays readable as Phase 6/7 add more branches. Re-run 3.3 and 4.2–4.6 checklists after, to confirm the refactor didn't break anything.

---

## Phase 5 — Monitoring

### 5.1 Schema (Supabase)
```sql
create table automation_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,               -- envelope's `id`, forwarded since Phase 3.2 — enables dedupe
  event_type text not null,
  workflow_name text,          -- e.g. "Welcome Email" — matches your original table sketch
  organization_id uuid references organizations(id),
  actor_id uuid,
  status text not null check (status in ('success', 'failed', 'retried')),
  attempt_count int not null default 1,
  duration_ms int,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
create index on automation_logs (organization_id, created_at desc);
create index on automation_logs (event_type, status);
create unique index on automation_logs (event_id) where event_id is not null;
```
The reason Phase 3.2 (forward the full envelope) mattered: without `event_id` flowing through since the router was built, you'd have to retrofit every branch to add it now. Because you did it upfront, this table just works against existing traffic once it's turned on.

### 5.2 Where logs get written
Write from `client.ts` (the Gateway), not from n8n or the individual workflow endpoints — it's the one place every dispatch attempt (including retries) already passes through.

### 5.3 Dashboard
- Table view: event, workflow, org, status, timestamp, attempt count — filterable, matching your original sketch.
- Detail drawer: request/response payload + error, duration, retries.
- RLS: admins/supervisors see only their own `organization_id` — test with two real accounts given the RLS debugging history on this project, not just a policy review.
- Reuse existing Nexus table components / dark theme tokens — no new design system work.

### 5.4 Test checklist
- [ ] Trigger success, failure, retry manually → all three log correctly.
- [ ] Cross-org RLS test with two real accounts.
- [ ] Seed a few hundred rows, confirm dashboard pagination/performance is acceptable.
- [ ] Confirm `/api/internal/automation` (already built) can double as the health-check endpoint an uptime monitor or n8n itself pings — no need to build a second one.

---

## Phase 6 — Approval Workflow (Attendance Correction)

Unlike Phase 4, this phase needs **new** endpoints and a new event — nothing to reuse here. Design it once, and it becomes the template for Leave Requests / Overtime / Document Approval / Internship Extension later, per your original plan.

### 6.1 New event
```ts
// event: "attendance.correction.requested"
{
  event: "attendance.correction.requested",
  payload: {
    correctionId: string,
    userId: string,
    organizationId: string,
    date: string,
    requestedClockIn: string | null,
    requestedClockOut: string | null,
    reason: string,
    supervisorId: string
  }
}
```
Register it the same way as the existing 10 (types.ts → registry.ts → emit from the correction-request UI/route).

### 6.2 Flow
```
Student submits correction request
  ↓
Nexus: save request as "pending" in DB
  ↓
emitEvent("attendance.correction.requested")
  ↓
Router → Switch [attendance.correction.requested]
  ↓
HTTP Request → NEW endpoint: /api/automation/workflows/attendance-correction-request
  → sends supervisor an email with Approve / Reject links
    (each link = a signed, single-use token, not a raw correctionId —
     don't let a guessable URL let anyone approve anything)
  ↓
Supervisor clicks a link
  ↓
NEW endpoint: /api/automation/approvals/attendance-correction/[token]
  → validates token (unused, unexpired, matches supervisorId)
  → updates the attendance record + marks request "approved"/"rejected"
  → emits a new event: "attendance.correction.resolved"
  ↓
Router → Switch [attendance.correction.resolved]
  ↓
HTTP Request → NEW endpoint: /api/automation/workflows/attendance-correction-resolved
  → emails the student the outcome
```

### 6.3 What to build (new, unlike Phase 4)
- [ ] `attendance_corrections` table (or similar) with a `status` column (`pending`/`approved`/`rejected`) and a token column for the approval link, with an expiry.
- [ ] The two new workflow endpoints above.
- [ ] The token-validated approval endpoint — this is the one piece of real security surface in this phase; treat it with the same care as the audit you did on the Kamp Lambingan booking system (single-use, expiring, scoped to the correct supervisor).
- [ ] Two new email templates: correction-request-to-supervisor, correction-outcome-to-student.
- [ ] Two new Switch branches on the existing router.

### 6.4 Test checklist
- [ ] Submit a correction → supervisor receives email with working links.
- [ ] Approve link → attendance record updates, student notified, token can't be reused.
- [ ] Reject link → record stays unchanged, student notified of rejection, token can't be reused.
- [ ] Expired token → clear error, no state change.
- [ ] A different supervisor's token can't approve someone else's request (authorization, not just token validity).

---

## Phase 7 — Extensibility (playbook, not a build)

Your original plan's Phase 7 goal was that future automations require "add event → create workflow → done." After Phases 1–6, that's structurally true. This section makes it a literal checklist so it stays true as new people/agents touch the codebase.

### 7.1 Adding a new event end-to-end
1. Add the event name + payload type to `src/lib/automation/types.ts`.
2. Register it in `src/lib/automation/registry.ts`.
3. Call `emitEvent()` (or `emitClientEvent` if client-side) from the relevant route/component.
4. Add a Switch branch in the n8n router (or a new Cron workflow, if time-triggered rather than event-triggered).
5. If it needs to notify someone: build the workflow endpoint + email template following the exact shape of `welcome-email`.
6. Add the branch to the grouped sub-workflow it belongs to (7.2 below), not a loose branch on the master Switch.
7. Test in isolation (curl the endpoint) before wiring n8n to it — same order every time.

No step here touches the Gateway, retry logic, or logger — that's the point of Phase 1.

### 7.2 Keep the router grouped, not flat
As new events accumulate, add them into the existing Execute-Workflow groups from 4.7 (Users / Organizations / Kanban / Attendance / Reports) or a new group if the domain is genuinely new (e.g. "Approvals" for Phase 6, "Integrations" for 7.3 below).

### 7.3 Candidate future integrations (from your original list)
Google Calendar, Discord, Slack, Telegram, Microsoft Teams, Google Sheets, HRIS, Airtable, Notion, CRM — each of these is a new HTTP Request node (or n8n's native node for that service) added to an existing or new Switch branch, calling out from n8n directly rather than always routing back through a Nexus endpoint first. Only route back through Nexus if the integration needs to read/write Nexus's own database — otherwise n8n can talk to Slack/Discord/etc. directly, which is simpler and doesn't need a new Next.js endpoint at all.

---

## Final architecture (confirmed, matches your original diagram)
```
Users → Next.js (nexxus.lol) → Business Logic → Domain Events
      → Automation Gateway (auth, retry, logs)
      → n8n Master Router
            ├─ Email (Resend)
            ├─ Scheduled Jobs (Cron)
            └─ Notifications (Discord/Slack, once Phase 7.3 lands)
      → automation_logs → Nexus Admin Dashboard
```

## Notes for the agent
- Don't rebuild anything already marked ✅ in the status table — verify it, don't recreate it.
- Phase 3/4 completion is n8n wiring only, no new Next.js code — if you find yourself writing new endpoint logic there, stop and check whether it already exists.
- Phase 6 is the one phase with real new security surface (approval tokens) — treat it with the same rigor as a security audit, not as "just another email workflow."
- Log the Phase 2 event-gap decision (2.1) somewhere durable — it's easy to forget and rediscover as a bug later.
- Flag anything that doesn't match the "Status at a glance" table back to John rather than assuming either the plan or the code is right.

---

## Appendix — Importable n8n Workflow JSON (Phase 3/4 Router)

This is a starting point, not a finished import-and-forget file. It builds the router exactly as specified in Phase 3.1–3.2 and wires the two event-triggered branches from 4.2–4.3 (`user.created`, `task.assigned`). The 8 unwired branches ack with 200 and do nothing, matching the "no automation yet" state — extend them as those automations get built. The two Cron workflows from 4.4–4.5 aren't included here since they're separate standalone workflows, not part of this router.

**Assumptions the agent must verify/adjust before importing:**
- Assumes a new n8n environment variable `NEXUS_APP_URL` (e.g. `http://localhost:3000` in dev, `https://nexxus.lol` in production) — add this in n8n's environment settings; it's separate from `N8N_URL`, which is the address Nexus uses to reach n8n, not the other way around.
- Assumes `N8N_API_KEY` is already set as an n8n environment variable and matches what the Next.js `workflows/*` routes expect in the `X-Automation-Key` header (confirmed as an open item in Phase 4.1 — check this before relying on it here).
- Node `typeVersion` values below match a recent n8n release; if the target instance is on an older version, n8n will flag a version mismatch on import and it may need bumping down — that's a one-click fix in the editor, not a rebuild.
- `path: "events"` on the Webhook node assumes the URL stays `/webhook/events` as already tested — don't change this without updating `N8N_URL`/the Gateway config to match.

```json
{
  "name": "Nexus — Master Router",
  "nodes": [
    {
      "id": "a1a1a100-0000-4000-8000-000000000001",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 480],
      "webhookId": "nexus-events-webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "events",
        "responseMode": "responseNode",
        "options": {}
      }
    },
    {
      "id": "a1a1a100-0000-4000-8000-000000000002",
      "name": "Switch - Event Router",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [480, 480],
      "parameters": {
        "mode": "rules",
        "rules": {
          "values": [
            {
              "outputKey": "user.created",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000001",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "user.created",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "task.assigned",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000002",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "task.assigned",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "user.deleted",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000003",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "user.deleted",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "user.invited",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000004",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "user.invited",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "organization.created",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000005",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "organization.created",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "task.created",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000006",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "task.created",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "task.deleted",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000007",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "task.deleted",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "attendance.clocked_in",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000008",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "attendance.clocked_in",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "attendance.clocked_out",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000009",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "attendance.clocked_out",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            },
            {
              "outputKey": "report.generated",
              "renameOutput": true,
              "conditions": {
                "combinator": "and",
                "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2 },
                "conditions": [
                  {
                    "id": "b1b1b100-0000-4000-8000-000000000010",
                    "leftValue": "={{ $json.body.event }}",
                    "rightValue": "report.generated",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              }
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      }
    },
    {
      "id": "a1a1a100-0000-4000-8000-000000000003",
      "name": "Welcome Email",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [760, 120],
      "parameters": {
        "method": "POST",
        "url": "={{ $env.NEXUS_APP_URL }}/api/automation/workflows/welcome-email",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" },
            { "name": "X-Automation-Key", "value": "={{ $env.N8N_API_KEY }}" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.body }}",
        "options": {}
      }
    },
    {
      "id": "a1a1a100-0000-4000-8000-000000000004",
      "name": "Task Assignment Email",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [760, 280],
      "parameters": {
        "method": "POST",
        "url": "={{ $env.NEXUS_APP_URL }}/api/automation/workflows/task-assignment",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" },
            { "name": "X-Automation-Key", "value": "={{ $env.N8N_API_KEY }}" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.body }}",
        "options": {}
      }
    },
    {
      "id": "a1a1a100-0000-4000-8000-000000000005",
      "name": "Log Unrecognized Event",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [760, 760],
      "parameters": {
        "jsCode": "console.log('[Nexus Router] Unrecognized event:', $json.body && $json.body.event);\nreturn $input.all();"
      }
    },
    {
      "id": "a1a1a100-0000-4000-8000-000000000006",
      "name": "Respond 200",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "position": [1180, 480],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"received\": true } }}",
        "options": { "responseCode": 200 }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [{ "node": "Switch - Event Router", "type": "main", "index": 0 }]
      ]
    },
    "Switch - Event Router": {
      "main": [
        [{ "node": "Welcome Email", "type": "main", "index": 0 }],
        [{ "node": "Task Assignment Email", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Respond 200", "type": "main", "index": 0 }],
        [{ "node": "Log Unrecognized Event", "type": "main", "index": 0 }]
      ]
    },
    "Welcome Email": {
      "main": [
        [{ "node": "Respond 200", "type": "main", "index": 0 }]
      ]
    },
    "Task Assignment Email": {
      "main": [
        [{ "node": "Respond 200", "type": "main", "index": 0 }]
      ]
    },
    "Log Unrecognized Event": {
      "main": [
        [{ "node": "Respond 200", "type": "main", "index": 0 }]
      ]
    }
  },
  "active": false,
  "settings": {
    "executionOrder": "v1"
  },
  "pinData": {}
}
```

**To import:** n8n editor → Workflows → **Import from File** (or paste via **Import from URL/Clipboard**) → select this JSON. After import: open the Switch node and confirm the 10 output labels match the order in Phase 3.1, open the two HTTP Request nodes and confirm `NEXUS_APP_URL` resolves correctly in that environment, then run the Phase 3.3 and 4.2–4.3 test checklists against it before publishing over the existing dispatcher.