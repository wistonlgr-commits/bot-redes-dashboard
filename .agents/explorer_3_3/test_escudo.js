const fs = require('fs');

// Mock n8n context data
function runShieldTest(jsonPayload, prevSupabaseData, agendaDisponibleTxt) {
  const $json = jsonPayload;
  const $node = {
    "Refrescar Datos de Supabase": { json: prevSupabaseData },
    "Formatear Agenda": { json: { agenda_disponible: agendaDisponibleTxt } }
  };

  // --- BEGIN ESCUDO CODE ---
  let history = $node["Refrescar Datos de Supabase"].json.chat_history || [];

  function findText(obj, depth) {
    if (depth > 5) return "";
    if (typeof obj === 'string' && obj.length > 20) return obj;
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

  let fullResponse = findText($json, 0);
  if (!fullResponse) {
    fullResponse = "Hola! en qué te puedo ayudar?";
  }

  fullResponse = fullResponse.replace(/\\n/g, ' ').replace(/  +/g, ' ').trim();
  let botMsg = fullResponse;

  let datosExtraidos = {
    nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
    temperatura: undefined, resumen: undefined, dia_cita: undefined,
    hora_cita: undefined, requiere_asistencia_humana: undefined
  };

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
        datosExtraidos.nombre = extraer('nombre');
        datosExtraidos.ciudad = extraer('ciudad');
        datosExtraidos.motivo_consulta = extraer('motivo_consulta');
        datosExtraidos.temperatura = extraer('temperatura');
        datosExtraidos.resumen = extraer('resumen');
        datosExtraidos.dia_cita = extraer('dia_cita');
        datosExtraidos.hora_cita = extraer('hora_cita');
        datosExtraidos.requiere_asistencia_humana = extraer('requiere_asistencia_humana');
      } catch (e2) {}
    }
  }

  const prevData = $node["Refrescar Datos de Supabase"].json || {};
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

  // ESCUDO VALIDADOR PRE-ENVÍO
  if ((dia_final || hora_final) && (!nombre_final || nombre_final.trim() === "")) {
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
      const timezone = 'America/Caracas';
      const now = new Date();
      const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayStr = dateFormatter.format(now);

      if (dia_final < todayStr) {
        dia_final = "";
        hora_final = "";
      } else {
        const dateObj = new Date(dia_final + 'T12:00:00Z');
        const dayOfWeek = dateObj.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          dia_final = "";
          hora_final = "";
        }
      }
    }
  }

  if (hora_final && hora_final.trim() !== "") {
    let hRaw = hora_final.trim().toLowerCase();
    let hour24 = null;
    let minutesStr = "00";
    const isPM = hRaw.includes('pm');
    const isAM = hRaw.includes('am');
    const clean = hRaw.replace(/(am|pm)/g, '').trim();
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
      dia_final = "";
      hora_final = "";
    }
  }

  const agendaTxt = ($node["Formatear Agenda"].json.agenda_disponible || "").toString();
  if (dia_final && hora_final && agendaTxt) {
    const lines = agendaTxt.split('\n');
    const dayLine = lines.find(l => l.includes(dia_final));
    if (!dayLine) {
      dia_final = "";
      hora_final = "";
    } else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad')) {
      if (!dayLine.includes(hora_final)) {
        dia_final = "";
        hora_final = "";
      }
    } else {
      if (!dayLine.includes(hora_final)) {
        dia_final = "";
        hora_final = "";
      }
    }
  }

  if (!botMsg || botMsg.trim() === "") {
    throw new Error("🚨 ALERTA: La IA se quedó muda. No generó texto, solo el JSON.");
  }

  history.push({ role: "assistant", content: botMsg });
  if (history.length > 8) history = history.slice(history.length - 8);
  let random_delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;

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
    requiere_asistencia_humana: alerta_final
  };
  // --- END ESCUDO CODE ---
}

// Sample Agenda
const mockAgenda = `- 2026-07-27: MAÑANA DISPONIBLE: [08:00, 09:00] | TARDE DISPONIBLE: [Sin disponibilidad]
- 2026-07-28: MAÑANA DISPONIBLE: [10:00, 11:00] | TARDE DISPONIBLE: [Sin disponibilidad]
- 2026-07-29: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [16:00, 17:00]
- 2026-08-01 (Fin de semana): NO LABORABLE`;

console.log("--- TEST 1: Valid Cita on 2026-07-27 at 08:00 with Name ---");
const t1 = runShieldTest(
  "Perfecto Carlos! Quedo anotada tu cita para el 2026-07-27 a las 8:00 am. |||DATOS||| {{ \"nombre\": \"Carlos Gomez\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-07-27\", \"hora_cita\": \"8:00 am\" }}",
  { Nombre: "Carlos Gomez" },
  mockAgenda
);
console.log("T1 Output:", { dia_cita: t1.dia_cita, hora_cita: t1.hora_cita });

console.log("\n--- TEST 2: Hallucinated Hour (08:30) ---");
const t2 = runShieldTest(
  "Te aparte a las 8:30 am! |||DATOS||| {{ \"nombre\": \"Carlos Gomez\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-07-27\", \"hora_cita\": \"08:30\" }}",
  { Nombre: "Carlos Gomez" },
  mockAgenda
);
console.log("T2 Output (Should be cleared):", { dia_cita: t2.dia_cita, hora_cita: t2.hora_cita });

console.log("\n--- TEST 3: Occupied Hour (10:00 on 2026-07-27 - only 08:00 and 09:00 available) ---");
const t3 = runShieldTest(
  "Te aparte a las 10:00 am! |||DATOS||| {{ \"nombre\": \"Carlos Gomez\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-07-27\", \"hora_cita\": \"10:00\" }}",
  { Nombre: "Carlos Gomez" },
  mockAgenda
);
console.log("T3 Output (Should be cleared):", { dia_cita: t3.dia_cita, hora_cita: t3.hora_cita });

console.log("\n--- TEST 4: Weekend Cita (2026-08-01) ---");
const t4 = runShieldTest(
  "Te aparte el sabado! |||DATOS||| {{ \"nombre\": \"Carlos Gomez\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-08-01\", \"hora_cita\": \"08:00\" }}",
  { Nombre: "Carlos Gomez" },
  mockAgenda
);
console.log("T4 Output (Should be cleared):", { dia_cita: t4.dia_cita, hora_cita: t4.hora_cita });

console.log("\n--- TEST 5: Cita without Patient Name ---");
const t5 = runShieldTest(
  "Te aparte a las 8:00 am! |||DATOS||| {{ \"nombre\": \"\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-07-27\", \"hora_cita\": \"08:00\" }}",
  { Nombre: "" },
  mockAgenda
);
console.log("T5 Output (Should be cleared):", { dia_cita: t5.dia_cita, hora_cita: t5.hora_cita });

console.log("\nAll 5 tests completed successfully!");
