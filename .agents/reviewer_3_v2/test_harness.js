const vm = require("vm");

function runNodeScript(jsonInput, supabaseNodeInput, agendaNodeInput) {
    const context = {
        $json: jsonInput,
        $node: {
            "Refrescar Datos de Supabase": supabaseNodeInput || { json: {} },
            "Formatear Agenda": agendaNodeInput || { json: {} }
        },
        console: console,
        Intl: Intl,
        Date: Date,
        Math: Math,
        parseInt: parseInt,
        isNaN: isNaN,
        Array: Array,
        Object: Object,
        RegExp: RegExp,
        String: String
    };

    const code = "(function() {\n// =====================================================\n// ESCUDO VALIDADOR PRE-ENV\u00cdO (JavaScript Local, 0 Tokens)\n// Nodo: Formatear Respuesta (ID: 8fd94881-ca56-4855-8462-ef0109762964)\n// =====================================================\n\n// M\u00d3DULO 1: Desinfecci\u00f3n de Horarios en Media Hora (:30 -> :00) y Expresiones Verbales\nfunction sanitizeTimes(text) {\n  if (!text || typeof text !== 'string') return text;\n  let cleaned = text;\n  cleaned = cleaned.replace(/(\\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\\s*(?:am|pm|a\\.m\\.|p\\.m\\.|AM|PM|A\\.M\\.|P\\.M\\.))/gi, '$1:00$2');\n  cleaned = cleaned.replace(/(?<![\\d\\-])(\\b(?:[01]?\\d|2[0-3])):(?:15|20|30|45)\\b(?![\\d:\\-])/g, '$1:00');\n  cleaned = cleaned.replace(/(\\b(?:1[0-2]|0?[1-9]))\\s+y\\s+(?:media|30)\\b/gi, '$1:00');\n  return cleaned;\n}\n\n// M\u00d3DULO 2: B\u00fasqueda recursiva de texto en respuestas de n8n\nfunction findText(obj, depth) {\n  if (depth > 10) return \"\";\n  if (typeof obj === 'string' && obj.trim().length > 0) return obj;\n  if (Array.isArray(obj)) {\n    for (const item of obj) {\n      const found = findText(item, depth + 1);\n      if (found) return found;\n    }\n  }\n  if (typeof obj === 'object' && obj !== null) {\n    for (const val of Object.values(obj)) {\n      const found = findText(val, depth + 1);\n      if (found) return found;\n    }\n  }\n  return \"\";\n}\n\n// M\u00d3DULO 3: Extracci\u00f3n inicial e historial\nlet history = [];\ntry {\n  history = Array.isArray($node[\"Refrescar Datos de Supabase\"]?.json?.chat_history) ? [...$node[\"Refrescar Datos de Supabase\"].json.chat_history] : [];\n} catch (e) {\n  history = [];\n}\n\nlet fullResponse = \"\";\nif (typeof $json?.content === 'string' && $json.content.trim().length > 0) {\n  fullResponse = $json.content;\n} else if (typeof $json?.text === 'string' && $json.text.trim().length > 0) {\n  fullResponse = $json.text;\n} else {\n  fullResponse = findText($json, 0);\n}\n\nlet wasEmptyResponse = false;\nif (!fullResponse || fullResponse.trim() === \"\") {\n  fullResponse = \"Hola! Disculpa la demora, \u00bfen qu\u00e9 te podemos ayudar el d\u00eda de hoy?\";\n  wasEmptyResponse = true;\n}\n\nfullResponse = fullResponse.replace(/\\\\\\\\n/g, '\\n').replace(/\\\\n/g, '\\n').replace(/[ \\t]+/g, ' ').trim();\n\nlet botMsg = fullResponse;\nlet datosExtraidos = {\n  nombre: undefined, ciudad: undefined, motivo_consulta: undefined,\n  temperatura: undefined, resumen: undefined, dia_cita: undefined,\n  hora_cita: undefined, requiere_asistencia_humana: undefined\n};\n\nif (wasEmptyResponse) {\n  datosExtraidos.requiere_asistencia_humana = \"Respuesta de IA vac\u00eda - Fallback determinista activado\";\n}\n\n// M\u00d3DULO 4: Extracci\u00f3n y Limpieza de Bloque |||DATOS|||\nif (fullResponse.includes('|||DATOS|||')) {\n  const partes = fullResponse.split('|||DATOS|||');\n  botMsg = partes[0].trim();\n  let jsonStr = partes[1].trim();\n  jsonStr = jsonStr.replace(/^\\{\\{/, '{').replace(/\\}\\}$/, '}');\n  jsonStr = jsonStr.replace(/\\{\\{/g, '{').replace(/\\}\\}/g, '}');\n  jsonStr = jsonStr.replace(/```json\\s*/gi, '').replace(/```\\s*/gi, '').trim();\n\n  let parseOk = false;\n  try {\n    const datos = JSON.parse(jsonStr);\n    parseOk = true;\n    if ('nombre' in datos) datosExtraidos.nombre = datos.nombre || \"\";\n    if ('ciudad' in datos) datosExtraidos.ciudad = datos.ciudad || \"\";\n    if ('motivo_consulta' in datos) datosExtraidos.motivo_consulta = datos.motivo_consulta || \"\";\n    if ('temperatura' in datos) datosExtraidos.temperatura = datos.temperatura || \"\";\n    if ('resumen' in datos) datosExtraidos.resumen = datos.resumen || \"\";\n    if ('dia_cita' in datos) datosExtraidos.dia_cita = typeof datos.dia_cita === 'string' ? datos.dia_cita : \"\";\n    if ('hora_cita' in datos) datosExtraidos.hora_cita = typeof datos.hora_cita === 'string' ? datos.hora_cita : \"\";\n    if ('requiere_asistencia_humana' in datos) datosExtraidos.requiere_asistencia_humana = datos.requiere_asistencia_humana || \"\";\n  } catch (e) {}\n\n  if (!parseOk) {\n    try {\n      const extraer = (campo) => {\n        const regex = new RegExp('\"' + campo + '\"\\\\s*:\\\\s*\"([^\"]*)\"');\n        const match = jsonStr.match(regex);\n        return match ? match[1] : undefined;\n      };\n      const nombre = extraer('nombre');\n      const ciudad = extraer('ciudad');\n      const motivo = extraer('motivo_consulta');\n      const temp = extraer('temperatura');\n      const resumen = extraer('resumen');\n      const dia = extraer('dia_cita');\n      const hora = extraer('hora_cita');\n      const alerta = extraer('requiere_asistencia_humana');\n      if (nombre !== undefined) datosExtraidos.nombre = nombre;\n      if (ciudad !== undefined) datosExtraidos.ciudad = ciudad;\n      if (motivo !== undefined) datosExtraidos.motivo_consulta = motivo;\n      if (temp !== undefined) datosExtraidos.temperatura = temp;\n      if (resumen !== undefined) datosExtraidos.resumen = resumen;\n      if (dia !== undefined) datosExtraidos.dia_cita = dia;\n      if (hora !== undefined) datosExtraidos.hora_cita = hora;\n      if (alerta !== undefined) datosExtraidos.requiere_asistencia_humana = alerta;\n    } catch (e2) {}\n  }\n}\n\n// M\u00d3DULO 5: CONSOLIDACI\u00d3N CON BASE DE DATOS SUPABASE\nlet prevData = {};\ntry {\n  prevData = $node[\"Refrescar Datos de Supabase\"].json || {};\n} catch (e) {\n  prevData = {};\n}\n\nlet nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || \"\");\nlet ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || \"\");\nlet motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || \"\");\nlet temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || \"\");\nlet resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || \"\");\nlet dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || \"\");\nlet hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || \"\");\nlet alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || \"\");\n\nif (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {\n  alerta_final = \"\";\n}\n\n// M\u00d3DULO 6: ESCUDO VALIDADOR PRE-ENV\u00cdO\nbotMsg = sanitizeTimes(botMsg);\n\nif (hora_final) {\n  hora_final = sanitizeTimes(hora_final);\n}\n\nif (hora_final && hora_final.trim() !== \"\") {\n  let hRaw = hora_final.trim().toLowerCase();\n  let hour24 = null;\n  let minutesStr = \"00\";\n  const isPM = hRaw.includes('pm') || hRaw.includes('p.m.');\n  const isAM = hRaw.includes('am') || hRaw.includes('a.m.');\n  const clean = hRaw.replace(/(am|pm|a\\.m\\.|p\\.m\\.)/gi, '').trim();\n  const parts = clean.split(':');\n  if (parts.length >= 1) {\n    let h = parseInt(parts[0], 10);\n    if (!isNaN(h)) {\n      if (isPM && h < 12) h += 12;\n      if (isAM && h === 12) h = 0;\n      hour24 = h;\n    }\n  }\n  if (parts.length >= 2) {\n    minutesStr = parts[1].trim();\n  }\n  const validHours = [8, 9, 10, 11, 16, 17];\n  if (hour24 !== null && validHours.includes(hour24) && (minutesStr === \"00\" || minutesStr === \"0\" || minutesStr === \"\")) {\n    hora_final = hour24.toString().padStart(2, '0') + ':00';\n  } else {\n    if (!alerta_final) {\n      alerta_final = `Horario no permitido detectado (${hora_final}). Cita anulada para verificaci\u00f3n manual.`;\n    }\n    dia_final = \"\";\n    hora_final = \"\";\n  }\n}\n\nif ((dia_final || hora_final) && (!nombre_final || nombre_final.trim() === \"\")) {\n  if (!alerta_final) {\n    alerta_final = \"Intento de agendamiento sin nombre de paciente.\";\n  }\n  dia_final = \"\";\n  hora_final = \"\";\n}\n\nif (dia_final && dia_final.trim() !== \"\") {\n  dia_final = dia_final.trim();\n  const dateMatch = dia_final.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n  if (!dateMatch) {\n    dia_final = \"\";\n    hora_final = \"\";\n  } else {\n    const year = parseInt(dateMatch[1], 10);\n    const month = parseInt(dateMatch[2], 10) - 1;\n    const day = parseInt(dateMatch[3], 10);\n    const dateObj = new Date(Date.UTC(year, month, day, 12, 0, 0));\n    const dayOfWeek = dateObj.getUTCDay();\n    const timezone = 'America/Caracas';\n    const now = new Date();\n    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });\n    const todayStr = dateFormatter.format(now);\n\n    if (dia_final < todayStr) {\n      if (!alerta_final) alerta_final = \"Intento de agendamiento en fecha pasada.\";\n      dia_final = \"\";\n      hora_final = \"\";\n    } else if (dayOfWeek === 0 || dayOfWeek === 6) {\n      if (!alerta_final) alerta_final = \"Alucinaci\u00f3n de IA: Intent\u00f3 agendar en fin de semana (s\u00e1bado/domingo).\";\n      dia_final = \"\";\n      hora_final = \"\";\n      botMsg = botMsg.replace(/\\b(este\\s+|el\\s+)?(s\u00e1bado|sabado|domingo)\\b/gi, 'el lunes');\n    }\n  }\n}\n\ntry {\n  const agendaTxt = ($node[\"Formatear Agenda\"] && $node[\"Formatear Agenda\"].json && $node[\"Formatear Agenda\"].json.agenda_disponible) || \"\";\n  if (dia_final && hora_final && agendaTxt) {\n    const lines = agendaTxt.toString().split('\\n');\n    const dayLine = lines.find(l => l.includes(dia_final));\n    if (!dayLine) {\n      if (!alerta_final) alerta_final = `Fecha ${dia_final} no disponible en la agenda.`;\n      dia_final = \"\";\n      hora_final = \"\";\n    } else if (dayLine.toUpperCase().includes('NO LABORABLE')) {\n      if (!alerta_final) alerta_final = `D\u00eda ${dia_final} no laborable o sin cupo.`;\n      dia_final = \"\";\n      hora_final = \"\";\n    } else {\n      if (!dayLine.includes(hora_final)) {\n        if (!alerta_final) alerta_final = `Hora ${hora_final} no disponible para el ${dia_final}.`;\n        dia_final = \"\";\n        hora_final = \"\";\n      }\n    }\n  }\n} catch (eAgenda) {}\n\nbotMsg = botMsg.replace(/\\|\\|\\|DATOS\\|\\|\\|.*/gs, '').trim();\nbotMsg = botMsg.replace(/\\{\\{/g, '').replace(/\\}\\}/g, '').trim();\n\nif (!botMsg || botMsg.trim() === \"\") {\n  botMsg = \"Hola! Disculpa la demora, \u00bfen qu\u00e9 te podemos ayudar el d\u00eda de hoy?\";\n  if (!alerta_final) {\n    alerta_final = \"Respuesta de IA vac\u00eda - Fallback determinista activado\";\n  }\n}\n\nif (!Array.isArray(history)) {\n  history = [];\n}\nhistory.push({ role: \"assistant\", content: botMsg });\nif (history.length > 8) history = history.slice(history.length - 8);\nlet random_delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;\n\nreturn {\n  final_history: history,\n  bot_reply: botMsg,\n  delay: random_delay,\n  nombre: nombre_final,\n  ciudad: ciudad_final,\n  motivo_consulta: motivo_final,\n  temperatura: temp_final,\n  resumen: resumen_final,\n  dia_cita: dia_final,\n  hora_cita: hora_final,\n  requiere_asistencia_humana: alerta_final\n};\n\n})()";
    const script = new vm.Script(code);
    return script.runInNewContext(context);
}

console.log("=== ADVERSARIAL STRESS TEST SUITE ===");

let passed = 0;
let total = 0;

function assert(condition, name, details = '') {
    total++;
    if (condition) {
        passed++;
        console.log(`[PASS] ${name}`);
    } else {
        console.error(`[FAIL] ${name} - ${details}`);
    }
}

// 1. Short text acceptance in findText
const r1 = runNodeScript({ data: { message: "Ok" } });
assert(r1.bot_reply === "Ok", "findText accepts short text 'Ok'");

const r2 = runNodeScript({ response: "Sí" });
assert(r2.bot_reply === "Sí", "findText accepts short text 'Sí'");

// Priority check: content > text > findText
const r3 = runNodeScript({ content: "Content wins", text: "Text loses", nested: "Nested loses" });
assert(r3.bot_reply === "Content wins", "Priority $json.content");

const r4 = runNodeScript({ text: "Text wins", nested: "Nested loses" });
assert(r4.bot_reply === "Text wins", "Priority $json.text when content absent");

// 2. chat_history safety tests
const r5 = runNodeScript({ content: "Hi" }, { json: { chat_history: "string_val" } });
assert(Array.isArray(r5.final_history) && r5.final_history.length === 1, "chat_history handles string input gracefully");

const r6 = runNodeScript({ content: "Hi" }, { json: { chat_history: 12345 } });
assert(Array.isArray(r6.final_history) && r6.final_history.length === 1, "chat_history handles number input gracefully");

const r7 = runNodeScript({ content: "Hi" }, { json: { chat_history: [ { role: "user", content: "1" } ] } });
assert(r7.final_history.length === 2, "chat_history preserves existing array history");

// 3. Alert categorization accuracy
// 3a. NO LABORABLE
const agendaNL = { json: { agenda_disponible: "2026-08-03: NO LABORABLE" } };
const r8 = runNodeScript({ content: 'Ok |||DATOS||| {"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"09:00"}' }, { json: {} }, agendaNL);
assert(r8.requiere_asistencia_humana === "Día 2026-08-03 no laborable o sin cupo.", "Categorizes NO LABORABLE alert correctly", r8.requiere_asistencia_humana);

// 3b. Unlisted hour in agenda
const agendaPartial = { json: { agenda_disponible: "2026-08-03: 08:00, 09:00" } };
const r9 = runNodeScript({ content: 'Ok |||DATOS||| {"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"10:00"}' }, { json: {} }, agendaPartial);
assert(r9.requiere_asistencia_humana === "Hora 10:00 no disponible para el 2026-08-03.", "Categorizes unlisted hour alert correctly", r9.requiere_asistencia_humana);

// 3c. Unlisted hour in validHours rule (e.g. 15:00)
const r10 = runNodeScript({ content: 'Ok |||DATOS||| {"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"15:00"}' }, { json: {} }, agendaPartial);
assert(r10.requiere_asistencia_humana.includes("Horario no permitido detectado"), "Categorizes out-of-bounds business hour correctly", r10.requiere_asistencia_humana);

// 3d. Missing patient name
const r11 = runNodeScript({ content: 'Ok |||DATOS||| {"dia_cita":"2026-08-03","hora_cita":"08:00"}' }, { json: {} }, agendaPartial);
assert(r11.requiere_asistencia_humana === "Intento de agendamiento sin nombre de paciente.", "Categorizes missing patient name alert correctly", r11.requiere_asistencia_humana);

// 4. Output Contract
const r12 = runNodeScript({ content: "Test contract" });
const keys = Object.keys(r12);
assert(keys.length === 11, "Output object has exactly 11 keys");
const requiredKeys = [
    'final_history', 'bot_reply', 'delay', 'nombre', 'ciudad',
    'motivo_consulta', 'temperatura', 'resumen', 'dia_cita',
    'hora_cita', 'requiere_asistencia_humana'
];
const missingKeys = requiredKeys.filter(k => !(k in r12));
assert(missingKeys.length === 0, "All 11 required keys are present", missingKeys.join(', '));

console.log(`\nSummary: ${passed} / ${total} tests passed.`);
