// =====================================================
// CÓDIGO CORREGIDO PARA "Formatear Respuesta"
// FIX: Limpia doble llaves {{ }} antes de parsear JSON
// FIX: Fallback regex extrae TODOS los campos, no solo 3
// =====================================================

// Busca texto recursivamente en cualquier estructura JSON
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

let history = $node["Refrescar Datos de Supabase"].json.chat_history || [];
let fullResponse = findText($json, 0);

if (!fullResponse) {
  fullResponse = "Hola! en qué te puedo ayudar?";
}

fullResponse = fullResponse.replace(/\\\\n/g, ' ').replace(/\\n/g, ' ').replace(/  +/g, ' ').trim();

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

  // ══════════════════════════════════════════════
  // FIX 1: Limpiar doble llaves {{ }} → { }
  // La IA a veces copia el template del prompt con {{ }}
  // ══════════════════════════════════════════════
  jsonStr = jsonStr.replace(/^\{\{/, '{').replace(/\}\}$/, '}');
  // También limpiar si hay {{ }} internos sueltos
  jsonStr = jsonStr.replace(/\{\{/g, '{').replace(/\}\}/g, '}');

  // Limpiar posibles bloques de código markdown
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
  } catch (e) {
    // JSON.parse falló, usar fallback regex
  }

  // ══════════════════════════════════════════════
  // FIX 2: Fallback regex COMPLETO para TODOS los campos
  // Se ejecuta si JSON.parse falló
  // ══════════════════════════════════════════════
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

const prevData = $node["Refrescar Datos de Supabase"].json || {};
const nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
const ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
const motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
const temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
const resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");

// FIX CRÍTICO: Si la IA manda dia_cita como string vacío "", respetamos ese vacío para borrar la cita.
const dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
const hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");
let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");
if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
  alerta_final = "";
}

history.push({ role: "assistant", content: botMsg });
if (history.length > 8) history = history.slice(history.length - 8);

let random_delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;

// Trampa para atrapar a la IA cuando se queda muda
if (botMsg === undefined || botMsg.trim() === "") {
    throw new Error("🚨 ALERTA: La IA se quedó muda. No generó texto, solo el JSON.");
}

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
