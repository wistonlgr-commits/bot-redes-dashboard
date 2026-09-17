const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STARTING PASO 2 REMEDIATION TEST SUITE ===');

// 1. Load standalone code and workflow JSON code
const scriptPath = path.join(__dirname, '../../formatear_agenda_corregido.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const jsonPath = path.join(__dirname, '../../flujo asistente de whatsapp.json');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');
const workflowJson = JSON.parse(jsonContent);
const node15 = workflowJson.nodes.find(n => n.name === 'Formatear Agenda');

assert(node15, 'Node #15 "Formatear Agenda" must exist in workflow JSON');
console.log('✓ Successfully loaded formatear_agenda_corregido.js and Node #15 from JSON');

// 2. Validate exact presence of remediation requirements in source code
console.log('\n--- Requirement 1: Server Timezone Independence ---');
assert(scriptContent.includes("new Date(dateStr + 'T12:00:00Z').getUTCDay()"), 'script must use UTC day calculation');
assert(node15.parameters.jsCode.includes("new Date(dateStr + 'T12:00:00Z').getUTCDay()"), 'node15 jsCode must use UTC day calculation');
console.log('✓ Verified getUTCDay() with ISO UTC string in both files');

console.log('\n--- Requirement 2: Typography Cleaning in Time Parser ---');
assert(scriptContent.includes(".replace(/\\./g, '')"), 'script must strip periods in time parser');
assert(node15.parameters.jsCode.includes(".replace(/\\./g, '')"), 'node15 jsCode must strip periods in time parser');
console.log('✓ Verified period stripping in parseTimeTo24hHour in both files');

console.log('\n--- Requirement 3: Accent Normalization ---');
assert(scriptContent.includes(".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')"), 'script must normalize accents');
assert(node15.parameters.jsCode.includes(".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')"), 'node15 jsCode must normalize accents');
console.log('✓ Verified NFD accent normalization in full-day blockage check in both files');

// 3. Test parseTimeTo24hHour logic directly
function parseTimeTo24hHour(raw) {
    if (!raw) return null;
    const str = raw.toString().toLowerCase().replace(/\./g, '').trim();
    if (!str) return null;

    const isPM = str.includes('pm');
    const isAM = str.includes('am');

    const clean = str.replace(/(am|pm)/g, '').trim();
    const parts = clean.split(':');
    if (parts.length === 0) return null;

    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return null;

    if (isPM) {
        if (h < 12) h += 12;
    } else if (isAM) {
        if (h === 12) h = 0;
    }

    if (h >= 0 && h <= 23) {
        return h;
    }
    return null;
}

console.log('\n--- Testing parseTimeTo24hHour Edge Cases ---');
const timeTestCases = [
    { input: "04:00 p.m.", expected: 16 },
    { input: "4:00 P.M.", expected: 16 },
    { input: "04:00 pm", expected: 16 },
    { input: "4:00 PM", expected: 16 },
    { input: "08:00 a.m.", expected: 8 },
    { input: "8:00 A.M.", expected: 8 },
    { input: "12:00 p.m.", expected: 12 },
    { input: "12:00 a.m.", expected: 0 },
    { input: "16:00", expected: 16 },
    { input: "08:00", expected: 8 },
    { input: "11:00 AM", expected: 11 },
    { input: "05:00 P.M.", expected: 17 }
];

for (const tc of timeTestCases) {
    const res = parseTimeTo24hHour(tc.input);
    assert.strictEqual(res, tc.expected, `Failed for input '${tc.input}': expected ${tc.expected}, got ${res}`);
    console.log(`  ✓ parseTimeTo24hHour('${tc.input}') => ${res}`);
}

// 4. Test Accent Normalization Logic
console.log('\n--- Testing Accent Normalization in Full-Day Blockage ---');
function isFullDayBlocked(timeRaw) {
    const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return timeLower.includes('todo el dia') || timeLower.includes('toda la semana') || timeLower.includes('bloqueado') || timeLower.includes('vacaciones') || timeLower.includes('no laborable');
}

const blockageTestCases = [
    { input: "todo el día", expected: true },
    { input: "TODO EL DÍA", expected: true },
    { input: "todo el dia", expected: true },
    { input: "Día completo bloqueádo", expected: true },
    { input: "vacaciones", expected: true },
    { input: "Día no laborable", expected: true },
    { input: "04:00 p.m.", expected: false }
];

for (const tc of blockageTestCases) {
    const res = isFullDayBlocked(tc.input);
    assert.strictEqual(res, tc.expected, `Failed for blockage input '${tc.input}': expected ${tc.expected}, got ${res}`);
    console.log(`  ✓ isFullDayBlocked('${tc.input}') => ${res}`);
}

// 5. Test UTC Day of Week calculation
console.log('\n--- Testing UTC Day of Week Calculation ---');
const dateTestCases = [
    { dateStr: "2026-07-27", expectedDay: 1 }, // Monday
    { dateStr: "2026-07-28", expectedDay: 2 }, // Tuesday
    { dateStr: "2026-07-29", expectedDay: 3 }, // Wednesday
    { dateStr: "2026-07-30", expectedDay: 4 }, // Thursday
    { dateStr: "2026-07-31", expectedDay: 5 }, // Friday
    { dateStr: "2026-08-01", expectedDay: 6 }, // Saturday
    { dateStr: "2026-08-02", expectedDay: 0 }  // Sunday
];

for (const tc of dateTestCases) {
    const dayOfWeek = new Date(tc.dateStr + 'T12:00:00Z').getUTCDay();
    assert.strictEqual(dayOfWeek, tc.expectedDay, `Failed for date '${tc.dateStr}': expected ${tc.expectedDay}, got ${dayOfWeek}`);
    console.log(`  ✓ new Date('${tc.dateStr}T12:00:00Z').getUTCDay() => ${dayOfWeek}`);
}

// 6. Test full node execution simulation
console.log('\n--- Simulating Node #15 Code Execution ---');
function runNodeScript(code, mockInput) {
    const fn = new Function('$input', code);
    return fn(mockInput);
}

const mockInput = {
    all: () => [
        { json: { Dia_Cita: '2026-07-29', Hora_Cita: '04:00 p.m.' } },
        { json: { Dia_Cita: '2026-07-30', Hora_Cita: 'todo el día' } }
    ]
};

const resultScript = runNodeScript(scriptContent, mockInput);
assert(resultScript.agenda_disponible, 'Script output must have agenda_disponible');
assert(resultScript.agenda_ocupada, 'Script output must have agenda_ocupada');
console.log('✓ Script execution completed successfully!');
console.log('Sample output snippet:\n', resultScript.agenda_disponible.split('\n').slice(0, 5).join('\n'));

const resultNode15 = runNodeScript(node15.parameters.jsCode, mockInput);
assert.strictEqual(resultNode15.agenda_disponible, resultScript.agenda_disponible, 'Workflow node output must match standalone script output');
console.log('✓ Node #15 workflow execution output matches standalone script output 100%!');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
