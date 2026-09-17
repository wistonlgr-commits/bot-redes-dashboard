// =====================================================
// ESCUDO VALIDADOR PRE-ENVÍO & PASO 4 QUALITY LOG PAYLOAD
// Nodo: Formatear Respuesta (ID: 8fd94881-ca56-4855-8462-ef0109762964)
// =====================================================

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

// Extracción de la entrada original del paciente
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
  prevData = $node["Refrescar Datos de Supabase"].json || {};
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

// Si el paciente cancela explícitamente (detectado por el IA o resumen)
if (datosExtraidos.resumen && datosExtraidos.resumen.toLowerCase().includes('cancela')) {
  dia_final = "";
  hora_final = "";
}
let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");

if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
  alerta_final = "";
}

// MÓDULO 6: ESCUDO VALIDADOR PRE-ENVÍO
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
    const now = new Date();
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
let random_delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;

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

  // Campos para Paso 4: Autoaprendizaje Asincrónico
  has_quality_incident: !!detectedIncidentType,
  tipo_incidencia: detectedIncidentType || "",
  respuesta_raw: rawAIOutput,
  entrada_paciente: pacienteEntrada,
  metadata_log: metadata_log
};
