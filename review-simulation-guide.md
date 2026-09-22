# Coverland Workbench Team Workflow Simulation

Reference: the review interface as of September 9, 2026. Use this guide to review business rules alongside the prototype. Some archived UI limitations may have changed; verify the current screen instead of assuming a sample state is valid.

## 1. Prepare the review

- Site: https://coverland-workbench.coverland-9381.chatgpt.site
- One facilitator shares and operates the screen. Other participants record outcomes and improvements.
- Data is stored in this browser. Changes do not automatically sync between people, browsers, localhost, or the published site.
- Use test vehicles and projects, not existing business records. Label test records `REVIEW-date-owner`. Do not reset all data.
- Record the project ID, zone, product, stage, and revision first. Example IDs PG-00118/124/125 may be in different states in different browsers.
- Prepare accessible review-only documents. Checking a handoff item does not inspect file contents or send files to a factory.
- Roles: Coordinator, Pattern Designer, Scan/Fitting reviewer, PM/Director approver, and note-taker. One participant may cover multiple roles.

## 2. Align terminology and completion criteria

| Term                      | Meaning                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Project / Zone            | Vehicle/product development and its working area. Check front and rear zones separately. |
| Part                      | A product component or pattern item.                                                     |
| Revision                  | A revised version of the same design.                                                    |
| Sample Request / Shipment | A manufacturing request / An actual shipment record.                                     |
| Visit                     | An actual vehicle scan or fitting visit.                                                 |
| Shape                     | The official Size Number; the interface uses Shape consistently.                         |
| F#                        | A vehicle configuration identifier, separate from Shape.                                 |
| Blueprint                 | A drawing showing the complete pattern composition.                                      |

Development flow: Research → Vehicle sourcing → Scan → Parts/pattern → Sample → Fitting → Handoff → Development complete.

Follow-up flow: Select the project → Review and approve → Issue/link Shape → Register parts composition and blueprint.

Tabs are not stage-completion actions. Visits is used for both scanning and fitting; Revision Control is revisited whenever changes are required. Confirm current gate requirements if guidance and validation disagree.

## 3. Scenario A — Normal new development

Allow 30–45 minutes. Review whether the intended development-to-handoff flow is supported, including whether Shape issuance is a prerequisite in the current implementation.

| Step | Action                                                                         | Expected result                                                                                               |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1    | Find the vehicle, model years, options, product, and zone in Vehicle Research. | Different configurations are not confused.                                                                    |
| 2    | Open its project in Vehicle Projects and inspect Overview and Next Action.     | Correct project ID and zone.                                                                                  |
| 3    | Check sourcing in Hunt Board when needed.                                      | Vehicle availability and completed scanning are distinct.                                                     |
| 4    | Schedule a SCAN visit with vehicle, zones, location, date/time, and staff.     | A SCAN visit appears under upcoming visits.                                                                   |
| 5    | Record actual work and complete the visit; follow stage guidance.              | The completed visit remains in history and enables subsequent work.                                           |
| 6    | Prepare parts/patterns and revisions. Check the shared Part Library first.     | An empty composition does not pass quality gates.                                                             |
| 7    | Create a sample request and check factory, parts, and revisions.               | The request references the intended revisions.                                                                |
| 8    | Send Request → Create Shipment → Mark Arrived as each actually occurs.         | Request, shipment, and receipt statuses remain distinct.                                                      |
| 9    | Verify and approve the received current revision as required.                  | Arrival alone does not count as quality approval.                                                             |
| 10   | Complete Sample after meeting every current-revision condition.                | Missing requirements block progression with guidance.                                                         |
| 11   | Schedule FITTING and record actual results; use PASS only if justified.        | Vehicle, zone, and result are recorded.                                                                       |
| 12   | Open the handoff checklist and enter all materials and confirmations.          | Missing requirements block completion and explain why.                                                        |
| 13   | Complete handoff and export the report.                                        | Completion and report details match the project record. Record any conflict with the intended Shape sequence. |

Required handoff materials: final parts list; blueprint with dimensions/Self marks removed; fitting photos/videos; product photos; manual; design files. Record locations and actual verification. Confirm vehicle, options, zone, project number, approver, delivery, and approval. Never invent a Shape number to bypass a gate.

## 4. Scenario B — Rework after a sample does not fit

Start with a project that has received samples. Allow 15–20 minutes.

1. Record project ID, zone, existing revision, and received sample.
2. Identify affected areas and changes from inspection or fitting.
3. Add the part change request in Revision Control. Verify old and new revisions remain distinct.
4. Create a new sample request for the new revision. Do not reuse old requests as evidence.
5. Record dispatch, shipment, and actual receipt.
6. Verify and approve the new revision, then repeat fitting.
7. Update final materials and complete handoff again when eligible.

Expected: Approval of the previous revision does not satisfy the new Sample gate. Earlier requests, changes, and fitting history remain. Check whether changed materials invalidate previous handoff verification.

## 5. Scenario C — Shape review, issuance, and composition

Start with a development project that has the required fitting, quality, and handoff evidence. Allow 15–20 minutes.

| Step | Action                                                                                                            | Expected result                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1    | Select the project and zone in the Shape review queue.                                                            | Original project evidence is linked.                                                |
| 2    | Enter the meeting date and attendees: PM/Director, Pattern Designer, Scan Team, Coordinator, and Manual Designer. | Meeting chronology and participants are verifiable.                                 |
| 3    | Compare fitting results, blueprint, and final parts list.                                                         | Documents correspond to current revisions.                                          |
| 4    | Record the lead's actual verbal approval.                                                                         | An approval record is retained. Real permission enforcement is reviewed separately. |
| 5    | Issue/link the Shape after approval. Reuse only when product and composition are compatible.                      | Issuance eligibility is enforced and the project is linked.                         |
| 6    | Open composition, import approved part names/revisions/quantities, and add the complete blueprint link.           | Official identifier and actual composition connect.                                 |
| 7    | Complete composition.                                                                                             | Issuance and composition completion are distinguishable.                            |

## 6. Scenario D — Rejection during Shape review

Use separate test projects for comparison.

**Document corrections:** Record the reason → Update documents → Recheck → Approve. Development completion and original project links should be preserved. Check that unchanged patterns do not unnecessarily require new samples.

**Pattern rework:** Select affected parts and explain rejection → Resume work in the original project → New revision → New sample request → Ship/receive/verify → Refit → Repeat handoff → Review Shape again. Preserve project ID, evidence, and rejection history. Treat any bypass caused by old approvals as a defect.

## 7. Scenario E — Missing information and invalid sequences

Try each case once with test data and record the exact message.

- Attempt Sample completion before receipt or approval. Are missing requirements clear?
- Check a sample gate with no parts. An empty list must not count as fully approved.
- Clear one handoff confirmation. Does it block completion? Do changed materials invalidate old confirmations?
- Attempt Shape issuance before review approval. Is the reason for blocking clear?
- Omit parts or blueprint after issuance. Is composition completion blocked?
- Switch zones. Are visits, parts, and approvals kept separate? Do bundle gates check every required zone?
- Navigate back and refresh. Do saved records persist in the same browser?
- Return Home. Do resolved alerts and pending items reflect the current state?

## 8. Scenario F — Product registration and reference data

1. Check the fitment configuration and F# in Unique Vehicles. Distinguish F# from Shape.
2. Open a test registration in Product Registrations and review products, SKUs, fitment, and approval flow.
3. Check the approved product in Catalog. Shape approval and product registration approval are separate.
4. Search existing Vehicle Options and Reference Data before adding test values. Verify consistency in consumers such as Part Management.
5. Read each page's help and compare it with actual buttons and outcomes.

This browser simulation does not prove external delivery, file-content verification, real-user permissions, concurrent server editing, or shared storage. Record placeholder links as unimplemented, not as working features.

## 9. Review record

| Field                                     | Notes                                                |
| ----------------------------------------- | ---------------------------------------------------- |
| Date / Reviewer / Browser                 |                                                      |
| Scenario / Step                           |                                                      |
| Screen URL / Project ID / Zone / Revision |                                                      |
| Action and input                          |                                                      |
| Expected result                           |                                                      |
| Actual result / Message                   |                                                      |
| Outcome                                   | Pass / Needs improvement / Blocked                   |
| Screenshot or evidence link               |                                                      |
| Category                                  | Business rule / Usability / Data integration / Error |
| Fix owner / Retest result                 |                                                      |

At the end, confirm coverage of normal development, rework, Shape document corrections, and pattern rejection. Separate unclear guidance from incorrect gate calculations when prioritizing fixes.
