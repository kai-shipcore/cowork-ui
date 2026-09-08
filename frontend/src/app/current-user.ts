/**
 * The signed-in user.
 *
 * Auth is not implemented yet — `app/auth/` holds empty placeholders — so the
 * actor is a single constant. Every place that records "who did this now"
 * (`vehicle_project_task.requested_by`, `vehicle_product_registration
 * .requested_by` / `.approved_by`, `asset.uploaded_by`, …) must read it from
 * here rather than repeat a literal, so wiring real auth is one change.
 *
 * It is deliberately NOT part of the workbench store: it is session identity,
 * not workbench data, and must never be persisted with the mock state.
 */
export const CURRENT_USER_ID = 'USR-KAI';
