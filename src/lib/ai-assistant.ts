export const assistantTools = [
  {
    name: 'set_date',
    description: 'Set the report date. Use ISO format YYYY-MM-DD.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'ISO date string, e.g. 2026-03-10' },
      },
      required: ['date'],
    },
  },
  {
    name: 'set_weather',
    description: 'Set weather conditions. Use one of the preset values or a custom string.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weather: {
          type: 'string',
          description: 'Weather condition: Sunny, Clear, Partly Cloudy, Cloudy, Rain, Snow, Windy, Hot, Cold, or a custom string',
        },
      },
      required: ['weather'],
    },
  },
  {
    name: 'set_comments',
    description: 'Set or update the report comments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        comments: { type: 'string', description: 'Report comments text' },
      },
      required: ['comments'],
    },
  },
  {
    name: 'add_labor_entry',
    description: 'Add a new labor entry row. Use employee ID from the available employees list. Trade codes: S (Superintendent), OE (Operating Engineer), LB (Laborer), O (Other), F (Foreman), GC (General Contractor), L (Lineman), Grd (Grade), Supt (Superintendent).',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId: { type: 'string', description: 'Employee ID from available employees' },
        trade: { type: 'string', description: 'Trade code' },
        stHours: { type: 'number', description: 'Straight time hours (default 8)' },
        otHours: { type: 'number', description: 'Overtime hours (default 0)' },
        equipmentId: { type: 'string', description: 'Equipment ID if using company equipment' },
        rentalCompany: { type: 'string', description: 'Rental company name if using rental equipment' },
        equipmentDescription: { type: 'string', description: 'Equipment description if rental' },
      },
      required: ['employeeId', 'trade'],
    },
  },
  {
    name: 'update_labor_entry',
    description: 'Update an existing labor entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index of the labor entry to update' },
        employeeId: { type: 'string' },
        trade: { type: 'string' },
        stHours: { type: 'number' },
        otHours: { type: 'number' },
        equipmentId: { type: 'string' },
        rentalCompany: { type: 'string' },
        equipmentDescription: { type: 'string' },
      },
      required: ['index'],
    },
  },
  {
    name: 'remove_labor_entry',
    description: 'Remove a labor entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index of the labor entry to remove' },
      },
      required: ['index'],
    },
  },
  {
    name: 'add_diary_entry',
    description: 'Add a job diary / production notes entry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entryText: { type: 'string', description: 'Description of work performed' },
        costCodeId: { type: 'string', description: 'Cost code ID (optional)' },
        loads: { type: 'number', description: 'Number of loads (optional)' },
        yield: { type: 'number', description: 'Yield amount (optional)' },
      },
      required: ['entryText'],
    },
  },
  {
    name: 'update_diary_entry',
    description: 'Update an existing diary entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index' },
        entryText: { type: 'string' },
        costCodeId: { type: 'string' },
        loads: { type: 'number' },
        yield: { type: 'number' },
      },
      required: ['index'],
    },
  },
  {
    name: 'add_subcontractor_entry',
    description: 'Add a subcontractor work entry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contractorId: { type: 'string', description: 'Subcontractor ID from available list' },
        itemsWorked: { type: 'string', description: 'Description of items worked on' },
        production: { type: 'string', description: 'Production quantity (optional)' },
        costCodeId: { type: 'string', description: 'Cost code ID (optional)' },
      },
      required: ['contractorId', 'itemsWorked'],
    },
  },
  {
    name: 'add_delivery_entry',
    description: 'Add a material delivery entry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplier: { type: 'string', description: 'Supplier name' },
        material: { type: 'string', description: 'Material description' },
        quantity: { type: 'string', description: 'Quantity with units, e.g. "10 CY" or "500 LF"' },
      },
      required: ['supplier', 'material', 'quantity'],
    },
  },
  {
    name: 'remove_diary_entry',
    description: 'Remove a diary entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index' },
      },
      required: ['index'],
    },
  },
  {
    name: 'remove_subcontractor_entry',
    description: 'Remove a subcontractor entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index' },
      },
      required: ['index'],
    },
  },
  {
    name: 'remove_delivery_entry',
    description: 'Remove a delivery entry by index (0-based).',
    input_schema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '0-based index' },
      },
      required: ['index'],
    },
  },
];

export interface ReportContext {
  jobNumber: string;
  jobName: string;
  date: string;
  weather?: string;
  comments: string;
  laborEntries: Array<{
    index: number;
    employeeName: string;
    employeeId: string;
    trade: string;
    stHours: number;
    otHours: number;
    equipmentId?: string;
    equipmentNumber?: string;
    rentalCompany?: string;
    equipmentDescription?: string;
  }>;
  diaryEntries: Array<{
    index: number;
    entryText: string;
    costCode?: string;
    loads?: number;
    yield?: number;
    total?: number;
  }>;
  subcontractorEntries: Array<{
    index: number;
    contractorName: string;
    contractorId: string;
    itemsWorked: string;
    production?: string;
    costCode?: string;
  }>;
  deliveryEntries: Array<{
    index: number;
    supplier: string;
    material: string;
    quantity: string;
  }>;
  availableEmployees: Array<{ id: string; name: string; trade: string }>;
  availableEquipment: Array<{ id: string; equipmentNumber: string; description: string }>;
  availableCostCodes: Array<{ id: string; code: string; description: string }>;
  availableSubcontractors: Array<{ id: string; name: string }>;
}

function buildSystemPrompt(context: ReportContext): string {
  return `You are a helpful assistant for filling out a construction daily report form. You help superintendents and foremen quickly fill out their daily reports by understanding their natural language descriptions and converting them into structured form entries.

Current Report State:
- Job: ${context.jobNumber} - ${context.jobName}
- Date: ${context.date}
- Weather: ${context.weather || 'Not set'}
- Comments: ${context.comments || 'None'}
- Labor Entries (${context.laborEntries.length}): ${context.laborEntries.length > 0 ? context.laborEntries.map(e => `[${e.index}] ${e.employeeName} (${e.trade}) ${e.stHours}ST/${e.otHours}OT${e.equipmentNumber ? ` Equip #${e.equipmentNumber}` : ''}${e.rentalCompany ? ` Rental: ${e.rentalCompany}` : ''}`).join('; ') : 'None'}
- Diary Entries (${context.diaryEntries.length}): ${context.diaryEntries.length > 0 ? context.diaryEntries.map(e => `[${e.index}] "${e.entryText}"${e.costCode ? ` (${e.costCode})` : ''}`).join('; ') : 'None'}
- Subcontractors (${context.subcontractorEntries.length}): ${context.subcontractorEntries.length > 0 ? context.subcontractorEntries.map(e => `[${e.index}] ${e.contractorName}: "${e.itemsWorked}"`).join('; ') : 'None'}
- Deliveries (${context.deliveryEntries.length}): ${context.deliveryEntries.length > 0 ? context.deliveryEntries.map(e => `[${e.index}] ${e.supplier}: ${e.material} (${e.quantity})`).join('; ') : 'None'}

Available Employees:
${context.availableEmployees.map(e => `- ${e.name} (ID: ${e.id}, Trade: ${e.trade})`).join('\n')}

Available Equipment:
${context.availableEquipment.map(e => `- #${e.equipmentNumber}: ${e.description} (ID: ${e.id})`).join('\n')}

Available Cost Codes:
${context.availableCostCodes.map(c => `- ${c.code}: ${c.description} (ID: ${c.id})`).join('\n')}

Available Subcontractors:
${context.availableSubcontractors.map(s => `- ${s.name} (ID: ${s.id})`).join('\n')}

Guidelines:
- When the user mentions employees by name, match them to the available employees list and use their ID.
- When the user mentions equipment by number, match it to the available equipment list.
- Default ST hours to 8 and OT hours to 0 unless specified otherwise.
- For labor entries, use the employee's default trade unless the user specifies otherwise.
- Be concise in responses. Confirm what you did after making changes.
- If the user's request is ambiguous, ask for clarification.
- You can make multiple tool calls in one response to fill out multiple fields at once.`;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface APIContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface APIResponse {
  content: APIContentBlock[];
  stop_reason: string;
}

async function callClaude(body: Record<string, unknown>): Promise<APIResponse> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function sendMessage(
  messages: ChatMessage[],
  context: ReportContext
): Promise<{
  response: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
}> {
  const apiMessages: Array<{ role: string; content: unknown }> = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  let textResponse = '';

  let currentMessages = [...apiMessages];

  while (true) {
    const response = await callClaude({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: buildSystemPrompt(context),
      tools: assistantTools,
      messages: currentMessages,
    });

    const textBlocks: string[] = [];
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use' && block.id && block.name) {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
        toolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    textResponse = textBlocks.join('\n');

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      break;
    }

    currentMessages = [
      ...currentMessages,
      {
        role: 'assistant',
        content: response.content,
      },
      {
        role: 'user',
        content: toolUseBlocks.map((tool) => ({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: 'Done',
        })),
      },
    ];
  }

  return { response: textResponse, toolCalls };
}
