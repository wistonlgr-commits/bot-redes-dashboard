// Test suite for Escudo Validador Pre-Envío

function runEscudo(inputJson, supabaseJson, agendaJson) {
  const $json = inputJson;
  const $node = {
    "Refrescar Datos de Supabase": { json: supabaseJson || {} },
    "Formatear Agenda": { json: agendaJson || {} }
  };

  // --- BEGIN CODE UNDER TEST ---
  function sanitizeTimes(text) {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;

    // 1. Horas 12h con AM/PM (ej: 8:30 am -> 8:00 am, 4:30 pm -> 4:00 pm, 12:30pm -> 12:00pm)
    cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '$1:00$2');

    // 2. Horas 24h o numérico simple (ej: 08:30 -> 08:00, 14:30 -> 14:00, 16:30 -> 16:00, 12:30 -> 12:00)
    cleaned = cleaned.replace(/(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![\d:\-])/g, '$1:00');

    // 3. Expresiones verbales en español (ej: "las 8 y 30" -> "las 8:00", "4 y media" -> "4:00")
    cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b/gi, '$1:00');

    return cleaned;
  }

  function findText(obj, depth) {
    if (depth > 5) return "";
    if (typeof obj === 'string' && obj.length > 15) return obj;
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

  let history = [];
  try {
    history = $node["Refrescar Datos de Supabase"].json.chat_history || [];
  } catch (e) {
    history = [];
  }

  let fullResponse = findText($json, 0);

  let wasEmptyResponse = false;
  if (!fullResponse || fullResponse.trim() === "") {
    fullResponse = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
    wasEmptyResponse = true;
  }

  fullResponse = fullResponse.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  let botMsg = fullResponse;
  let datosExtraidos = {
    nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
    temperatura: undefined, resumen: undefined, dia_cita: undefined,
    hora_cita: undefined, requiere_asistencia_humana: undefined
  };

  if (wasEmptyResponse) {
    datosExtraidos.requiere_asistencia_humana = "Respuesta de IA vacía - Fallback determinista activado";
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

  // Escudo Validador
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
      dia_final = "";
      hora_final = "";
    }
  }

  if ((dia_final || hora_final) && (!nombre_final || nombre_final.trim() === "")) {
    if (!alerta_final) {
      alerta_final = "Intento de agendamiento sin nombre de paciente.";
    }
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
      const now = new Date();
      const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayStr = dateFormatter.format(now);

      if (dia_final < todayStr) {
        if (!alerta_final) alerta_final = "Intento de agendamiento en fecha pasada.";
        dia_final = "";
        hora_final = "";
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (!alerta_final) alerta_final = "Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo).";
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
        dia_final = "";
        hora_final = "";
      } else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad')) {
        if (!dayLine.includes(hora_final)) {
          if (!alerta_final) alerta_final = `Día ${dia_final} no laborable o sin cupo.`;
          dia_final = "";
          hora_final = "";
        }
      } else {
        if (!dayLine.includes(hora_final)) {
          if (!alerta_final) alerta_final = `Hora ${hora_final} no disponible para el ${dia_final}.`;
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
  // --- END CODE UNDER TEST ---
}

// TEST CASES
let passed = 0;
let failed = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${JSON.stringify(details, null, 2)}`);
    failed++;
  }
}

// Test 1: Sanitize :30 to :00 in 12h format
{
  const input = { text: "Te puedo ofrecer cita para el lunes a las 8:30 am o a las 4:30 pm. |||DATOS|||\n{\"nombre\":\"Carlos\",\"dia_cita\":\"2026-07-27\",\"hora_cita\":\"08:30\"}" };
  const res = runEscudo(input, { Nombre: "Carlos" }, { agenda_disponible: "2026-07-27 (Lunes): [08:00, 09:00, 16:00]" });
  assert(res.bot_reply.includes("8:00 am") && res.bot_reply.includes("4:00 pm") && !res.bot_reply.includes("8:30"), "Test 1: Sanitize :30 to :00 in 12h format (bot_reply)");
  assert(res.hora_cita === "08:00", "Test 1: Sanitize hora_cita to 08:00", res);
}

// Test 2: Sanitize 24h format
{
  const input = { text: "Cita programada a las 16:30. |||DATOS|||\n{\"nombre\":\"Ana\",\"dia_cita\":\"2026-07-27\",\"hora_cita\":\"16:30\"}" };
  const res = runEscudo(input, { Nombre: "Ana" }, { agenda_disponible: "2026-07-27 (Lunes): [16:00, 17:00]" });
  assert(res.bot_reply.includes("16:00") && !res.bot_reply.includes("16:30"), "Test 2: Sanitize 16:30 to 16:00 in text");
  assert(res.hora_cita === "16:00", "Test 2: Sanitize hora_cita 16:30 to 16:00", res);
}

// Test 3: Sanitize Spanish verbal expressions ("las 8 y 30", "4 y media")
{
  const input = { text: "Nos vemos a las 8 y 30 o a las 4 y media. |||DATOS|||\n{\"nombre\":\"Luis\"}" };
  const res = runEscudo(input, { Nombre: "Luis" });
  assert(res.bot_reply.includes("8:00") && res.bot_reply.includes("4:00"), "Test 3: Sanitize Spanish verbal expressions");
}

// Test 4: Weekend appointment detection (2026-08-01 is Saturday)
{
  const input = { text: "Te agendé para el sábado 2026-08-01 a las 9:00 am. |||DATOS|||\n{\"nombre\":\"Maria\",\"dia_cita\":\"2026-08-01\",\"hora_cita\":\"09:00\"}" };
  const res = runEscudo(input, { Nombre: "Maria" });
  assert(res.dia_cita === "" && res.hora_cita === "", "Test 4: Weekend dia_cita and hora_cita cleared");
  assert(res.requiere_asistencia_humana.includes("fin de semana"), "Test 4: Weekend human assistance flag set", res);
  assert(res.bot_reply.includes("el lunes"), "Test 4: Saturday text replaced with Monday in bot_reply", res);
}

// Test 5: Empty Gemini response (Mute Guard Fallback)
{
  const input = { text: "" };
  const res = runEscudo(input, {});
  assert(res.bot_reply === "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?", "Test 5: Empty response fallback message");
  assert(res.requiere_asistencia_humana.includes("Respuesta de IA vacía"), "Test 5: Empty response flag", res);
}

// Test 6: Cleaning {{ }} templates and ```json ``` artifacts
{
  const input = { text: "Hola Pedro! |||DATOS|||\n```json\n{{\"nombre\": \"Pedro\", \"ciudad\": \"Maracay\"}}\n```" };
  const res = runEscudo(input, {});
  assert(res.nombre === "Pedro" && res.ciudad === "Maracay", "Test 6: Cleaned {{ }} and ```json ``` successfully");
  assert(!res.bot_reply.includes("DATOS"), "Test 6: DATOS tag stripped from bot_reply");
}

// Test 7: Booking without patient name
{
  const input = { text: "Cita para el 2026-07-27 a las 10:00. |||DATOS|||\n{\"dia_cita\":\"2026-07-27\",\"hora_cita\":\"10:00\"}" };
  const res = runEscudo(input, {}); // No prevData.Nombre either
  assert(res.dia_cita === "" && res.hora_cita === "", "Test 7: Appointment cleared when no patient name available");
}

// Test 8: Non-clinic hour (e.g. 14:00 / 2:00 pm)
{
  const input = { text: "Te atiendo a las 14:00. |||DATOS|||\n{\"nombre\":\"Juan\",\"dia_cita\":\"2026-07-27\",\"hora_cita\":\"14:00\"}" };
  const res = runEscudo(input, { Nombre: "Juan" });
  assert(res.dia_cita === "" && res.hora_cita === "", "Test 8: Unauthorized 14:00 hour appointment cleared");
  assert(res.requiere_asistencia_humana.includes("Horario no permitido"), "Test 8: Flag set for unauthorized hour");
}

// Test 9: Slot unavailable in agenda_disponible
{
  const input = { text: "Cita el 2026-07-27 a las 11:00 am. |||DATOS|||\n{\"nombre\":\"Sofia\",\"dia_cita\":\"2026-07-27\",\"hora_cita\":\"11:00\"}" };
  const res = runEscudo(input, { Nombre: "Sofia" }, { agenda_disponible: "2026-07-27 (Lunes): [08:00, 09:00]" }); // 11:00 not listed
  assert(res.dia_cita === "" && res.hora_cita === "", "Test 9: Slot not in agenda cleared");
  assert(res.requiere_asistencia_humana.includes("no disponible"), "Test 9: Slot not available alert set");
}

// Test 10: Output Structure Completeness
{
  const input = { text: "Hola! |||DATOS|||\n{\"nombre\":\"Test\"}" };
  const res = runEscudo(input, {});
  const expectedKeys = ['final_history', 'bot_reply', 'delay', 'nombre', 'ciudad', 'motivo_consulta', 'temperatura', 'resumen', 'dia_cita', 'hora_cita', 'requiere_asistencia_humana'];
  const hasAllKeys = expectedKeys.every(k => k in res);
  assert(hasAllKeys, "Test 10: Output object has all 11 required keys");
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
