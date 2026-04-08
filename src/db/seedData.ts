import { db, generateId } from './database';
import type { Equipment, Subcontractor } from '@/types';

/**
 * Seeds local Dexie with dev fallback data for the master tables that
 * Airtable doesn't currently own (equipment, subcontractors).
 *
 * Jobs, employees, and cost codes come from Airtable via `syncMasterTables()`
 * and are NOT seeded here.
 */
export async function seedDatabase() {
  // Check if data already exists
  const existingEquipment = await db.equipment.count();
  if (existingEquipment > 0) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding database with dev fallback data...');

  // Equipment
  const equipment: Equipment[] = [
    { id: generateId(), equipmentNumber: '129', description: 'Caterpillar D8T Dozer', type: 'D8T' },
    { id: generateId(), equipmentNumber: '672', description: 'Komatsu Mini Excavator', type: 'Mini Ex' },
    { id: generateId(), equipmentNumber: '301', description: 'John Deere 744 Loader', type: 'Loader' },
    { id: generateId(), equipmentNumber: '445', description: 'Caterpillar Motor Grader', type: 'Grader' },
    { id: generateId(), equipmentNumber: '889', description: 'Volvo Articulated Dump Truck', type: 'ADT' },
    { id: generateId(), equipmentNumber: '156', description: 'Caterpillar 320 Excavator', type: 'Excavator' },
    { id: generateId(), equipmentNumber: '222', description: 'Bomag Roller Compactor', type: 'Roller' },
    { id: generateId(), equipmentNumber: '777', description: 'Water Truck', type: 'Water' },
  ];

  // Subcontractors
  const subcontractors: Subcontractor[] = [
    { id: generateId(), name: 'Imperial Paving' },
    { id: generateId(), name: 'Scheffler Electric' },
    { id: generateId(), name: 'White Cap Supply' },
    { id: generateId(), name: 'Home Depot Pro' },
    { id: generateId(), name: 'Bay Area Concrete' },
    { id: generateId(), name: 'Pacific Plumbing' },
    { id: generateId(), name: 'Golden Gate Fencing' },
  ];

  await db.equipment.bulkAdd(equipment);
  await db.subcontractors.bulkAdd(subcontractors);

  console.log('Database seeded successfully!');
}
