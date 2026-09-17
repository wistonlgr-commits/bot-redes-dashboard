/**
 * ============================================================================
 * EMPIRICAL TEST HARNESS FOR BOT WHATSAPP WORKFLOW (QA 3)
 * Target Workflow: flujo asistente de whatsapp.json
 * Nodes Tested:
 *   1. Formatear Agenda (ID: 9d5ef635-9c04-433b-9a63-a4495b0dd7f9)
 *   2. Formatear Respuesta - Pre-send Validator Shield (ID: 8fd94881-ca56-4855-8462-ef0109762964)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// NODE 1: Formatear Agenda Function Simulation
// ----------------------------------------------------------------------------
function runFormatearAgenda(inputItems, mockDateStr = null) {
    const timezone = 'America/Caracas';
    const now = mockDateStr ? new Date(mockDateStr) : new Date();
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

    for (const item of inputItems) {
        const json = item.json || {};
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

// ----------------------------------------------------------------------------
// NODE 2: Formatear Respuesta (Pre-send Validator Shield) Simulation
// ----------------------------------------------------------------------------
function runFormatearRespuesta(context) {
    const {
        recibirWhatsAppNode,
        refrescarDatosNode,
        formatearAgendaNode,
        aiJsonInput,
        mockDate = null
    } = context;

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
        pacienteEntrada = recibirWhatsAppNode?.json?.body?.data?.message?.conversation 
            || recibirWhatsAppNode?.json?.body?.data?.message?.extendedTextMessage?.text 
            || "";
    } catch(e) {
        pacienteEntrada = "";
    }

    let history = [];
    try {
        history = Array.isArray(refrescarDatosNode?.json?.chat_history) ? [...refrescarDatosNode.json.chat_history] : [];
    } catch (e) {
        history = [];
    }

    let $json = aiJsonInput;
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
    fullResponse = fullResponse.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

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
        prevData = refrescarDatosNode.json || {};
    } catch (e) {
        prevData = {};
    }

    let nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
    let ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
    let motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
    let temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
    let resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");
    let dia_final = (datosExtraidos.dia_cita && datosExtraidos.dia_cita.trim() !== "") 
        ? datosExtraidos.dia_cita 
        : (prevData.Dia_Cita || "");

    let hora_final = (datosExtraidos.hora_cita && datosExtraidos.hora_cita.trim() !== "") 
        ? datosExtraidos.hora_cita 
        : (prevData.Hora_Cita || "");

    if (datosExtraidos.resumen && datosExtraidos.resumen.toLowerCase().includes('cancela')) {
        dia_final = "";
        hora_final = "";
    }
    let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");

    if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
        alerta_final = "";
    }

    // ESCUDO VALIDADOR PRE-ENVÍO
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
            const now = mockDate ? new Date(mockDate) : new Date();
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
        const agendaTxt = (formatearAgendaNode && formatearAgendaNode.agenda_disponible) || "";
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

    return {
        final_history: history,
        bot_reply: botMsg,
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
        entrada_paciente: pacienteEntrada
    };
}

// ============================================================================
// SUITE OF TEST CASES
// ============================================================================

const testResults = [];

function runTest(testId, testName, testFn) {
    console.log(`\n==================================================`);
    console.log(`RUNNING TEST [${testId}]: ${testName}`);
    console.log(`==================================================`);
    try {
        const res = testFn();
        console.log(`RESULT: PASS`);
        console.log(`DETAILS:`, JSON.stringify(res, null, 2));
        testResults.push({ id: testId, name: testName, status: 'PASS', details: res });
    } catch (e) {
        console.log(`RESULT: FAIL - ${e.message}`);
        testResults.push({ id: testId, name: testName, status: 'FAIL', error: e.message });
    }
}

// ----------------------------------------------------------------------------
// Test 1: Scenario (a.1) - Sunday Request asking for Sunday afternoon
// ----------------------------------------------------------------------------
runTest('SCENARIO_A_SUNDAY_SAME_DAY', 'Patient messaging on Sunday requesting Sunday afternoon appointment', () => {
    // Current date: Sunday 2026-07-26
    const mockSunday = '2026-07-26T14:00:00-04:00';
    const agenda = runFormatearAgenda([], mockSunday);

    // AI hallucination: tries to schedule Sunday 2026-07-26 at 16:00
    const aiOutput = {
        content: `Claro! Te puedo agendar para este domingo a las 4:00 pm.
|||DATOS|||
{"nombre": "Ana Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Solicita cita domingo", "dia_cita": "2026-07-26", "hora_cita": "16:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Hola quiero cita para hoy domingo en la tarde" } } } } },
        refrescarDatosNode: { json: { Nombre: "Ana Perez", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockSunday
    });

    // Verification assertions:
    // Should trigger ALUCINACION_FIN_DE_SEMANA, clear dia_cita and hora_cita, replace "domingo" with "el lunes".
    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "ALUCINACION_FIN_DE_SEMANA") throw new Error(`Expected ALUCINACION_FIN_DE_SEMANA, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 2: Scenario (a.2) - Sunday Request asking for Monday afternoon (which is blocked!)
// ----------------------------------------------------------------------------
runTest('SCENARIO_A_SUNDAY_MONDAY_AFTERNOON', 'Patient messaging on Sunday requesting Monday afternoon appointment (blocked)', () => {
    const mockSunday = '2026-07-26T14:00:00-04:00';
    const agenda = runFormatearAgenda([], mockSunday);

    // Monday afternoon is blocked in Formatear Agenda!
    // AI attempts to schedule Monday 2026-07-27 at 16:00
    const aiOutput = {
        content: `Te puedo agendar para el lunes a las 4:00 pm.
|||DATOS|||
{"nombre": "Ana Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Solicita cita lunes tarde", "dia_cita": "2026-07-27", "hora_cita": "16:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Quiero cita para el lunes en la tarde" } } } } },
        refrescarDatosNode: { json: { Nombre: "Ana Perez", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockSunday
    });

    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "FECHA_NO_DISPONIBLE") throw new Error(`Expected FECHA_NO_DISPONIBLE, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 3: Scenario (a.3) - Sunday Request correctly scheduled for Wednesday afternoon (First available)
// ----------------------------------------------------------------------------
runTest('SCENARIO_A_SUNDAY_WEDNESDAY_AFTERNOON', 'Patient messaging on Sunday scheduled for Wednesday 16:00 (first available afternoon)', () => {
    const mockSunday = '2026-07-26T14:00:00-04:00';
    const agenda = runFormatearAgenda([], mockSunday);

    // Wednesday afternoon 2026-07-29 at 16:00 is AVAILABLE!
    const aiOutput = {
        content: `Listo Ana! Quedo anotada tu cita para el miercoles 2026-07-29 a las 4:00 pm. Te esperamos!
|||DATOS|||
{"nombre": "Ana Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Cita confirmada miercoles tarde", "dia_cita": "2026-07-29", "hora_cita": "16:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Me sirve el miércoles en la tarde a las 4pm" } } } } },
        refrescarDatosNode: { json: { Nombre: "Ana Perez", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockSunday
    });

    if (res.has_quality_incident !== false) throw new Error("Expected no quality incident for valid slot");
    if (res.dia_cita !== "2026-07-29") throw new Error(`Expected dia_cita 2026-07-29, got ${res.dia_cita}`);
    if (res.hora_cita !== "16:00") throw new Error(`Expected hora_cita 16:00, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita,
        requiere_asistencia_humana: res.requiere_asistencia_humana
    };
});

// ----------------------------------------------------------------------------
// Test 4: Scenario (b) - Patient asking for an appointment at 12:30
// ----------------------------------------------------------------------------
runTest('SCENARIO_B_TIME_1230', 'Patient requesting appointment at 12:30 (half-hour & forbidden hour)', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    const agenda = runFormatearAgenda([], mockNow);

    // AI outputs 12:30 as hora_cita
    const aiOutput = {
        content: `Te puedo agendar para el miércoles a las 12:30 pm.
|||DATOS|||
{"nombre": "Juan Gomez", "ciudad": "Maracay", "motivo_consulta": "Dolor de piernas", "temperatura": "caliente", "resumen": "Pide 12:30", "dia_cita": "2026-07-29", "hora_cita": "12:30", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Tienen disponible a las 12:30?" } } } } },
        refrescarDatosNode: { json: { Nombre: "Juan Gomez", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    // Expect sanitizeTimes to turn 12:30 into 12:00, then hour 12 fails validHours check [8,9,10,11,16,17]
    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "ALUCINACION_HORARIO") throw new Error(`Expected ALUCINACION_HORARIO, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);
    if (!res.requiere_asistencia_humana.includes("Horario no permitido")) throw new Error(`Unexpected alert message: ${res.requiere_asistencia_humana}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 5: Scenario (c) - Returning patient with existing appointment (Gold Rule check)
// ----------------------------------------------------------------------------
runTest('SCENARIO_C_GOLD_RULE_EXISTING_APPOINTMENT', 'Returning patient who already has a scheduled appointment confirming their time', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    
    // Existing appointment in Supabase: Carlos Perez on 2026-07-29 at 09:00
    const globalAppointments = [
        { json: { Nombre: "Carlos Perez", Dia_Cita: "2026-07-29", Hora_Cita: "09:00" } }
    ];

    const agenda = runFormatearAgenda(globalAppointments, mockNow);

    // LLM receives patient data: Nombre: Carlos Perez, Cita Programada: 2026-07-29 a las 09:00
    // AI obeys Gold Rule and responds:
    const aiOutput = {
        content: `Hola Carlos! Si, tu cita es el 2026-07-29 a las 09:00. Te esperamos!
|||DATOS|||
{"nombre": "Carlos Perez", "ciudad": "Maracay", "motivo_consulta": "Control", "temperatura": "tibio", "resumen": "Paciente confirma cita existente", "dia_cita": "2026-07-29", "hora_cita": "09:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Hola, para confirmar mi cita de la próxima semana" } } } } },
        refrescarDatosNode: { json: { Nombre: "Carlos Perez", Ciudad: "Maracay", Dia_Cita: "2026-07-29", Hora_Cita: "09:00" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    console.log("   --> Check agenda output line for 2026-07-29:");
    const dayLine = agenda.agenda_disponible.split('\n').find(l => l.includes('2026-07-29'));
    console.log("       Day Line:", dayLine);
    console.log("   --> Pre-send Validator output:");
    console.log("       dia_cita:", res.dia_cita);
    console.log("       hora_cita:", res.hora_cita);
    console.log("       tipo_incidencia:", res.tipo_incidencia);
    console.log("       requiere_asistencia_humana:", res.requiere_asistencia_humana);

    // CRITICAL BUG DETECTION:
    // If Formatear Agenda stripped 09:00 from available slots because Carlos booked it,
    // Formatear Respuesta will see that 09:00 is NOT in dayLine and mark it as FECHA_NO_DISPONIBLE,
    // WIPING dia_cita and hora_cita to ""!
    const bugDetected = (res.dia_cita === "" && res.tipo_incidencia === "FECHA_NO_DISPONIBLE");

    return {
        bug_detected: bugDetected,
        bug_explanation: bugDetected ? "CRITICAL BUG: Formatear Agenda removed patient's own slot 09:00, causing Formatear Respuesta to invalidate and ERASE the patient's existing appointment from Supabase!" : "No bug detected",
        bot_reply: res.bot_reply,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana
    };
});

// ----------------------------------------------------------------------------
// Test 6: Edge Case 1 - Missing Patient Name
// ----------------------------------------------------------------------------
runTest('EDGE_CASE_MISSING_NAME', 'AI attempts to book appointment without patient name', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    const agenda = runFormatearAgenda([], mockNow);

    const aiOutput = {
        content: `Listo! Quedo anotada tu cita para el miercoles a las 10:00 am.
|||DATOS|||
{"nombre": "", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Agendado sin nombre", "dia_cita": "2026-07-29", "hora_cita": "10:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Listo apartame el miércoles a las 10" } } } } },
        refrescarDatosNode: { json: { Nombre: "", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "AGENDAMIENTO_SIN_NOMBRE") throw new Error(`Expected AGENDAMIENTO_SIN_NOMBRE, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 7: Edge Case 2 - Past Date
// ----------------------------------------------------------------------------
runTest('EDGE_CASE_PAST_DATE', 'AI attempts to book appointment in a past date', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    const agenda = runFormatearAgenda([], mockNow);

    const aiOutput = {
        content: `Listo Pedro! Quedo anotada tu cita para el 2026-07-20 a las 10:00 am.
|||DATOS|||
{"nombre": "Pedro Ruiz", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Fecha pasada", "dia_cita": "2026-07-20", "hora_cita": "10:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Quiero agendar para la semana pasada" } } } } },
        refrescarDatosNode: { json: { Nombre: "Pedro Ruiz", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "ALUCINACION_FECHA_PASADA") throw new Error(`Expected ALUCINACION_FECHA_PASADA, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 8: Edge Case 3 - Friday Afternoon Request
// ----------------------------------------------------------------------------
runTest('EDGE_CASE_FRIDAY_AFTERNOON', 'Patient requests Friday afternoon (16:00) when Friday afternoon is non-working', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    const agenda = runFormatearAgenda([], mockNow);

    // Friday 2026-07-31 afternoon is non-working in Formatear Agenda
    const aiOutput = {
        content: `Listo Maria! Te puedo agendar el viernes a las 4:00 pm.
|||DATOS|||
{"nombre": "Maria Lopez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Viernes tarde", "dia_cita": "2026-07-31", "hora_cita": "16:00", "requiere_asistencia_humana": ""}`
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Tienen cupo el viernes en la tarde?" } } } } },
        refrescarDatosNode: { json: { Nombre: "Maria Lopez", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "FECHA_NO_DISPONIBLE") throw new Error(`Expected FECHA_NO_DISPONIBLE, got ${res.tipo_incidencia}`);
    if (res.dia_cita !== "") throw new Error(`Expected empty dia_cita, got ${res.dia_cita}`);
    if (res.hora_cita !== "") throw new Error(`Expected empty hora_cita, got ${res.hora_cita}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana,
        dia_cita: res.dia_cita,
        hora_cita: res.hora_cita
    };
});

// ----------------------------------------------------------------------------
// Test 9: Edge Case 4 - Empty AI Output
// ----------------------------------------------------------------------------
runTest('EDGE_CASE_EMPTY_AI_OUTPUT', 'AI returns empty output string or null content', () => {
    const mockNow = '2026-07-27T09:00:00-04:00';
    const agenda = runFormatearAgenda([], mockNow);

    const aiOutput = {
        content: ""
    };

    const res = runFormatearRespuesta({
        recibirWhatsAppNode: { json: { body: { data: { message: { conversation: "Hola buenas tardes" } } } } },
        refrescarDatosNode: { json: { Nombre: "Luis Diaz", Ciudad: "Maracay" } },
        formatearAgendaNode: agenda,
        aiJsonInput: aiOutput,
        mockDate: mockNow
    });

    if (res.has_quality_incident !== true) throw new Error("Expected quality incident flag to be true");
    if (res.tipo_incidencia !== "RESPUESTA_VACIA_FALLBACK") throw new Error(`Expected RESPUESTA_VACIA_FALLBACK, got ${res.tipo_incidencia}`);
    if (res.bot_reply !== "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?") throw new Error(`Unexpected fallback text: ${res.bot_reply}`);

    return {
        bot_reply: res.bot_reply,
        tipo_incidencia: res.tipo_incidencia,
        requiere_asistencia_humana: res.requiere_asistencia_humana
    };
});

// Save test summary log
const logPath = path.join(__dirname, 'test_results.log');
fs.writeFileSync(logPath, JSON.stringify(testResults, null, 2), 'utf8');
console.log(`\nTest results written to ${logPath}`);
