import { db, generateId } from './database';
import type { Job, Employee, Equipment, CostCode, Subcontractor } from '@/types';

export async function seedDatabase() {
  // Check if data already exists
  const existingEmployees = await db.employees.count();
  if (existingEmployees > 0) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding database with test data...');

  // Jobs
  const jobs: Job[] = [
    {
      id: generateId(),
      jobNumber: '2024-001',
      jobName: 'Highway 101 Expansion',
      status: 'Active',
      address: '1234 Highway 101, San Jose, CA',
    },
    {
      id: generateId(),
      jobNumber: '2024-002',
      jobName: 'Downtown Plaza Excavation',
      status: 'Active',
      address: '500 Main St, Oakland, CA',
    },
    {
      id: generateId(),
      jobNumber: '2024-003',
      jobName: 'Bay Bridge Approach',
      status: 'Active',
      address: 'Bay Bridge Toll Plaza, Oakland, CA',
    },
    {
      id: generateId(),
      jobNumber: '2023-045',
      jobName: 'Airport Runway Extension',
      status: 'Completed',
      address: 'SFO Airport, San Francisco, CA',
    },
  ];

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

  // Cost Codes
  const costCodes: CostCode[] = [
    { id: generateId(), code: '803', description: 'Site Grading' },
    { id: generateId(), code: '1291', description: 'Excavation' },
    { id: generateId(), code: '1231', description: 'Backfill' },
    { id: generateId(), code: '1500', description: 'Concrete Work' },
    { id: generateId(), code: '1600', description: 'Paving' },
    { id: generateId(), code: '1700', description: 'Utilities' },
    { id: generateId(), code: '1800', description: 'Drainage' },
    { id: generateId(), code: '1900', description: 'Landscaping' },
    { id: generateId(), code: '2000', description: 'General Labor' },
    { id: generateId(), code: '2100', description: 'Equipment Mobilization' },
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

  // Employees (including foremen)
  const employees: Employee[] = [
    {
      id: generateId(),
      name: 'John Smith',
      trade: 'Supt',
      isForeman: true,
      assignedJobIds: [jobs[0].id, jobs[1].id],
      loginEmail: 'test1@4ecm.com',
      passwordHash: 'CP3456789', // In production, use proper hashing
    },
    {
      id: generateId(),
      name: 'Mike Johnson',
      trade: 'F',
      isForeman: true,
      assignedJobIds: [jobs[1].id, jobs[2].id],
      loginEmail: 'test2@4ecm.com',
      passwordHash: 'CP3456789',
    },
    {
      id: generateId(),
      name: 'Carlos Rodriguez',
      trade: 'F',
      isForeman: true,
      assignedJobIds: [jobs[0].id],
      loginEmail: 'test3@4ecm.com',
      passwordHash: 'CP3456789',
    },
    // Regular workers
    {
      id: generateId(),
      name: 'Robert Williams',
      trade: 'OE',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'James Davis',
      trade: 'OE',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'David Martinez',
      trade: 'LB',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Jose Garcia',
      trade: 'LB',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Miguel Hernandez',
      trade: 'LB',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Antonio Lopez',
      trade: 'Grd',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Kevin Brown',
      trade: 'OE',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Steven Wilson',
      trade: 'S',
      isForeman: false,
      assignedJobIds: [],
    },
    {
      id: generateId(),
      name: 'Mark Taylor',
      trade: 'S',
      isForeman: false,
      assignedJobIds: [],
    },
  ];

  // Insert all data
  await db.jobs.bulkAdd(jobs);
  await db.equipment.bulkAdd(equipment);
  await db.costCodes.bulkAdd(costCodes);
  await db.subcontractors.bulkAdd(subcontractors);
  await db.employees.bulkAdd(employees);

  console.log('Database seeded successfully!');
  console.log('Test login credentials:');
  console.log('  Email: test1@4ecm.com, test2@4ecm.com, or test3@4ecm.com');
  console.log('  Password: CP3456789');
}
