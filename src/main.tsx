import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedDatabase } from './db/seedData'
import { syncMasterTables } from './lib/airtable-sync'

// Seed local fallback data (employees, equipment, subcontractors) on first
// install, then pull master tables (jobs, cost codes) from Airtable. The
// sync is fire-and-forget — Dexie's reactive hooks will pick up the new
// rows once they land, so the UI doesn't need to await it.
seedDatabase()
  .catch(console.error)
  .then(() => syncMasterTables())
  .then((result) => {
    if (result) {
      console.log(
        `[airtable-sync] jobs +${result.jobs.upserted}, employees +${result.employees.upserted}, cost codes +${result.costCodes.upserted}, ${result.durationMs}ms`
      )
    }
  })
  .catch((err) => console.error('[airtable-sync] failed:', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
