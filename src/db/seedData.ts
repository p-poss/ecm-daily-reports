/**
 * Local Dexie seeding is now a no-op. Every master table comes from
 * Airtable via `syncMasterTables()`:
 * - Jobs, Employees, Cost Codes, Equipment, Subcontractors
 *
 * This file is kept as a hook in case we ever need to seed local-only
 * tables (e.g. for first-launch dev experience without network).
 */
export async function seedDatabase() {
  // Nothing to seed locally — Airtable owns all master data.
}
