// =====================================================
// CÓDIGO CORREGIDO PARA EL NODO "Formatear Agenda" (Paso 2)
// Transforma la agenda a Horas Disponibles Exactas (:00)
// =====================================================

const timezone = 'America/Caracas';
const now = new Date();
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});
const todayStr = dateFormatter.format(now);

// Base date a mediodía Caracas para evitar desfasamiento al sumar días
const baseDate = new Date(todayStr + 'T12:00:00-04:00');

// Slots candidatos exactos (:00)
const SLOTS_MANANA = ["08:00", "09:00", "10:00", "11:00"];
const SLOTS_TARDE = ["16:00", "17:00"];

const ocupacionSupabase = {};
const diasBloqueadosCompletos = new Set();

// 1. RECOGER Y MAPEAR CITAS DE SUPABASE CON PARSER 12H/24H CORREGIDO
for (const lead of $input.all()) {
    const json = lead.json || {};
    const date = json.Dia_Cita;
    const timeRaw = (json.Hora_Cita || '').toString().trim();

    if (!date || date === '' || date < todayStr) continue;

    const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Bloqueo explícito de día completo o semana completa
    if (timeLower.includes('todo el dia') || timeLower.includes('toda la semana') || timeLower.includes('bloqueado') || timeLower.includes('vacaciones') || timeLower.includes('no laborable')) {
        diasBloqueadosCompletos.add(date);
        continue;
    }

    // Parsear hora 12h/24h a entero 0-23
    const hour24 = parseTimeTo24hHour(timeRaw);
    if (hour24 !== null) {
        const slotStr = hour24.toString().padStart(2, '0') + ':00';
        if (!ocupacionSupabase[date]) {
            ocupacionSupabase[date] = new Set();
        }
        ocupacionSupabase[date].add(slotStr);
    }
}

// Parser numérico de hora 12h/24h (previene que 4:00 pm bloquee 4:00 am)
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

// 2. GENERAR DISPONIBILIDAD POSITIVA PARA PRÓXIMOS 14 DÍAS
const reporteDisponibilidad = [];

for (let i = 0; i < 14; i++) {
    const d = new Date(baseDate.getTime() + i * 86400000);
    const dateStr = dateFormatter.format(d);
    const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay(); // 0 = Dom, 1 = Lun, 2 = Mar, 3 = Mié, 4 = Jue, 5 = Vie, 6 = Sáb

    // Fines de semana (Sábado y Domingo): 100% Bloqueados
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
        continue;
    }

    // Bloqueo explícito de día completo desde Supabase
    if (diasBloqueadosCompletos.has(dateStr)) {
        reporteDisponibilidad.push(`- ${dateStr}: MAÑANA DISPONIBLE: [Sin disponibilidad] | TARDE DISPONIBLE: [Sin disponibilidad] (Bloqueado)`);
        continue;
    }

    // Reglas de clínicas externas por día de semana:
    // Mañana: Lunes a Viernes 08:00, 09:00, 10:00, 11:00 disponible en Uniaragua.
    // Tarde:
    // - Lunes: Ambulatorio del Norte (12:00 pm en adelante bloqueado -> Tarde 0)
    // - Martes: Más Salud (12:00 pm en adelante bloqueado -> Tarde 0)
    // - Miércoles: Prevaler (12:00 pm - 4:00 pm bloqueado -> Tarde abre a las 16:00 -> 16:00, 17:00 disponibles)
    // - Jueves: Calicanto / Policlínica Turmero (12:00 pm - 4:00 pm bloqueado -> Tarde abre a las 16:00 -> 16:00, 17:00 disponibles)
    // - Viernes: Viernes Tarde no laborable (16:00 - 18:00 bloqueado -> Tarde 0)
    const candManana = [...SLOTS_MANANA];
    let candTarde = [];

    if (dayOfWeek === 3 || dayOfWeek === 4) {
        candTarde = [...SLOTS_TARDE];
    }

    // Descontar citas registradas en Supabase
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
