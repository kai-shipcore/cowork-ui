# Cross-team operations prototype

## Implemented

- Team-aware Home, breadcrumbs, browser titles and common navigation; R&D resources only appear in the R&D workspace.
- My Tasks: assigned, submitted and approval queues, date/status/search filters, links to original R&D workflows.
- Cross-team requests: four handoff templates, originating/receiving teams, assignee, independent reviewer, due date, priority, project/SKU references.
- Request lifecycle: submitted → active → review → done; blocked/rejected return to active; cancellation before acceptance or after rejection. Every transition requires a note.
- Review requires a document link. Reviewer cannot be the assignee. Documents cannot change while review is pending or after completion.
- Completion approves only the latest version of each document, preserving superseded versions without labelling them approved.
- The login page clearly identifies Google Workspace as unconnected, collects no credentials, and provides a separate public prototype entry.
- Comments, explicit mentions, activity notifications, versioned document links and event history.
- Team dashboards and reports read the request store; KPI links open matching filtered lists. No invented operational metrics are presented as live data.
- Project/SKU detail pages show associated cross-team requests. Search includes requests, project IDs, vehicle names, SKU and F#.
- Request persistence validates snapshots, serializes same-origin tab writes with Web Locks, checks record revisions, and retains the preceding saved snapshot. Import merges missing request IDs without overwriting existing records.
- Existing R&D persistence reports failures and refuses to overwrite a snapshot changed by another tab; export the in-memory snapshot before refreshing if a conflict occurs.

## Deliberate prototype boundaries

- All request actors are demo users; the selector is not authentication. Existing R&D actions still use USR-KAI.
- Both stores remain browser-local. Web Locks do not coordinate different users, computers, or browsers.
- Request backups cover requests/comments/document links/events only. R&D export is separate. R&D backup import is not implemented.
- Documents are URL references; this does not upload files or enforce permissions in the external document service.
- My Tasks shows existing R&D items as a separate reference list. Final approval permission remains governed by the original workflow; the new queue does not bypass it.
- Team operational tools without data integrations are labelled “준비 중”. Sales, inventory, marketplace and customer satisfaction data are not connected.
- Browser interaction/visual QA has not been performed in this task.

## Required to finish real deployment

The user selected Google login. Company email domains, OAuth client setup and the API/database destination have not been supplied. The repository has no executable backend yet. Do not equate the UI role simulation or local storage with completed production authentication/persistence.

1. Register the frontend origin and callback for a Google OAuth client; verify tokens on the server, including audience, issuer, expiration and verified hosted domain. Map Google subject IDs to active employee records.
2. Provision server sessions (Secure/HttpOnly cookies), logout/revocation, CSRF protection and employee/team/role assignments. Deny unassigned users by default.
3. Implement API endpoints for request creation, listing, revision-aware edits, comments, document versions and transitions. Derive actor identity from the server session; never trust actor IDs sent by the browser.
4. Persist requests, assignments, immutable events and document versions transactionally in the company database. Apply revision checks and idempotency keys, including workflow state and reviewer authorization in the same transaction.
5. Migrate the existing R&D records and approval rules to the API. All clients must read the same source of truth before a staff pilot.
6. Provide scheduled database backups and a tested restoration procedure, including linked file storage when uploads are added. Browser JSON exports are only a prototype aid.
7. Verify end-to-end with two employee accounts: authorization, cross-team handoff, rejection/resubmission, stale edits, session expiry, failed saves and restoration.

## Demonstration scenario

1. Open `/work/requests?team=customer-services` and choose the CS demo operator.
2. Create a quality investigation request to R&D; assign the R&D operator and Kai reviewer.
3. Switch the request demo operator to R&D, accept with a note, add evidence and request review.
4. Switch to Kai, reject with a reason or approve. A rejected request must return to active work before resubmission.
5. Return to the CS demo operator; the request and activity feed show the decision and its rationale.
6. Check dashboard counts and linked project/SKU requests, export the request snapshot and test import of missing IDs.
