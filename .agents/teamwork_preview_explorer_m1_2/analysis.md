# Analysis Report: Formatear Agenda & Formatear Respuesta Inspection

**Target File**: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`  
**Explorer**: Explorer 2 (Milestone 1)  
**Date**: 2026-07-29  

---

## Executive Summary

This report presents a thorough investigation of the JavaScript execution nodes `Formatear Agenda` (Node ID: `9d5ef635-9c04-433b-9a63-a4495b0dd7f9`) and `Formatear Respuesta` (Node ID: `8fd94881-ca56-4855-8462-ef0109762964`) within the n8n WhatsApp bot workflow.

- **`Formatear Agenda`**: Currently parses scheduled lead records from Supabase and calculates a 14-day availability report. We have analyzed its existing slot rules, time parsing, timezone filtering, and non-working day mechanisms, and formulated the precise JavaScript enhancements needed to support `[BLOQUEO]` prefix entries from Supabase.
- **`Formatear Respuesta`**: Preserves the "Escudo Validador" pre-response sanitizer and async quality incident logger (`has_quality_incident`). We verified its full operational integrity and confirmed that no code modifications are required for this node.

---

## 1. Examination of Node `Formatear Agenda`

- **Node Name**: `Formatear Agenda`
- **Node ID**: `9d5ef635-9c04-433b-9a63-a4495b0dd7f9`
- **Node Type**: `n8n-nodes-base.code` (v2)
- **Position in Workflow**: Line 908-919 in JSON workflow. Connected after `Refrescar Datos de Supabase` and prior to `Cerebro Inteligencia Artificial`.

### Current Availability Calculation Logic Breakdown

1. **Candidate Slot Definitions**:
   - **Presencial (Uniaragua, Maracay)**: `SLOTS_PRESENCIAL = ["08:00", "09:00", "10:00", "11:00"]`. Available Monday through Friday in the morning.
   - **Online**: `SLOTS_ONLINE = ["16:00", "17:00"]`. Available **exclusively** on Mondays (`dayOfWeek === 1`) and Thursdays (`dayOfWeek === 4`) in the afternoon.

2. **Caracas Time Zone & Current Hour Filtering**:
   - Timezone hardcoded to `'America/Caracas'` (UTC-4).
   - Formats current date using `Intl.DateTimeFormat` (`en-CA`, `YYYY-MM-DD`).
   - Obtains `currentHourCaracas` using `Intl.DateTimeFormat` (`en-US`, 24h format).
   - On day `i = 0` (today), any slot where `parseInt(slotHour) <= currentHourCaracas` is strictly filtered out so past hours are never offered to patients.

3. **14-Day Availability Generation Window**:
   - Loops `i = 0` to `13` (14 consecutive days starting today).
   - Base date set to noon Caracas (`T12:00:00-04:00`) to prevent DST or midnight date rolling drift.
   - Checks `getUTCDay()` on UTC noon instance of date string (`0 = Sunday`, `6 = Saturday`).

4. **Time Parsing Logic (`parseTimeTo24hHour`)**:
   - Converts 12h/24h raw string formats into integer `0-23`.
   - Handles `am`, `pm`, `a.m.`, `p.m.` (case-insensitive, removes periods).
   - Converts `12:00 PM` to `12`, `12:00 AM` to `0`, `4:00 PM` to `16`, `9:00 AM` to `9`.
   - Formats return value as padded string `HH:00` (e.g., `"09:00"`, `"16:00"`).

5. **Non-Working Days & Day Blocking Mechanisms**:
   - **Weekends**: Saturday (`dayOfWeek === 6`) and Sunday (`dayOfWeek === 0`) are automatically output as `- YYYY-MM-DD (Fin de semana): NO LABORABLE`.
   - **Full-day blocks (`diasBloqueadosCompletos`)**: Triggered when `Hora_Cita` contains keywords: `todo el dia`, `toda la semana`, `bloqueado`, `vacaciones`, `no laborable` (normalized using NFD to handle accents). Output format: `- YYYY-MM-DD: PRESENCIAL (Uniaragua): [Sin disponibilidad] | ONLINE: [Sin disponibilidad] (Bloqueado)`.

---

## 2. Formulated JS Changes for `[BLOQUEO]` Support in Supabase

### Business Requirement
Doctor/admin can create entries in Supabase `leads` table to manually block schedule:
- **`Nombre` starting with `[BLOQUEO]`** (case-insensitive, e.g., `"[BLOQUEO] Quirófano"`, `"[bloqueo] Vacaciones"`, `"[BLOQUEO]"`).
- **`Hora_Cita` = `"TODO EL DIA"`** (or empty/undefined or containing keywords like `todo el dia`) $\rightarrow$ block the entire day.
- **`Hora_Cita` = Specific time** (e.g. `"09:00"`, `"9:00 AM"`, `"16:00"`) $\rightarrow$ block that specific time slot on that date while leaving remaining slots open.
- **Normal lead entries** (without `[BLOQUEO]`) must continue to block their scheduled slot as before.

### Modified Input Loop Code (`Formatear Agenda`)

```javascript
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
```

### Complete Proposed `jsCode` for `Formatear Agenda`

```javascript
// =====================================================
// CÓDIGO ACTUALIZADO PARA EL NODO "Formatear Agenda"
// Separación Estricta: Presencial (Mañana) vs Online (Tarde)
// Soporte para Registros [BLOQUEO] de Supabase
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
```

---

## 3. Test Matrix & Scenario Evaluation

| Scenario | Lead `Nombre` | Lead `Dia_Cita` | Lead `Hora_Cita` | Expected Behavior |
|---|---|---|---|---|
| 1. Regular Appointment | `"Ana Maria"` | `"2026-08-05"` | `"09:00"` | `"09:00"` added to `ocupacionSupabase["2026-08-05"]`. Slot 09:00 blocked. Remaining slots (08:00, 10:00, 11:00) open. |
| 2. Full Day Block (Explicit keyword) | `"Carlos"` | `"2026-08-05"` | `"TODO EL DIA"` | `diasBloqueadosCompletos.add("2026-08-05")`. Entire day marked `[Sin disponibilidad] (Bloqueado)`. |
| 3. Full Day Block (`[BLOQUEO]` prefix + empty time) | `"[BLOQUEO] Quirófano"` | `"2026-08-06"` | `""` | `isBloqueo` = `true`. Entire day `2026-08-06` blocked. |
| 4. Full Day Block (`[BLOQUEO]` + "TODO EL DIA") | `"[bloqueo] Vacaciones"` | `"2026-08-07"` | `"Todo el día"` | `isBloqueo` = `true`, `timeLower` = `"todo el dia"`. Entire day `2026-08-07` blocked. |
| 5. Specific Slot Block (`[BLOQUEO]` prefix) | `"[BLOQUEO] Consulta externa"` | `"2026-08-06"` | `"10:00 AM"` | `isBloqueo` = `true`, `parseTimeTo24hHour` returns `10`. Only `10:00` slot blocked on `2026-08-06`. |

---

## 4. Examination of Node `Formatear Respuesta`

- **Node Name**: `Formatear Respuesta`
- **Node ID**: `8fd94881-ca56-4855-8462-ef0109762964`
- **Node Type**: `n8n-nodes-base.code` (v2)
- **Position in Workflow**: Line 337-340 in JSON workflow. Connected after AI response generation.

### Key Logic Verification

1. **`sanitizeTimes` Function**:
   - Lines 344-351 in JSON.
   - Replaces non-zero minutes (`:15`, `:20`, `:30`, `:45`) with `:00` in bot replies.
   - Also converts `"8 y media"` or `"9 y 30"` to `:00` equivalents to maintain strict `:00` slot consistency.

2. **Quality Incident Detection (`has_quality_incident`)**:
   - Lines 524-540 in JSON.
   - `has_quality_incident: !!detectedIncidentType` returns a boolean flag (`true`/`false`).
   - Includes full metadata payload (`tipo_incidencia`, `respuesta_raw`, `entrada_paciente`, `metadata_log`).
   - Accurately captures incidents such as `ALUCINACION_HORARIO`, `AGENDAMIENTO_SIN_NOMBRE`, `ALUCINACION_FECHA_PASADA`, `ALUCINACION_FIN_DE_SEMANA`, `FECHA_NO_DISPONIBLE`, and `RESPUESTA_VACIA_FALLBACK`.

### Integrity Assessment
The Escudo Validador JS code in `Formatear Respuesta` is 100% complete, uncorrupted, and meets all architectural requirements specified in `PROJECT.md`. **No changes are needed or recommended for this node.**

---

## 5. Verification Method

To verify these changes during implementation (Milestone 3 / Milestone 4):
1. Parse the workflow JSON with Python `json.load()` to confirm valid JSON structure.
2. Extract `parameters.jsCode` from `Formatear Agenda` and run NodeJS unit tests with sample input datasets containing regular leads, `[BLOQUEO]` entries with specific hours, and `[BLOQUEO]` entries with `"TODO EL DIA"`.
3. Verify that `Formatear Respuesta` retains its 9 incident classification paths and exact return object signature.
