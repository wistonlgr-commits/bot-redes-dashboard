const fs = require('fs');

// Read workflow JSON
const flow = JSON.parse(fs.readFileSync('c:/Users/Leor/Desktop/bot whatsapp/flujo asistente de whatsapp.json', 'utf8'));

// Extract JS code of Formatear Respuesta
const node = flow.nodes.find(n => n.name === 'Formatear Respuesta');
const jsCode = node.parameters.jsCode;

function runNode(inputJson, supabaseData, agendaData) {
  const $json = inputJson;
  const $node = {
    "Refrescar Datos de Supabase": { json: supabaseData || {} },
    "Formatear Agenda": { json: agendaData || {} }
  };
  
  // Wrap JS code into a function context
  const fn = new Function('$json', '$node', jsCode);
  return fn($json, $node);
}

console.log("=== RUNNING SUITE OF EDGE CASE TESTS FOR Formatear Respuesta ===");

let passed = 0;
let failed = 0;

function assert(cond, name, details) {
  if (cond) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${name} -> ${details}`);
    failed++;
  }
}

// TEST 1: Normal valid booking
try {
  const res = runNode(
    { output: "Hola Maria! Quedo anotada tu cita para el 2026-07-28 a las 8:00 am.\n|||DATOS|||\n{\"nombre\": \"Maria Perez\", \"ciudad\": \"Maracay\", \"motivo_consulta\": \"Varices\", \"temperatura\": \"caliente\", \"resumen\": \"Consulta\", \"dia_cita\": \"2026-07-28\", \"hora_cita\": \"08:00\", \"requiere_asistencia_humana\": \"\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00, 09:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.dia_cita === "2026-07-28" && res.hora_cita === "08:00" && res.nombre === "Maria Perez" && !res.requiere_asistencia_humana, "Test 1: Valid Booking", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 1: Valid Booking Exception", e.message);
}

// TEST 2: Weekend hallucination booking (Sunday)
try {
  const res = runNode(
    { output: "Hola Jose! Te agendé para este domingo.\n|||DATOS|||\n{\"nombre\": \"Jose\", \"ciudad\": \"Maracay\", \"dia_cita\": \"2026-08-02\", \"hora_cita\": \"08:00\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2026-08-02 (Fin de semana): NO LABORABLE" }
  );
  assert(res.dia_cita === "" && res.hora_cita === "" && res.requiere_asistencia_humana.includes("fin de semana") && res.bot_reply.includes("el lunes"), "Test 2: Weekend Booking Intercepted & Replaced", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 2: Weekend Booking Exception", e.message);
}

// TEST 3: Invalid time slot (10:30 -> sanitized to 10:00 or 14:00 blocked)
try {
  const res = runNode(
    { output: "Te agendo a las 2:00 pm.\n|||DATOS|||\n{\"nombre\": \"Pedro\", \"dia_cita\": \"2026-07-28\", \"hora_cita\": \"14:00\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.dia_cita === "" && res.hora_cita === "" && res.requiere_asistencia_humana.includes("Horario no permitido"), "Test 3: Invalid Hour 14:00 Intercepted", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 3: Invalid Hour Exception", e.message);
}

// TEST 4: Hour not available in agenda
try {
  const res = runNode(
    { output: "Te agendo a las 11:00 am.\n|||DATOS|||\n{\"nombre\": \"Ana\", \"dia_cita\": \"2026-07-28\", \"hora_cita\": \"11:00\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00, 09:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.dia_cita === "" && res.hora_cita === "" && res.requiere_asistencia_humana.includes("Hora 11:00 no disponible"), "Test 4: Unlisted Hour Intercepted", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 4: Unlisted Hour Exception", e.message);
}

// TEST 5: Booking without patient name
try {
  const res = runNode(
    { output: "Listo tu cita.\n|||DATOS|||\n{\"dia_cita\": \"2026-07-28\", \"hora_cita\": \"08:00\"}" },
    { chat_history: [], Nombre: "" },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.dia_cita === "" && res.hora_cita === "" && res.requiere_asistencia_humana.includes("sin nombre"), "Test 5: No Name Intercepted", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 5: No Name Exception", e.message);
}

// TEST 6: Empty AI Response
try {
  const res = runNode(
    { output: "" },
    { chat_history: [] },
    {}
  );
  assert(res.bot_reply.includes("Disculpa la demora") && res.requiere_asistencia_humana.includes("Respuesta de IA vacía"), "Test 6: Empty Response Fallback", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 6: Empty Response Exception", e.message);
}

// TEST 7: Malformed JSON with Regex recovery
try {
  const res = runNode(
    { output: "Respuesta.\n|||DATOS|||\n{\n  \"nombre\": \"Carlos\",\n  \"dia_cita\": \"2026-07-28\",\n  \"hora_cita\": \"08:00\",\n}" }, // trailing comma causes JSON.parse to fail
    { chat_history: [] },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.nombre === "Carlos" && res.dia_cita === "2026-07-28", "Test 7: Malformed JSON Regex Recovery", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 7: Malformed JSON Exception", e.message);
}

// TEST 8: Non-array chat_history (e.g. object {} or string)
try {
  const res = runNode(
    { output: "Hola buenos dias como te va hoy en la consulta" },
    { chat_history: {} }, // Non-array chat_history!
    {}
  );
  assert(Array.isArray(res.final_history), "Test 8: Non-array chat_history robustness", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 8: Non-array chat_history CRASHED!", e.message);
}

// TEST 9: Past date booking (e.g. 2020-01-01)
try {
  const res = runNode(
    { output: "Cita vieja.\n|||DATOS|||\n{\"nombre\": \"Luis\", \"dia_cita\": \"2020-01-01\", \"hora_cita\": \"08:00\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2020-01-01: MAÑANA DISPONIBLE: [08:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  assert(res.dia_cita === "" && res.hora_cita === "" && res.requiere_asistencia_humana.includes("fecha pasada"), "Test 9: Past Date Intercepted", JSON.stringify(res));
} catch(e) {
  assert(false, "Test 9: Past Date Exception", e.message);
}

// TEST 10: Downstream structure check
try {
  const res = runNode(
    { output: "Hola Maria! Cita 2026-07-28 8:00 am.\n|||DATOS|||\n{\"nombre\": \"Maria Perez\", \"ciudad\": \"Maracay\", \"motivo_consulta\": \"Varices\", \"temperatura\": \"caliente\", \"resumen\": \"Consulta\", \"dia_cita\": \"2026-07-28\", \"hora_cita\": \"08:00\", \"requiere_asistencia_humana\": \"\"}" },
    { chat_history: [] },
    { agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00] | TARDE DISPONIBLE: [Sin disponibilidad]" }
  );
  const requiredKeys = ['final_history', 'bot_reply', 'delay', 'nombre', 'ciudad', 'motivo_consulta', 'temperatura', 'resumen', 'dia_cita', 'hora_cita', 'requiere_asistencia_humana'];
  const hasAllKeys = requiredKeys.every(k => k in res);
  assert(hasAllKeys, "Test 10: Downstream Required Keys Present", `Keys present: ${Object.keys(res).join(', ')}`);
} catch(e) {
  assert(false, "Test 10: Downstream Structure Exception", e.message);
}

console.log(`\nRESULTS: ${passed} PASSED, ${failed} FAILED`);
