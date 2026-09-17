/**
 * Repaso QA 3 - Empirical Verification Script
 * Simulates nodes: Formatear Agenda, Cerebro IA prompt rules, and Formatear Respuesta (Pre-send Validator Shield)
 */

const fs = require('fs');
const path = require('path');

// Load production workflow JSON
const workflowPath = path.join(__dirname, '..', '..', 'flujo asistente de whatsapp.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// Extract code nodes
const formatearAgendaNode = workflow.nodes.find(n => n.name === 'Formatear Agenda');
const cerebroIaNode = workflow.nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');
const formatearRespuestaNode = workflow.nodes.find(n => n.name === 'Formatear Respuesta');

console.log("=== REPASO QA 3 EMPIRICAL SIMULATION ===");

// ----------------------------------------------------
// TEST CASE (a): Patient messaging on Sunday requesting afternoon appointment
// ----------------------------------------------------
console.log("\n--- TEST CASE (a): Sunday Afternoon Request ---");

// Simulate Formatear Agenda output on a Sunday
function runFormatearAgenda(simulatedNow) {
    const timezone = 'America/Caracas';
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const todayStr = dateFormatter.format(simulatedNow);
    const baseDate = new Date(todayStr + 'T12:00:00-04:00');

    const SLOTS_MANANA = ["08:00", "09:00", "10:00", "11:00"];
    const SLOTS_TARDE = ["16:00", "17:00"];
    const ocupacionSupabase = {};
    const diasBloqueadosCompletos = new Set();

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

    return reporteDisponibilidad.join('\n');
}

// Sunday date: 2026-07-26
const sundayDate = new Date('2026-07-26T14:00:00-04:00');
const agendaOutputSunday = runFormatearAgenda(sundayDate);
console.log("Agenda Output for Sunday 2026-07-26 (first 5 lines):");
console.log(agendaOutputSunday.split('\n').slice(0, 5).join('\n'));

// Dynamic Rule on Sunday (dia === 0)
const diaSunday = 0; // Sunday
const dynamicRuleSunday = (diaSunday === 0 || diaSunday === 6) 
  ? 'HOY ES FIN DE SEMANA. Citas para la próxima semana (lunes a viernes). Puedes ofrecer disponibilidad en la MAÑANA (8:00 am a 12:00 pm) y en la TARDE (4:00 pm y 5:00 pm, respetando bloqueos de agenda).'
  : 'HOY ES DÍA DE SEMANA...';
console.log("Dynamic Prompt Rule on Sunday:", dynamicRuleSunday);

// ----------------------------------------------------
// TEST CASE (b): Patient requesting 12:30 appointment
// ----------------------------------------------------
console.log("\n--- TEST CASE (b): Request for 12:30 Appointment ---");

function sanitizeTimes(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '$1:00$2');
  cleaned = cleaned.replace(/(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![d:\-])/g, '$1:00');
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b/gi, '$1:00');
  return cleaned;
}

function testValidatorShield(botReply, horaCitaInput, diaCitaInput, agendaTxt) {
    let botMsg = sanitizeTimes(botReply);
    let hora_final = horaCitaInput ? sanitizeTimes(horaCitaInput) : "";
    let dia_final = diaCitaInput || "";
    let alerta_final = "";
    let detectedIncidentType = "";

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

    return {
        botMsg,
        dia_final,
        hora_final,
        alerta_final,
        detectedIncidentType,
        has_quality_incident: !!detectedIncidentType
    };
}

console.log("Sanitize '12:30 pm':", sanitizeTimes("Te aparto a las 12:30 pm"));
console.log("Shield test for hora_cita='12:30 pm':", testValidatorShield("Te anoté a las 12:30 pm", "12:30 pm", "2026-07-27", agendaOutputSunday));

// ----------------------------------------------------
// TEST CASE (c): Existing Patient with Active Appointment
// ----------------------------------------------------
console.log("\n--- TEST CASE (c): Existing Patient State Preservation ---");

function simulateFormatearRespuestaStatePreservation(jsonFromAI, prevDataFromSupabase) {
    let datosExtraidos = {
      nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
      temperatura: undefined, resumen: undefined, dia_cita: undefined,
      hora_cita: undefined, requiere_asistencia_humana: undefined
    };

    if ('nombre' in jsonFromAI) datosExtraidos.nombre = jsonFromAI.nombre || "";
    if ('ciudad' in jsonFromAI) datosExtraidos.ciudad = jsonFromAI.ciudad || "";
    if ('motivo_consulta' in jsonFromAI) datosExtraidos.motivo_consulta = jsonFromAI.motivo_consulta || "";
    if ('temperatura' in jsonFromAI) datosExtraidos.temperatura = jsonFromAI.temperatura || "";
    if ('resumen' in jsonFromAI) datosExtraidos.resumen = jsonFromAI.resumen || "";
    if ('dia_cita' in jsonFromAI) datosExtraidos.dia_cita = typeof jsonFromAI.dia_cita === 'string' ? jsonFromAI.dia_cita : "";
    if ('hora_cita' in jsonFromAI) datosExtraidos.hora_cita = typeof jsonFromAI.hora_cita === 'string' ? jsonFromAI.hora_cita : "";
    if ('requiere_asistencia_humana' in jsonFromAI) datosExtraidos.requiere_asistencia_humana = jsonFromAI.requiere_asistencia_humana || "";

    let prevData = prevDataFromSupabase || {};

    let nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
    let ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
    let motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
    let temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
    let resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");
    let dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
    let hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");

    return {
        dia_final,
        hora_final,
        original_dia: prevData.Dia_Cita,
        original_hora: prevData.Hora_Cita,
        was_appointment_erased: (prevData.Dia_Cita && !dia_final)
    };
}

const existingPatientData = {
    Nombre: "Carlos Rodriguez",
    Ciudad: "Maracay",
    Motivo_Consulta: "Pie Diabetico",
    Dia_Cita: "2026-07-29",
    Hora_Cita: "09:00"
};

// Scenario C1: Existing patient sends message "Hola, donde quedan ubicados?"
// AI outputs JSON: { "nombre": "Carlos Rodriguez", "ciudad": "Maracay", "motivo_consulta": "Pie Diabetico", "temperatura": "frio", "resumen": "Consulta ubicacion", "dia_cita": "", "hora_cita": "", "requiere_asistencia_humana": "" }
const aiOutputGeneralQuery = {
    nombre: "Carlos Rodriguez",
    ciudad: "Maracay",
    motivo_consulta: "Pie Diabetico",
    temperatura: "frio",
    resumen: "Consulta ubicacion",
    dia_cita: "",
    hora_cita: "",
    requiere_asistencia_humana: ""
};

const resultC1 = simulateFormatearRespuestaStatePreservation(aiOutputGeneralQuery, existingPatientData);
console.log("Existing Patient General Query Result:", resultC1);
