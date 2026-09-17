// Test script for Node #15 (Formatear Agenda) logic
const assert = require('assert');

function runFormatearAgenda(inputItems) {
    const timezone = 'America/Caracas';
    const now = new Date('2026-07-26T20:00:00Z'); // Sunday 4:00 PM Caracas time (UTC-4)
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

    for (const item of inputItems) {
        const json = item.json || {};
        const date = json.Dia_Cita;
        const timeRaw = (json.Hora_Cita || '').toString().trim();

        if (!date || date === '' || date < todayStr) continue;

        const timeLower = timeRaw.toLowerCase();

        if (timeLower.includes('todo el dia') || timeLower.includes('toda la semana') || timeLower.includes('bloqueado') || timeLower.includes('vacaciones')) {
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

    const resTxt = reporteDisponibilidad.join('\n');
    return {
        agenda_disponible: resTxt,
        agenda_ocupada: resTxt
    };
}

// TEST 1: Parse 12h PM vs 24h
console.log("--- TEST 1: 12h/24h Time Parsing ---");
const testData1 = [
    { json: { Dia_Cita: "2026-07-29", Hora_Cita: "04:00 pm" } },
    { json: { Dia_Cita: "2026-07-30", Hora_Cita: "4:00 PM" } },
    { json: { Dia_Cita: "2026-07-27", Hora_Cita: "08:00 am" } }
];
const res1 = runFormatearAgenda(testData1);
console.log(res1.agenda_disponible);

// Verify July 29 (Wednesday) afternoon: 16:00 is blocked by 04:00 pm, so only 17:00 remains in tarde
assert(res1.agenda_disponible.includes("- 2026-07-29: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [17:00]"));
// Verify July 27 (Monday) morning: 08:00 is blocked by 08:00 am
assert(res1.agenda_disponible.includes("- 2026-07-27: MAÑANA DISPONIBLE: [09:00, 10:00, 11:00] | TARDE DISPONIBLE: [Sin disponibilidad]"));
// Verify July 30 (Thursday) afternoon: 16:00 is blocked by 4:00 PM
assert(res1.agenda_disponible.includes("- 2026-07-30: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [17:00]"));

console.log("✅ TEST 1 PASSED!");

// TEST 2: Full day blockage & Weekends
console.log("\n--- TEST 2: Full day blockage & Weekends ---");
const testData2 = [
    { json: { Dia_Cita: "2026-07-28", Hora_Cita: "todo el dia" } }
];
const res2 = runFormatearAgenda(testData2);
assert(res2.agenda_disponible.includes("- 2026-07-26 (Fin de semana): NO LABORABLE"));
assert(res2.agenda_disponible.includes("- 2026-07-28: MAÑANA DISPONIBLE: [Sin disponibilidad] | TARDE DISPONIBLE: [Sin disponibilidad] (Bloqueado)"));
console.log("✅ TEST 2 PASSED!");
