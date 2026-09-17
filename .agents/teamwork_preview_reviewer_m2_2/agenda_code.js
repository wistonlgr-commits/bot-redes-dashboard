const timezone = 'America/Caracas';
const now = new Date();
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});
const todayStr = dateFormatter.format(now);
const currentHourCaracas = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now), 10);

// Base date a mediodía Caracas para evitar desfasamiento
const baseDate = new Date(todayStr + 'T12:00:00-04:00');

// Slots candidatos exactos (:00)
// Presencial: Lunes a Viernes solo en la mañana (8 am a 11 am) en Uniaragua
const SLOTS_PRESENCIAL = ["08:00", "09:00", "10:00", "11:00"];
// Online: Exclusivamente Lunes y Jueves en la tarde (4 pm y 5 pm)
const SLOTS_ONLINE = ["16:00", "17:00"];

const ocupacionSupabase = {};
const diasBloqueadosCompletos = new Set();

// 1. RECOGER Y MAPEAR CITAS DE SUPABASE CON PARSER 12H/24H Y SOPORTE DE [BLOQUEO]
for (const lead of $input.all()) {
    const json = lead.json || {};
    const date = json.Dia_Cita;
    const timeRaw = (json.Hora_Cita || '').toString().trim();
    const nombreRaw = (json.Nombre || '').toString().trim();

    if (!date || date === '' || date < todayStr) continue;

    const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isBloqueo = nombreRaw.toUpperCase().startsWith('[BLOQUEO]');

    // Bloqueo explícito de día completo (por palabra clave o entrada [BLOQUEO] sin hora / con "TODO EL DIA")
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

    // Parsear hora 12h/24h a entero 0-23 (aplica a citas normales y bloqueos de slots específicos)
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
    const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb

    // Fines de semana: 100% Bloqueados
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
        continue;
    }

    // Bloqueo explícito de día completo desde Supabase
    if (diasBloqueadosCompletos.has(dateStr)) {
        reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Uniaragua): [Sin disponibilidad] | ONLINE: [Sin disponibilidad] (Bloqueado)`);
        continue;
    }

    // Reglas clínicas:
    // Presencial Uniaragua: Lunes a Viernes 08:00, 09:00, 10:00, 11:00.
    // Online: Solo Lunes (1) y Jueves (4) en la tarde: 16:00, 17:00.
    const candPresencial = [...SLOTS_PRESENCIAL];
    let candOnline = [];

    if (dayOfWeek === 1 || dayOfWeek === 4) {
        candOnline = [...SLOTS_ONLINE];
    }

    const ocupadas = ocupacionSupabase[dateStr] || new Set();
    let dispPresencial = candPresencial.filter(h => !ocupadas.has(h));
    let dispOnline = candOnline.filter(h => !ocupadas.has(h));

    // Si es HOY (i === 0), filtrar estrictamente las horas que ya pasaron según el reloj de Caracas
    if (i === 0) {
        dispPresencial = dispPresencial.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
        dispOnline = dispOnline.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
    }

    const presencialTxt = dispPresencial.length > 0 ? dispPresencial.join(', ') : 'Sin disponibilidad';
    const onlineTxt = dispOnline.length > 0 ? dispOnline.join(', ') : 'Sin disponibilidad';

    reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Mañanas en Uniaragua): [${presencialTxt}] | ONLINE (Tardes): [${onlineTxt}]`);
}

const txt = reporteDisponibilidad.join('\n');

return {
    agenda_disponible: txt,
    agenda_ocupada: txt
};