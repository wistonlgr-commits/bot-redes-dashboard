/**
 * Expanded Empirical Test Harness for 'Formatear Agenda' JS Node
 * Phase 3/4 Verification - Empirical Stress Testing
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.resolve(__dirname, '../../flujo asistente de whatsapp.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const workflow = JSON.parse(rawData);

const agendaNode = workflow.nodes.find(n => n.name === 'Formatear Agenda');
if (!agendaNode) {
    console.error("ERROR: Could not find 'Formatear Agenda' node in workflow!");
    process.exit(1);
}

function runAgendaCode(inputItems, mockDateObj = null) {
    const $input = {
        all: () => inputItems
    };

    const timezone = 'America/Caracas';
    const now = mockDateObj || new Date();
    
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const todayStr = dateFormatter.format(now);
    const currentHourCaracas = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now), 10);

    const baseDate = new Date(todayStr + 'T12:00:00-04:00');

    const SLOTS_PRESENCIAL = ["08:00", "09:00", "10:00", "11:00"];
    const SLOTS_ONLINE = ["16:00", "17:00"];

    const ocupacionSupabase = {};
    const diasBloqueadosCompletos = new Set();

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

    for (const lead of $input.all()) {
        const json = lead.json || {};
        const date = json.Dia_Cita;
        const timeRaw = (json.Hora_Cita || '').toString().trim();
        const nombreRaw = (json.Nombre || '').toString().trim();

        if (!date || date === '' || date < todayStr) continue;

        const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isBloqueo = nombreRaw.toUpperCase().startsWith('[BLOQUEO]');

        if (
            timeLower.includes('todo el dia') || 
            timeLower.includes('toda la semana') || 
            timeLower.includes('bloqueado') || 
            timeLower.includes('vacaciones') || 
            timeLower.includes('no laborable') ||
            (isBloqueo && (!timeRaw || timeLower === '' || timeLower.includes('todo el dia')))
        ) {
            diasBloqueadosCompletos.add(date);
            continue;
        }

        const hour24 = parseTimeTo24hHour(timeRaw);
        if (hour24 !== null) {
            const slotStr = hour24.toString().padStart(2, '0') + ':00';
            if (!ocupacionSupabase[date]) {
                ocupacionSupabase[date] = new Set();
            }
            ocupacionSupabase[date].add(slotStr);
        }
    }

    const reporteDisponibilidad = [];

    for (let i = 0; i < 14; i++) {
        const d = new Date(baseDate.getTime() + i * 86400000);
        const dateStr = dateFormatter.format(d);
        const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
            continue;
        }

        if (diasBloqueadosCompletos.has(dateStr)) {
            reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Uniaragua): [Sin disponibilidad] | ONLINE: [Sin disponibilidad] (Bloqueado)`);
            continue;
        }

        const candPresencial = [...SLOTS_PRESENCIAL];
        let candOnline = [];

        if (dayOfWeek === 1 || dayOfWeek === 4) {
            candOnline = [...SLOTS_ONLINE];
        }

        const ocupadas = ocupacionSupabase[dateStr] || new Set();
        let dispPresencial = candPresencial.filter(h => !ocupadas.has(h));
        let dispOnline = candOnline.filter(h => !ocupadas.has(h));

        if (i === 0) {
            dispPresencial = dispPresencial.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
            dispOnline = dispOnline.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
        }

        const presencialTxt = dispPresencial.length > 0 ? dispPresencial.join(', ') : 'Sin disponibilidad';
        const onlineTxt = dispOnline.length > 0 ? dispOnline.join(', ') : 'Sin disponibilidad';

        reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Mañanas en Uniaragua): [${presencialTxt}] | ONLINE (Tardes): [${onlineTxt}]`);
    }

    const txt = reporteDisponibilidad.join('\n');
    return { agenda_disponible: txt, agenda_ocupada: txt, todayStr, diasBloqueadosCompletos, ocupacionSupabase };
}

console.log("==================================================");
console.log("RUNNING EXTENDED EMPIRICAL STRESS TESTS FOR 'Formatear Agenda'");
console.log("==================================================\n");

const mockMonday = new Date('2026-08-03T06:00:00-04:00'); // Lun 2026-08-03

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assertTest(testName, condition, details = "") {
    totalTests++;
    if (condition) {
        passedTests++;
        testResults.push({ name: testName, status: 'PASS', details });
        console.log(`[PASS] ${testName}`);
    } else {
        failedTests++;
        testResults.push({ name: testName, status: 'FAIL', details });
        console.error(`[FAIL] ${testName} - ${details}`);
    }
}

// SECTION 1: [BLOQUEO] CASE & ACCENT VARIANTS
console.log("--- 1. [BLOQUEO] Casing, Accents, and Time Specifications ---");

// 1.1 UPPERCASE [BLOQUEO] with empty time
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '[BLOQUEO] Mantenimiento' } }];
    const res = runAgendaCode(input, mockMonday);
    assertTest("1.1 UPPERCASE [BLOQUEO] empty time -> Full day block", res.diasBloqueadosCompletos.has('2026-08-03'), `Output: ${res.agenda_disponible.split('\n')[0]}`);
}

// 1.2 Lowercase [bloqueo] with empty time
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '[bloqueo] mantenimientos' } }];
    const res = runAgendaCode(input, mockMonday);
    assertTest("1.2 Lowercase [bloqueo] empty time -> Full day block", res.diasBloqueadosCompletos.has('2026-08-03'), `Output: ${res.agenda_disponible.split('\n')[0]}`);
}

// 1.3 Mixed case [BloQueO] with whitespace
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '  [BloQueO] Dr no atiende  ' } }];
    const res = runAgendaCode(input, mockMonday);
    assertTest("1.3 Mixed case [BloQueO] with spaces -> Full day block", res.diasBloqueadosCompletos.has('2026-08-03'), `Output: ${res.agenda_disponible.split('\n')[0]}`);
}

// 1.4 Accented [BLOQUEÓ]
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '[BLOQUEÓ] Personal' } }];
    const res = runAgendaCode(input, mockMonday);
    const passed = res.diasBloqueadosCompletos.has('2026-08-03');
    assertTest("1.4 Accented [BLOQUEÓ] empty time -> Detects block?", passed, 
        passed ? "Detected" : "FAIL: '[BLOQUEÓ]'.toUpperCase() is '[BLOQUEÓ]' which does not match startsWith('[BLOQUEO]')");
}

// 1.5 Accented lowercase [bloqueó]
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '[bloqueó] Personal' } }];
    const res = runAgendaCode(input, mockMonday);
    const passed = res.diasBloqueadosCompletos.has('2026-08-03');
    assertTest("1.5 Accented [bloqueó] empty time -> Detects block?", passed, 
        passed ? "Detected" : "FAIL: '[bloqueó]'.toUpperCase() is '[BLOQUEÓ]' which does not match startsWith('[BLOQUEO]')");
}

// 1.6 [BLOQUEO] with TODO EL DIA / Todo el día
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: 'Todo el día', Nombre: '[BLOQUEO] Conferencia' } }];
    const res = runAgendaCode(input, mockMonday);
    assertTest("1.6 [BLOQUEO] with 'Todo el día' -> Full day block", res.diasBloqueadosCompletos.has('2026-08-03'), `Output: ${res.agenda_disponible.split('\n')[0]}`);
}

// 1.7 [BLOQUEO] with specific time 09:00
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '09:00', Nombre: '[BLOQUEO] Reunion corta' } }];
    const res = runAgendaCode(input, mockMonday);
    const line = res.agenda_disponible.split('\n')[0];
    assertTest("1.7 [BLOQUEO] specific time 09:00 -> Blocks ONLY 09:00 slot", 
        !res.diasBloqueadosCompletos.has('2026-08-03') && line.includes('08:00, 10:00, 11:00'),
        `Line: "${line}"`
    );
}

// 1.8 [BLOQUEO] with specific time 16:00
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '16:00', Nombre: '[BLOQUEO] Sesion online privada' } }];
    const res = runAgendaCode(input, mockMonday);
    const line = res.agenda_disponible.split('\n')[0];
    assertTest("1.8 [BLOQUEO] specific time 16:00 -> Blocks ONLY 16:00 slot in Online", 
        line.includes('ONLINE (Tardes): [17:00]') && line.includes('08:00, 09:00, 10:00, 11:00'),
        `Line: "${line}"`
    );
}

// SECTION 2: NORMAL PATIENT LEADS
console.log("\n--- 2. Normal Patient Leads ---");

// 2.1 Presencial slot occupied
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '09:00', Nombre: 'Ana Garcia' } }];
    const res = runAgendaCode(input, mockMonday);
    const line = res.agenda_disponible.split('\n')[0];
    assertTest("2.1 Normal lead 09:00 -> PRESENCIAL removes 09:00", line.includes('[08:00, 10:00, 11:00]'), `Line: "${line}"`);
}

// 2.2 Online slot occupied
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '16:00', Nombre: 'Luis Morales' } }];
    const res = runAgendaCode(input, mockMonday);
    const line = res.agenda_disponible.split('\n')[0];
    assertTest("2.2 Normal lead 16:00 -> ONLINE removes 16:00", line.includes('ONLINE (Tardes): [17:00]'), `Line: "${line}"`);
}

// 2.3 Time format variations: 9:00 am, 4 pm
{
    const input = [
        { json: { Dia_Cita: '2026-08-03', Hora_Cita: '9:00 am', Nombre: 'P1' } },
        { json: { Dia_Cita: '2026-08-03', Hora_Cita: '4 pm', Nombre: 'P2' } }
    ];
    const res = runAgendaCode(input, mockMonday);
    const line = res.agenda_disponible.split('\n')[0];
    assertTest("2.3 9:00 am and 4 pm parsing -> 09:00 and 16:00 correctly removed", 
        line.includes('PRESENCIAL (Mañanas en Uniaragua): [08:00, 10:00, 11:00]') &&
        line.includes('ONLINE (Tardes): [17:00]'),
        `Line: "${line}"`
    );
}

// SECTION 3: MODALITY SLOTS & NON-WORKING DAYS
console.log("\n--- 3. Modality Rules & Non-Working Days ---");

// 3.1 Weekend formatting
{
    const res = runAgendaCode([], mockMonday);
    const lines = res.agenda_disponible.split('\n');
    const sat = lines.find(l => l.includes('2026-08-08'));
    const sun = lines.find(l => l.includes('2026-08-09'));
    assertTest("3.1 Weekend formatting -> (Fin de semana): NO LABORABLE", 
        sat && sat.includes('(Fin de semana): NO LABORABLE') && sun && sun.includes('(Fin de semana): NO LABORABLE'),
        `Sat: "${sat}" | Sun: "${sun}"`
    );
}

// 3.2 Monday (Lun) Candidate Slots
{
    const res = runAgendaCode([], mockMonday);
    const mon = res.agenda_disponible.split('\n')[0];
    assertTest("3.2 Monday Candidate Slots -> Presencial [08,09,10,11], Online [16,17]",
        mon.includes('PRESENCIAL (Mañanas en Uniaragua): [08:00, 09:00, 10:00, 11:00]') &&
        mon.includes('ONLINE (Tardes): [16:00, 17:00]'),
        `Mon: "${mon}"`
    );
}

// 3.3 Tuesday/Wednesday/Friday Candidate Slots (Presencial active, Online inactive)
{
    const res = runAgendaCode([], mockMonday);
    const tue = res.agenda_disponible.split('\n')[1]; // Tue 2026-08-04
    const wed = res.agenda_disponible.split('\n')[2]; // Wed 2026-08-05
    const fri = res.agenda_disponible.split('\n')[4]; // Fri 2026-08-07
    assertTest("3.3 Tue/Wed/Fri Candidate Slots -> Presencial active, Online [Sin disponibilidad]",
        tue.includes('ONLINE (Tardes): [Sin disponibilidad]') &&
        wed.includes('ONLINE (Tardes): [Sin disponibilidad]') &&
        fri.includes('ONLINE (Tardes): [Sin disponibilidad]'),
        `Tue: "${tue}"`
    );
}

// 3.4 Thursday (Jue) Candidate Slots
{
    const res = runAgendaCode([], mockMonday);
    const thu = res.agenda_disponible.split('\n')[3]; // Thu 2026-08-06
    assertTest("3.4 Thursday Candidate Slots -> Presencial [08,09,10,11], Online [16,17]",
        thu.includes('PRESENCIAL (Mañanas en Uniaragua): [08:00, 09:00, 10:00, 11:00]') &&
        thu.includes('ONLINE (Tardes): [16:00, 17:00]'),
        `Thu: "${thu}"`
    );
}

// SECTION 4: ADVANCED EDGE CASES & UNCOVERED BEHAVIORS
console.log("\n--- 4. Advanced Edge Cases & Structural Observations ---");

// 4.1 Time range handling (e.g., "09:00 - 12:00" in Hora_Cita for [BLOQUEO])
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '09:00 - 12:00', Nombre: '[BLOQUEO] Reparacion' } }];
    const res = runAgendaCode(input, mockMonday);
    const slot10Occupied = res.ocupacionSupabase['2026-08-03'] && res.ocupacionSupabase['2026-08-03'].has('10:00');
    assertTest("4.1 Time range '09:00 - 12:00' -> Does it block 10:00 and 11:00 slots?",
        slot10Occupied,
        `slot10Occupied=${slot10Occupied}. parseTimeTo24hHour parses only first number (9:00), ignoring range end (12:00)!`
    );
}

// 4.2 Label formatting inconsistency between Blocked day vs Open day
{
    const input = [{ json: { Dia_Cita: '2026-08-03', Hora_Cita: '', Nombre: '[BLOQUEO]' } }];
    const res = runAgendaCode(input, mockMonday);
    const blockedLine = res.agenda_disponible.split('\n')[0];
    const resOpen = runAgendaCode([], mockMonday);
    const openLine = resOpen.agenda_disponible.split('\n')[0];
    
    const blockedHasMañanas = blockedLine.includes('Mañanas en Uniaragua');
    const openHasMañanas = openLine.includes('Mañanas en Uniaragua');
    assertTest("4.2 Header Label Inconsistency Check -> Identifies format variance between blocked and open day",
        blockedHasMañanas === openHasMañanas,
        `Blocked line: "${blockedLine}" | Open line: "${openLine}"`
    );
}

console.log("\n==================================================");
console.log(`EXTENDED SUMMARY: Total=${totalTests}, Passed=${passedTests}, Failed=${failedTests}`);
console.log("==================================================");

// Save report to JSON
fs.writeFileSync(path.resolve(__dirname, 'test_results.json'), JSON.stringify({
    totalTests,
    passedTests,
    failedTests,
    testResults
}, null, 2));

