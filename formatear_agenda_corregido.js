// =====================================================
// CÓDIGO CORREGIDO PARA EL NODO "Formatear Agenda"
// NO depende de nombres. Agrupa por día y cuenta horas.
// =====================================================

const now = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
const todayStr = now.toISOString().split('T')[0];

// Objeto para agrupar TODAS las horas ocupadas por fecha
const ocupadoPorDia = {};

// ─────────────────────────────────────────────
// 1. RECOGER TODAS LAS CITAS Y BLOQUEOS DE LA BD
// ─────────────────────────────────────────────
for (const lead of $input.all()) {
    const date = lead.json.Dia_Cita;
    const time = (lead.json.Hora_Cita || '').trim();

    if (!date || date < todayStr || date === '') continue;

    if (!ocupadoPorDia[date]) {
        ocupadoPorDia[date] = { horas: [], todoElDia: false };
    }

    const timeLower = time.toLowerCase();

    // Bloqueo explícito de día completo o semana completa
    if (timeLower.includes('todo el dia') || timeLower.includes('toda la semana')) {
        ocupadoPorDia[date].todoElDia = true;
        continue;
    }

    // Parsear la hora numérica
    if (time) {
        const parts = time.split(':');
        if (parts.length >= 2) {
            const hora = parseInt(parts[0], 10);
            if (!isNaN(hora)) {
                ocupadoPorDia[date].horas.push(hora);
            }
        }
    }
}

// ─────────────────────────────────────────────
// 2. BLOQUEOS FIJOS DEL DOCTOR (próximos 14 días)
// ─────────────────────────────────────────────
const bloqueosFijos = {};
for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split('T')[0];

    if (dayOfWeek === 0) {
        bloqueosFijos[dateStr] = 'DÍA COMPLETO BLOQUEADO (Domingo)';
    } else if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 5) {
        bloqueosFijos[dateStr] = 'BLOQUEADO desde 12:00 pm en adelante (NO agendar en la tarde)';
    } else if (dayOfWeek === 4) {
        bloqueosFijos[dateStr] = 'BLOQUEADO de 12:00 pm a 3:30 pm (solo disponible antes de 12pm o después de 3:30pm)';
    }
}

// ─────────────────────────────────────────────
// 3. GENERAR SALIDA INTELIGENTE AGRUPADA
// ─────────────────────────────────────────────
let occupied = [];

for (const [fecha, info] of Object.entries(ocupadoPorDia)) {

    // Bloqueo explícito de día completo
    if (info.todoElDia) {
        occupied.push(`- ${fecha} ⛔ TODO EL DÍA BLOQUEADO`);
        continue;
    }

    // Contar horas únicas
    const horasUnicas = [...new Set(info.horas)].sort((a, b) => a - b);

    if (horasUnicas.length === 0) continue;

    // Separar mañana (8-11) y tarde (12+)
    const horasManana = horasUnicas.filter(h => h >= 8 && h < 12);
    const horasTarde = horasUnicas.filter(h => h >= 12);

    const mananaLlena = horasManana.length >= 4;  // 8,9,10,11
    const tardeLlena = horasTarde.length >= 4;

    // 7+ horas = día completo lleno
    if (horasUnicas.length >= 7 || (mananaLlena && tardeLlena)) {
        occupied.push(`- ${fecha} ⛔ TODO EL DÍA BLOQUEADO (agenda llena)`);
        continue;
    }

    // Solo mañana llena
    if (mananaLlena) {
        occupied.push(`- ${fecha} ⛔ MAÑANA COMPLETA (8am-12pm llenas)`);
        for (const h of horasTarde) {
            occupied.push(`- ${fecha} ⛔ OCUPADO de ${h.toString().padStart(2,'0')}:00 a ${(h+1).toString().padStart(2,'0')}:00`);
        }
        continue;
    }

    // Solo tarde llena
    if (tardeLlena) {
        for (const h of horasManana) {
            occupied.push(`- ${fecha} ⛔ OCUPADO de ${h.toString().padStart(2,'0')}:00 a ${(h+1).toString().padStart(2,'0')}:00`);
        }
        occupied.push(`- ${fecha} ⛔ TARDE COMPLETA (desde 12pm llena)`);
        continue;
    }

    // Caso normal: pocas horas ocupadas → listar individual
    for (const h of horasUnicas) {
        occupied.push(`- ${fecha} ⛔ OCUPADO de ${h.toString().padStart(2,'0')}:00 a ${(h+1).toString().padStart(2,'0')}:00`);
    }
}

// Agregar bloqueos fijos sin duplicar días ya completamente bloqueados
for (const [fecha, mensaje] of Object.entries(bloqueosFijos)) {
    const yaCompleto = occupied.some(line =>
        line.includes(fecha) && line.includes('TODO EL DÍA')
    );
    if (!yaCompleto) {
        occupied.push(`- ${fecha} ⛔ ${mensaje}`);
    }
}

// Ordenar cronológicamente
occupied.sort();

let txt = occupied.length > 0 ? occupied.join('\n') : 'Agenda libre';
return { agenda_ocupada: txt };
