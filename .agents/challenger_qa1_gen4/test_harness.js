// Empirical Test Harness for Formatear Agenda and Pre-send Validator Shield
// Directory: c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_qa1_gen4\test_harness.js

const fs = require('fs');
const path = require('path');

// --- Extracted logic from n8n nodes ---

function runFormatearAgenda(inputItems, nowOverride = new Date()) {
    const $input = {
        all: () => inputItems || []
    };

    const timezone = 'America/Caracas';
    const now = nowOverride;
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

        if (!date || date === '' || date < todayStr) continue;

        const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
        const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();

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

function runPreSendValidatorShield(params) {
    const {
        aiOutputStr,
        recibirWhatsappNode = { json: {} },
        refrescarSupabaseNode = { json: {} },
        formatearAgendaNode = { json: {} },
        nowOverride = new Date()
    } = params;

    const $node = {
        "Recibir WhatsApp": recibirWhatsappNode,
        "Refrescar Datos de Supabase": refrescarSupabaseNode,
        "Formatear Agenda": formatearAgendaNode
    };

    const $json = { content: aiOutputStr };

    function sanitizeTimes(text) {
        if (!text || typeof text !== 'string') return text;
        let cleaned = text;
        cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '$1:00$2');
        cleaned = cleaned.replace(/(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![\d:\-])/g, '$1:00');
        cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b/gi, '$1:00');
        return cleaned;
    }

    function findText(obj, depth) {
        if (depth > 10) return "";
        if (typeof obj === 'string' && obj.trim().length > 0) return obj;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = findText(item, depth + 1);
                if (found) return found;
            }
        }
        if (typeof obj === 'object' && obj !== null) {
            for (const val of Object.values(obj)) {
                const found = findText(val, depth + 1);
                if (found) return found;
            }
        }
        return "";
    }

    let pacienteEntrada = "";
    try {
        pacienteEntrada = $node["Recibir WhatsApp"]?.json?.body?.data?.message?.conversation 
            || $node["Recibir WhatsApp"]?.json?.body?.data?.message?.extendedTextMessage?.text 
            || "";
    } catch(e) {
        pacienteEntrada = "";
    }

    let history = [];
    try {
        history = Array.isArray($node["Refrescar Datos de Supabase"]?.json?.chat_history) ? [...$node["Refrescar Datos de Supabase"].json.chat_history] : [];
    } catch (e) {
        history = [];
    }

    let fullResponse = "";
    if (typeof $json?.content === 'string' && $json.content.trim().length > 0) {
        fullResponse = $json.content;
    } else if (typeof $json?.text === 'string' && $json.text.trim().length > 0) {
        fullResponse = $json.text;
    } else {
        fullResponse = findText($json, 0);
    }

    let wasEmptyResponse = false;
    if (!fullResponse || fullResponse.trim() === "") {
        fullResponse = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
        wasEmptyResponse = true;
    }

    let rawAIOutput = fullResponse;
    fullResponse = fullResponse.replace(/\\n/g, '\n').replace(/\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

    let botMsg = fullResponse;
    let datosExtraidos = {
        nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
        temperatura: undefined, resumen: undefined, dia_cita: undefined,
        hora_cita: undefined, requiere_asistencia_humana: undefined
    };

    let detectedIncidentType = "";

    if (wasEmptyResponse) {
        datosExtraidos.requiere_asistencia_humana = "Respuesta de IA vacía - Fallback determinista activado";
        detectedIncidentType = "RESPUESTA_VACIA_FALLBACK";
    }

    if (fullResponse.includes('|||DATOS|||')) {
        const partes = fullResponse.split('|||DATOS|||');
        botMsg = partes[0].trim();
        let jsonStr = partes[1].trim();
        jsonStr = jsonStr.replace(/^\{\{/, '{').replace(/\}\}$/, '}');
        jsonStr = jsonStr.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
        jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

        let parseOk = false;
        try {
            const datos = JSON.parse(jsonStr);
            parseOk = true;
            if ('nombre' in datos) datosExtraidos.nombre = datos.nombre || "";
            if ('ciudad' in datos) datosExtraidos.ciudad = datos.ciudad || "";
            if ('motivo_consulta' in datos) datosExtraidos.motivo_consulta = datos.motivo_consulta || "";
            if ('temperatura' in datos) datosExtraidos.temperatura = datos.temperatura || "";
            if ('resumen' in datos) datosExtraidos.resumen = datos.resumen || "";
            if ('dia_cita' in datos) datosExtraidos.dia_cita = typeof datos.dia_cita === 'string' ? datos.dia_cita : "";
            if ('hora_cita' in datos) datosExtraidos.hora_cita = typeof datos.hora_cita === 'string' ? datos.hora_cita : "";
            if ('requiere_asistencia_humana' in datos) datosExtraidos.requiere_asistencia_humana = datos.requiere_asistencia_humana || "";
        } catch (e) {}

        if (!parseOk) {
            try {
                const extraer = (campo) => {
                    const regex = new RegExp('"' + campo + '"\\s*:\\s*"([^"]*)"');
                    const match = jsonStr.match(regex);
                    return match ? match[1] : undefined;
                };
                const nombre = extraer('nombre');
                const ciudad = extraer('ciudad');
                const motivo = extraer('motivo_consulta');
                const temp = extraer('temperatura');
                const resumen = extraer('resumen');
                const dia = extraer('dia_cita');
                const hora = extraer('hora_cita');
                const alerta = extraer('requiere_asistencia_humana');
                if (nombre !== undefined) datosExtraidos.nombre = nombre;
                if (ciudad !== undefined) datosExtraidos.ciudad = ciudad;
                if (motivo !== undefined) datosExtraidos.motivo_consulta = motivo;
                if (temp !== undefined) datosExtraidos.temperatura = temp;
                if (resumen !== undefined) datosExtraidos.resumen = resumen;
                if (dia !== undefined) datosExtraidos.dia_cita = dia;
                if (hora !== undefined) datosExtraidos.hora_cita = hora;
                if (alerta !== undefined) datosExtraidos.requiere_asistencia_humana = alerta;
            } catch (e2) {}
        }
    }

    let prevData = {};
    try {
        prevData = $node["Refrescar Datos de Supabase"].json || {};
    } catch (e) {
        prevData = {};
    }

    let nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
    let ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
    let motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
    let temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
    let resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");
    let dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
    let hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");
    let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");

    if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
        alerta_final = "";
    }

    botMsg = sanitizeTimes(botMsg);

    if (hora_final) {
        hora_final = sanitizeTimes(hora_final);
    }

    if (hora_final && hora_final.trim() !== "") {
        let hRaw = hora_final.trim().toLowerCase();
        let hour24 = null;
        let minutesStr = "00";
        const isPM = hRaw.includes('pm') || hRaw.includes('p.m.');
        const isAM = hRaw.includes('am') || hRaw.includes('a.m.');
        const clean = hRaw.replace(/(am|pm|a\.m\.|p\.m\.)/gi, '').trim();
        const parts = clean.split(':');
        if (parts.length >= 1) {
            let h = parseInt(parts[0], 10);
            if (!isNaN(h)) {
                if (isPM && h < 12) h += 12;
                if (isAM && h === 12) h = 0;
                hour24 = h;
            }
        }
        if (parts.length >= 2) {
            minutesStr = parts[1].trim();
        }
        const validHours = [8, 9, 10, 11, 16, 17];
        if (hour24 !== null && validHours.includes(hour24) && (minutesStr === "00" || minutesStr === "0" || minutesStr === "")) {
            hora_final = hour24.toString().padStart(2, '0') + ':00';
        } else {
            if (!alerta_final) {
                alerta_final = `Horario no permitido detectado (${hora_final}). Cita anulada para verificación manual.`;
            }
            if (!detectedIncidentType) detectedIncidentType = "ALUCINACION_HORARIO";
            dia_final = "";
            hora_final = "";
        }
    }

    if ((dia_final || hora_final) && (!nombre_final || nombre_final.trim() === "")) {
        if (!alerta_final) {
            alerta_final = "Intento de agendamiento sin nombre de paciente.";
        }
        if (!detectedIncidentType) detectedIncidentType = "AGENDAMIENTO_SIN_NOMBRE";
        dia_final = "";
        hora_final = "";
    }

    if (dia_final && dia_final.trim() !== "") {
        dia_final = dia_final.trim();
        const dateMatch = dia_final.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
            dia_final = "";
            hora_final = "";
        } else {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const day = parseInt(dateMatch[3], 10);
            const dateObj = new Date(Date.UTC(year, month, day, 12, 0, 0));
            const dayOfWeek = dateObj.getUTCDay();
            const timezone = 'America/Caracas';
            const now = nowOverride;
            const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
            const todayStr = dateFormatter.format(now);

            if (dia_final < todayStr) {
                if (!alerta_final) alerta_final = "Intento de agendamiento en fecha pasada.";
                if (!detectedIncidentType) detectedIncidentType = "ALUCINACION_FECHA_PASADA";
                dia_final = "";
                hora_final = "";
            } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (!alerta_final) alerta_final = "Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo).";
                if (!detectedIncidentType) detectedIncidentType = "ALUCINACION_FIN_DE_SEMANA";
                dia_final = "";
                hora_final = "";
                botMsg = botMsg.replace(/\b(este\s+|el\s+)?(sábado|sabado|domingo)\b/gi, 'el lunes');
            }
        }
    }

    try {
        const agendaTxt = ($node["Formatear Agenda"] && $node["Formatear Agenda"].json && $node["Formatear Agenda"].json.agenda_disponible) || "";
        if (dia_final && hora_final && agendaTxt) {
            const lines = agendaTxt.toString().split('\n');
            const dayLine = lines.find(l => l.includes(dia_final));
            if (!dayLine) {
                if (!alerta_final) alerta_final = `Fecha ${dia_final} no disponible en la agenda.`;
                if (!detectedIncidentType) detectedIncidentType = "FECHA_NO_DISPONIBLE";
                dia_final = "";
                hora_final = "";
            } else if (dayLine.toUpperCase().includes('NO LABORABLE')) {
                if (!alerta_final) alerta_final = `Día ${dia_final} no laborable o sin cupo.`;
                if (!detectedIncidentType) detectedIncidentType = "FECHA_NO_DISPONIBLE";
                dia_final = "";
                hora_final = "";
            } else {
                if (!dayLine.includes(hora_final)) {
                    if (!alerta_final) alerta_final = `Hora ${hora_final} no disponible para el ${dia_final}.`;
                    if (!detectedIncidentType) detectedIncidentType = "FECHA_NO_DISPONIBLE";
                    dia_final = "";
                    hora_final = "";
                }
            }
        }
    } catch (eAgenda) {}

    botMsg = botMsg.replace(/\|\|\|DATOS\|\|\|.*/gs, '').trim();
    botMsg = botMsg.replace(/\{\{/g, '').replace(/\}\}/g, '').trim();

    if (!botMsg || botMsg.trim() === "") {
        botMsg = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
        if (!alerta_final) {
            alerta_final = "Respuesta de IA vacía - Fallback determinista activado";
        }
        if (!detectedIncidentType) detectedIncidentType = "RESPUESTA_VACIA_FALLBACK";
    }

    if (alerta_final && !detectedIncidentType) {
        const alertLower = alerta_final.toLowerCase();
        if (alertLower.includes('reagendar') || alertLower.includes('reagendamiento') || alertLower.includes('50%')) {
            detectedIncidentType = "REAGENDAMIENTO_POLITICA";
        } else if (alertLower.includes('inasistencia') || alertLower.includes('no asistió') || alertLower.includes('no-show')) {
            detectedIncidentType = "INASISTENCIA_NOSHOW";
        } else {
            detectedIncidentType = "ASISTENCIA_HUMANA_REQUERIDA";
        }
    }

    if (!Array.isArray(history)) {
        history = [];
    }
    history.push({ role: "assistant", content: botMsg });
    if (history.length > 8) history = history.slice(history.length - 8);
    let random_delay = 4000;

    const metadata_log = {
        nombre_paciente: nombre_final,
        ciudad: ciudad_final,
        motivo_consulta: motivo_final,
        temperatura: temp_final,
        dia_cita_intentado: datosExtraidos.dia_cita || "",
        hora_cita_intentada: datosExtraidos.hora_cita || "",
        alerta_detalle: alerta_final || "",
        was_empty_response: wasEmptyResponse,
        agenda_disponible: ($node["Formatear Agenda"]?.json?.agenda_disponible) || ""
    };

    return {
        final_history: history,
        bot_reply: botMsg,
        delay: random_delay,
        nombre: nombre_final,
        ciudad: ciudad_final,
        motivo_consulta: motivo_final,
        temperatura: temp_final,
        resumen: resumen_final,
        dia_cita: dia_final,
        hora_cita: hora_final,
        requiere_asistencia_humana: alerta_final,
        has_quality_incident: !!detectedIncidentType,
        tipo_incidencia: detectedIncidentType || "",
        respuesta_raw: rawAIOutput,
        entrada_paciente: pacienteEntrada,
        metadata_log: metadata_log
    };
}

// --- Test Suite Execution ---

const results = [];

function assert(description, condition, details = "") {
    const status = condition ? "PASS" : "FAIL";
    results.push({ description, status, details });
    console.log(`[${status}] ${description} ${details ? '- ' + details : ''}`);
}

// Fixed reference date: Monday 2026-07-27
const refNow = new Date('2026-07-27T12:00:00-04:00');

console.log("=================================================");
console.log("RUNNING EMPIRICAL TEST SUITE FOR REPASO QA 1");
console.log("=================================================\n");

// TEST GROUP 1: Formatear Agenda Logic
console.log("--- TEST GROUP 1: Formatear Agenda ---");
const agendaOutput = runFormatearAgenda([], refNow);
const agendaLines = agendaOutput.agenda_disponible.split('\n');

// TC 1.1: Weekend Dates -> 0 available hours
let weekendPass = true;
let weekendDetails = [];
agendaLines.forEach(line => {
    if (line.includes('Fin de semana')) {
        if (!line.includes('NO LABORABLE')) weekendPass = false;
        if (line.includes('08:00') || line.includes('16:00')) weekendPass = false;
        weekendDetails.push(line);
    }
});
assert("TC 1.1: Weekend dates (Saturday/Sunday) return 0 available hours", weekendPass, weekendDetails.join(' | '));

// TC 1.2: Friday Afternoon Slots -> Must block afternoon hours for Dr. Trejo
const fridayLine = agendaLines.find(l => l.includes('2026-07-31')); // Friday 2026-07-31
const fridayAfternoonBlocked = fridayLine && fridayLine.includes('TARDE DISPONIBLE: [Sin disponibilidad]');
assert("TC 1.2: Friday afternoon slots return [Sin disponibilidad] (blocked)", fridayAfternoonBlocked, fridayLine);

// TC 1.3: Clinic Blockings
// Monday (Ambulatorio del Norte): Afternoon blocked
const mondayLine = agendaLines.find(l => l.includes('2026-07-27'));
const mondayAfternoonBlocked = mondayLine && mondayLine.includes('TARDE DISPONIBLE: [Sin disponibilidad]');
assert("TC 1.3a: Monday afternoon blocked (Ambulatorio del Norte)", mondayAfternoonBlocked, mondayLine);

// Tuesday (Más Salud): Afternoon blocked
const tuesdayLine = agendaLines.find(l => l.includes('2026-07-28'));
const tuesdayAfternoonBlocked = tuesdayLine && tuesdayLine.includes('TARDE DISPONIBLE: [Sin disponibilidad]');
assert("TC 1.3b: Tuesday afternoon blocked (Más Salud)", tuesdayAfternoonBlocked, tuesdayLine);

// Wednesday (Prevaler): Afternoon available at 16:00, 17:00
const wednesdayLine = agendaLines.find(l => l.includes('2026-07-29'));
const wednesdayAfternoonOk = wednesdayLine && wednesdayLine.includes('TARDE DISPONIBLE: [16:00, 17:00]');
assert("TC 1.3c: Wednesday afternoon opens 16:00, 17:00 (Prevaler block 12-4pm)", wednesdayAfternoonOk, wednesdayLine);

// Thursday (Calicanto / Policlínica Turmero): Afternoon available at 16:00, 17:00
const thursdayLine = agendaLines.find(l => l.includes('2026-07-30'));
const thursdayAfternoonOk = thursdayLine && thursdayLine.includes('TARDE DISPONIBLE: [16:00, 17:00]');
assert("TC 1.3d: Thursday afternoon opens 16:00, 17:00 (Calicanto block 12-4pm)", thursdayAfternoonOk, thursdayLine);

// TC 1.4: Half-hour Queries in Agenda -> must never produce a :30 output slot
const hasHalfHour = agendaOutput.agenda_disponible.includes(':30') || agendaOutput.agenda_disponible.includes(':15') || agendaOutput.agenda_disponible.includes(':45');
assert("TC 1.4: Agenda output never produces half-hour (:30) slots", !hasHalfHour, "Checked all lines in agenda_disponible");

// TC 1.5: Agenda discounting Supabase appointments
const mockSupabaseLeads = [
    { json: { Dia_Cita: '2026-07-29', Hora_Cita: '08:00' } },
    { json: { Dia_Cita: '2026-07-29', Hora_Cita: '16:00' } }
];
const agendaWithBookings = runFormatearAgenda(mockSupabaseLeads, refNow);
const wednesdayBookedLine = agendaWithBookings.agenda_disponible.split('\n').find(l => l.includes('2026-07-29'));
const slotDiscounted = wednesdayBookedLine && !wednesdayBookedLine.includes('08:00') && wednesdayBookedLine.includes('09:00') && wednesdayBookedLine.includes('17:00') && !wednesdayBookedLine.includes('16:00');
assert("TC 1.5: Agenda correctly discounts occupied Supabase slots", slotDiscounted, wednesdayBookedLine);


// TEST GROUP 2: Pre-send Validator Shield Output Filtering
console.log("\n--- TEST GROUP 2: Pre-send Validator Shield ---");

// TC 2.1: Weekend date booking attempt -> Erases dia/hora, flags ALUCINACION_FIN_DE_SEMANA, rewrites msg
const SaturdayAiOutput = `Hola María! Te agendé para el sábado a las 09:00 am.
|||DATOS|||
{"nombre":"María Pérez","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Cita sábado","dia_cita":"2026-08-01","hora_cita":"09:00","requiere_asistencia_humana":""}`;

const satRes = runPreSendValidatorShield({
    aiOutputStr: SaturdayAiOutput,
    refrescarSupabaseNode: { json: { Nombre: 'María Pérez' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.1a: Weekend booking nullifies dia_cita", satRes.dia_cita === "", `Got: '${satRes.dia_cita}'`);
assert("TC 2.1b: Weekend booking nullifies hora_cita", satRes.hora_cita === "", `Got: '${satRes.hora_cita}'`);
assert("TC 2.1c: Weekend booking flags ALUCINACION_FIN_DE_SEMANA", satRes.tipo_incidencia === "ALUCINACION_FIN_DE_SEMANA", `Got: '${satRes.tipo_incidencia}'`);
assert("TC 2.1d: Weekend booking rewrites 'sábado' to 'el lunes' in bot reply", satRes.bot_reply.includes('el lunes') && !satRes.bot_reply.includes('sábado'), `Reply: '${satRes.bot_reply}'`);

// TC 2.2: Friday afternoon booking attempt -> Erases dia/hora, flags FECHA_NO_DISPONIBLE
const fridayAfternoonAiOutput = `Hola Pedro! Cita anotada para el viernes a las 4:00 pm.
|||DATOS|||
{"nombre":"Pedro López","ciudad":"Maracay","motivo_consulta":"Dolor","temperatura":"caliente","resumen":"Cita viernes tarde","dia_cita":"2026-07-31","hora_cita":"16:00","requiere_asistencia_humana":""}`;

const friRes = runPreSendValidatorShield({
    aiOutputStr: fridayAfternoonAiOutput,
    refrescarSupabaseNode: { json: { Nombre: 'Pedro López' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.2a: Friday afternoon booking nullifies dia_cita", friRes.dia_cita === "", `Got: '${friRes.dia_cita}'`);
assert("TC 2.2b: Friday afternoon booking nullifies hora_cita", friRes.hora_cita === "", `Got: '${friRes.hora_cita}'`);
assert("TC 2.2c: Friday afternoon booking flags FECHA_NO_DISPONIBLE", friRes.tipo_incidencia === "FECHA_NO_DISPONIBLE", `Got incident: '${friRes.tipo_incidencia}', alert: '${friRes.requiere_asistencia_humana}'`);

// TC 2.3: Monday afternoon booking attempt (Ambulatorio del Norte blocked)
const mondayAfternoonAiOutput = `Hola Juan! Te agendé para el lunes a las 4:00 pm.
|||DATOS|||
{"nombre":"Juan Gómez","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Cita lunes tarde","dia_cita":"2026-07-27","hora_cita":"16:00","requiere_asistencia_humana":""}`;

const monRes = runPreSendValidatorShield({
    aiOutputStr: mondayAfternoonAiOutput,
    refrescarSupabaseNode: { json: { Nombre: 'Juan Gómez' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.3: Monday afternoon booking blocked and flagged FECHA_NO_DISPONIBLE", monRes.dia_cita === "" && monRes.tipo_incidencia === "FECHA_NO_DISPONIBLE", `Got incident: '${monRes.tipo_incidencia}'`);

// TC 2.4: Half-hour AI Output (e.g. asking for 12:30 or 14:30 or 09:30)
// Case 2.4a: hora_cita = 12:30 (Not in valid hours 8,9,10,11,16,17)
const halfHour1230Output = `Te queda mejor a las 12:30 pm?
|||DATOS|||
{"nombre":"Carlos Ruiz","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Consulta 12:30","dia_cita":"2026-07-29","hora_cita":"12:30","requiere_asistencia_humana":""}`;

const hh1230Res = runPreSendValidatorShield({
    aiOutputStr: halfHour1230Output,
    refrescarSupabaseNode: { json: { Nombre: 'Carlos Ruiz' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.4a: Invalid slot 12:30 rejected and flagged ALUCINACION_HORARIO", hh1230Res.dia_cita === "" && hh1230Res.tipo_incidencia === "ALUCINACION_HORARIO", `Got incident: '${hh1230Res.tipo_incidencia}', alert: '${hh1230Res.requiere_asistencia_humana}'`);

// Case 2.4b: Text sanitation converts "10:30 am" to "10:00 am" in message
const halfHourTextOutput = `Perfecto, te agendo a las 10:30 am.
|||DATOS|||
{"nombre":"Ana Díaz","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Cita 10am","dia_cita":"2026-07-29","hora_cita":"10:00","requiere_asistencia_humana":""}`;

const hhTextRes = runPreSendValidatorShield({
    aiOutputStr: halfHourTextOutput,
    refrescarSupabaseNode: { json: { Nombre: 'Ana Díaz' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.4b: Text sanitation converts '10:30 am' to '10:00 am' in reply", hhTextRes.bot_reply.includes('10:00 am') && !hhTextRes.bot_reply.includes('10:30'), `Bot reply: '${hhTextRes.bot_reply}'`);

// Case 2.4c: hora_cita = 09:30 (Hour 9 is valid, but minutes :30 invalid)
const halfHour0930Output = `Perfecto! Cita anotada a las 9:30 am.
|||DATOS|||
{"nombre":"Ana Díaz","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Cita 9:30","dia_cita":"2026-07-29","hora_cita":"09:30","requiere_asistencia_humana":""}`;

const hh0930Res = runPreSendValidatorShield({
    aiOutputStr: halfHour0930Output,
    refrescarSupabaseNode: { json: { Nombre: 'Ana Díaz' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.4c: Slot 09:30 rejected due to minutes :30 and flagged ALUCINACION_HORARIO", hh0930Res.dia_cita === "" && hh0930Res.hora_cita === "" && hh0930Res.tipo_incidencia === "ALUCINACION_HORARIO", `Got incident: '${hh0930Res.tipo_incidencia}'`);

// TC 2.5: Valid booking (Wednesday at 09:00 am) -> Passes through cleanly
const validWednesdayOutput = `Listo Ana! Quedó anotada tu cita para el 2026-07-29 a las 09:00 am.
|||DATOS|||
{"nombre":"Ana Díaz","ciudad":"Maracay","motivo_consulta":"Várices","temperatura":"caliente","resumen":"Cita confirmada","dia_cita":"2026-07-29","hora_cita":"09:00","requiere_asistencia_humana":""}`;

const validRes = runPreSendValidatorShield({
    aiOutputStr: validWednesdayOutput,
    refrescarSupabaseNode: { json: { Nombre: 'Ana Díaz' } },
    formatearAgendaNode: agendaOutput,
    nowOverride: refNow
});

assert("TC 2.5a: Valid booking preserves dia_cita (2026-07-29)", validRes.dia_cita === "2026-07-29", `Got: '${validRes.dia_cita}'`);
assert("TC 2.5b: Valid booking preserves hora_cita (09:00)", validRes.hora_cita === "09:00", `Got: '${validRes.hora_cita}'`);
assert("TC 2.5c: Valid booking has no incident", validRes.has_quality_incident === false, `Incident: '${validRes.tipo_incidencia}'`);

// Write JSON report summary
const summaryFile = path.join(__dirname, 'test_results.json');
fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
console.log(`\nTest execution complete. Results saved to ${summaryFile}`);
