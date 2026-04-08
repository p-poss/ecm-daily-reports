import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedDatabase } from './db/seedData'

// Master tables (Jobs, Employees, Equipment, Subcontractors, Cost Codes)
// are pulled from Airtable by SyncContext on mount and on every 'online'
// event. seedDatabase is now a no-op kept as a hook for any future
// local-only seeding needs.
seedDatabase().catch(console.error)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
