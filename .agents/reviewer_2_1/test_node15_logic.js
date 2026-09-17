const fs = require('fs');

function runNode15(inputItems) {
    const $input = {
        all: () => inputItems
    };

    const timezone = 'America/Caracas';
    const now = new Date('2026-07-27T10:00:00-04:00'); // Assume Monday July 27, 2026 for fixed baseline testing
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

    for (const lead of $input.all()) {
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

    const txt = reporteDisponibilidad.join('\n');

    return {
        agenda_disponible: txt,
        agenda_ocupada: txt
    };
}

// Test case 1: Empty Supabase (no bookings)
console.log("=== TEST CASE 1: NO BOOKINGS ===");
const res1 = runNode15([]);
console.log(res1.agenda_disponible);

// Test case 2: Booking 04:00 pm on Wednesday 2026-07-29
console.log("\n=== TEST CASE 2: BOOKING 04:00 PM ON WEDNESDAY 2026-07-29 ===");
const res2 = runNode15([
    { json: { Dia_Cita: '2026-07-29', Hora_Cita: '04:00 pm' } },
    { json: { Dia_Cita: '2026-07-27', Hora_Cita: '09:00 am' } }
]);
console.log(res2.agenda_disponible);
