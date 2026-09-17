// Empirical Test Harness for Paso 2 - Node #15 (Formatear Agenda)
// Executing tests against the logic of Node #15 in flujo asistente de whatsapp.json

const timezone = 'America/Caracas';

function runNode15Code($input_all, mockDateStr = null) {
    const now = mockDateStr ? new Date(mockDateStr + 'T12:00:00-04:00') : new Date();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const todayStr = dateFormatter.format(now);
    const baseDate = new Date(todayStr + 'T12:00:00-04:00');

    const SLOTS_MANANA = ["08:00", "09:00", "10:00", "11:00"];
    const SLOTS_TARDE = ["16:00", "17:00"];

    const ocupacionSupabase = {};
    const diasBloqueadosCompletos = new Set();

    function parseTimeTo24hHour(raw) {
        if (!raw) return null;
        const str = raw.toString().toLowerCase().trim();
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

    for (const lead of $input_all) {
        const json = lead.json || {};
        const date = json.Dia_Cita;
        const timeRaw = (json.Hora_Cita || '').toString().trim();

        if (!date || date === '' || date < todayStr) continue;

        const timeLower = timeRaw.toLowerCase();

        if (timeLower.includes('todo el dia') || timeLower.includes('toda la semana') || timeLower.includes('bloqueado') || timeLower.includes('vacaciones') || timeLower.includes('no laborable')) {
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
        const dayOfWeek = d.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
            continue;
        }

        if (diasBloqueadosCompletos.has(dateStr)) {
            reporteDisponibilidad.push(`- ${dateStr}: MAÑANA DISPONIBLE: [Sin disponibilidad] | TARDE DISPONIBLE: [Sin disponibilidad] (Bloqueado)`);
            continue;
        }

        const candManana = [...SLOTS_MANANA];
        let candTarde = [];

        if (dayOfWeek === 3 || dayOfWeek === 4) {
            candTarde = [...SLOTS_TARDE];
        }

        const ocupadas = ocupacionSupabase[dateStr] || new Set();
        const dispManana = candManana.filter(h => !ocupadas.has(h));
        const dispTarde = candTarde.filter(h => !ocupadas.has(h));

        const mananaTxt = dispManana.length > 0 ? dispManana.join(', ') : 'Sin disponibilidad';
        const tardeTxt = dispTarde.length > 0 ? dispTarde.join(', ') : 'Sin disponibilidad';

        reporteDisponibilidad.push(`- ${dateStr}: MAÑANA DISPONIBLE: [${mananaTxt}] | TARDE DISPONIBLE: [${tardeTxt}]`);
    }

    const txt = reporteDisponibilidad.join('\n');

    return {
        agenda_disponible: txt,
        agenda_ocupada: txt,
        _internal: {
            ocupacionSupabase,
            diasBloqueadosCompletos
        }
    };
}

// TEST SUITE DEFINITION
const tests = [];
function addTest(name, fn) {
    tests.push({ name, fn });
}

// TEST 1: Empty Supabase Arrays
addTest('Empty Supabase input', () => {
    const res = runNode15Code([]);
    if (!res.agenda_disponible || typeof res.agenda_disponible !== 'string') {
        return { pass: false, error: 'Output agenda_disponible is not a valid string' };
    }
    const lines = res.agenda_disponible.split('\n');
    if (lines.length !== 14) {
        return { pass: false, error: `Expected 14 lines, got ${lines.length}` };
    }
    return { pass: true };
});

// TEST 2: Weekend Inputs & Weekend Schedule Blocking
addTest('Weekend inputs and weekend blocking', () => {
    // Mock today to Sunday 2026-07-26
    const res = runNode15Code([], '2026-07-26');
    const lines = res.agenda_disponible.split('\n');
    // Day 0: 2026-07-26 is Sunday -> NO LABORABLE
    if (!lines[0].includes('2026-07-26 (Fin de semana): NO LABORABLE')) {
        return { pass: false, error: `Expected 2026-07-26 to be NO LABORABLE, got: ${lines[0]}` };
    }
    // Day 6: 2026-08-01 is Saturday -> NO LABORABLE
    if (!lines[6].includes('2026-08-01 (Fin de semana): NO LABORABLE')) {
        return { pass: false, error: `Expected 2026-08-01 to be NO LABORABLE, got: ${lines[6]}` };
    }
    return { pass: true };
});

// TEST 3: 12h vs 24h Format Mix
addTest('12h vs 24h format mix parsing', () => {
    const mockInput = [
        { json: { Dia_Cita: '2026-07-27', Hora_Cita: '04:00 pm' } }, // Mon 16:00 (Mon has no afternoon slots anyway, but let's check)
        { json: { Dia_Cita: '2026-07-29', Hora_Cita: '04:00 pm' } }, // Wed 16:00 -> blocks 16:00
        { json: { Dia_Cita: '2026-07-29', Hora_Cita: '8:00 AM' } },  // Wed 08:00 -> blocks 08:00
        { json: { Dia_Cita: '2026-07-30', Hora_Cita: '16:00' } },    // Thu 16:00 -> blocks 16:00
        { json: { Dia_Cita: '2026-07-30', Hora_Cita: '12:00 pm' } }, // Thu 12:00 -> blocks 12:00 (not in candidate list, no crash)
        { json: { Dia_Cita: '2026-07-30', Hora_Cita: '12:00 am' } }, // Thu 00:00 -> blocks 00:00 (not in candidate list)
    ];
    const res = runNode15Code(mockInput, '2026-07-26');
    const lines = res.agenda_disponible.split('\n');
    
    // Wed 2026-07-29 line check: 08:00 blocked (manana: 09:00, 10:00, 11:00), 16:00 blocked (tarde: 17:00)
    const wedLine = lines.find(l => l.includes('2026-07-29'));
    if (!wedLine.includes('MAÑANA DISPONIBLE: [09:00, 10:00, 11:00] | TARDE DISPONIBLE: [17:00]')) {
        return { pass: false, error: `Wed 2026-07-29 output unexpected: ${wedLine}` };
    }

    // Thu 2026-07-30 line check: 16:00 blocked (tarde: 17:00)
    const thuLine = lines.find(l => l.includes('2026-07-30'));
    if (!thuLine.includes('TARDE DISPONIBLE: [17:00]')) {
        return { pass: false, error: `Thu 2026-07-30 output unexpected: ${thuLine}` };
    }

    return { pass: true };
});

// TEST 4: Full Day Blockages
addTest('Full day blockages (todo el dia, vacaciones, etc.)', () => {
    const mockInput = [
        { json: { Dia_Cita: '2026-07-27', Hora_Cita: 'TODO EL DIA' } },
        { json: { Dia_Cita: '2026-07-28', Hora_Cita: 'vacaciones' } },
        { json: { Dia_Cita: '2026-07-29', Hora_Cita: 'bloqueado' } },
    ];
    const res = runNode15Code(mockInput, '2026-07-26');
    const lines = res.agenda_disponible.split('\n');

    const monLine = lines.find(l => l.includes('2026-07-27'));
    if (!monLine.includes('(Bloqueado)')) {
        return { pass: false, error: `Mon 2026-07-27 expected (Bloqueado), got: ${monLine}` };
    }

    const tueLine = lines.find(l => l.includes('2026-07-28'));
    if (!tueLine.includes('(Bloqueado)')) {
        return { pass: false, error: `Tue 2026-07-28 expected (Bloqueado), got: ${tueLine}` };
    }

    return { pass: true };
});

// TEST 5: ADVERSARIAL EDGE CASE - Accented "Todo el día" or "Día completo"
addTest('Accented string "Todo el día" (Vulnerability Test)', () => {
    const mockInput = [
        { json: { Dia_Cita: '2026-07-27', Hora_Cita: 'Todo el día' } }
    ];
    const res = runNode15Code(mockInput, '2026-07-26');
    const lines = res.agenda_disponible.split('\n');
    const monLine = lines.find(l => l.includes('2026-07-27'));

    // Check if "Todo el día" was recognized as blocked
    if (!monLine.includes('(Bloqueado)')) {
        return {
            pass: false,
            vulnerability: true,
            error: `BUG DETECTED: "Todo el día" (with accent í) was NOT recognized as full day blockage! Output line: ${monLine}`
        };
    }
    return { pass: true };
});

// Execute test runner
console.log('--- RUNNING EMPIRICAL TEST SUITE ---');
let passed = 0;
let failed = 0;
for (const t of tests) {
    try {
        const res = t.fn();
        if (res.pass) {
            console.log(`[PASS] ${t.name}`);
            passed++;
        } else {
            console.log(`[FAIL/VULNERABILITY] ${t.name}: ${res.error}`);
            failed++;
        }
    } catch (e) {
        console.log(`[ERROR] ${t.name}: ${e.message}`);
        failed++;
    }
}
console.log(`Summary: ${passed} Passed, ${failed} Failed/Vulnerabilities Found.`);
