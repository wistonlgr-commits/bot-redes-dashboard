const fs = require('fs');

// Read node code directly from flujo asistente de whatsapp.json
const jsonPath = 'c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json';
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const formatNode = data.nodes.find(n => n.name === "Formatear Respuesta");
if (!formatNode || !formatNode.parameters || !formatNode.parameters.jsCode) {
  console.error("Formatear Respuesta node not found!");
  process.exit(1);
}

const jsCode = formatNode.parameters.jsCode;
console.log("Successfully loaded JS code from Formatear Respuesta node.");

// Helper function to execute Formatear Respuesta logic in sandbox
function runFormatearRespuesta(inputJson, prevDataInput, receiveWhatsAppInput, agendaInput) {
  // Mock n8n globals
  const $json = inputJson;
  const $node = {
    "Recibir WhatsApp": {
      json: receiveWhatsAppInput || { body: { data: { message: { conversation: "Hola" } } } }
    },
    "Refrescar Datos de Supabase": {
      json: prevDataInput || {}
    },
    "Formatear Agenda": {
      json: agendaInput || { agenda_disponible: "2026-08-03: 08:00, 09:00, 10:00, 11:00\n2026-08-04: 08:00, 09:00, 10:00, 11:00" }
    }
  };

  // Run code by wrapping inside Function construct
  const evaluator = new Function('$json', '$node', jsCode);
  return evaluator($json, $node);
}

// TEST SUITE DEFINITION
let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

console.log("\n=================== STARTING TEST SUITE ===================\n");

// --- CASE (c) TESTS: ACTIVE APPOINTMENT RETENTION & CANCELLATION ---
console.log("--- Testing Case (c): Active Appointment State Preservation ---");

// Test c1: Existing appointment + General inquiry (AI outputs empty dia_cita/hora_cita)
const prevData_c1 = {
  Nombre: "Maria Perez",
  Ciudad: "Maracay",
  Motivo_Consulta: "Varices",
  Temperatura: "Caliente",
  Resumen: "Cita agendada para el 2026-08-10 a las 09:00",
  Dia_Cita: "2026-08-10",
  Hora_Cita: "09:00"
};
const aiOutput_c1 = {
  content: 'Estamos en Maracay, Uniaragua Piso 3.\n\n|||DATOS|||\n{"nombre": "Maria Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "Caliente", "resumen": "Pregunta por dirección.", "dia_cita": "", "hora_cita": "", "requiere_asistencia_humana": ""}'
};
const res_c1 = runFormatearRespuesta(aiOutput_c1, prevData_c1);
assert(res_c1.dia_cita === "2026-08-10", `c1: dia_cita preserved as '2026-08-10' (got: '${res_c1.dia_cita}')`);
assert(res_c1.hora_cita === "09:00", `c1: hora_cita preserved as '09:00' (got: '${res_c1.hora_cita}')`);

// Test c2: Existing appointment + AI outputs undefined/missing dia_cita
const aiOutput_c2 = {
  content: 'Gracias por escribirnos.\n\n|||DATOS|||\n{"nombre": "Maria Perez", "resumen": "Consulta general"}'
};
const res_c2 = runFormatearRespuesta(aiOutput_c2, prevData_c1);
assert(res_c2.dia_cita === "2026-08-10", `c2: dia_cita preserved when field missing in AI output (got: '${res_c2.dia_cita}')`);
assert(res_c2.hora_cita === "09:00", `c2: hora_cita preserved when field missing in AI output (got: '${res_c2.hora_cita}')`);

// Test c3: Explicit cancellation (resumen contains 'cancela')
const aiOutput_c3 = {
  content: 'Lamento que tengas que cancelar tu cita. Quedamos a la orden.\n\n|||DATOS|||\n{"nombre": "Maria Perez", "resumen": "El paciente cancela su cita del 10 de agosto.", "dia_cita": "", "hora_cita": ""}'
};
const res_c3 = runFormatearRespuesta(aiOutput_c3, prevData_c1);
assert(res_c3.dia_cita === "", `c3: dia_cita cleared to "" on explicit cancellation (got: '${res_c3.dia_cita}')`);
assert(res_c3.hora_cita === "", `c3: hora_cita cleared to "" on explicit cancellation (got: '${res_c3.hora_cita}')`);

// Test c4: Explicit cancellation uppercase ('CANCELACIÓN')
const aiOutput_c4 = {
  content: 'Entendido.\n\n|||DATOS|||\n{"nombre": "Maria Perez", "resumen": "CANCELACIÓN DE CITA SOLICITADA", "dia_cita": "", "hora_cita": ""}'
};
const res_c4 = runFormatearRespuesta(aiOutput_c4, prevData_c1);
assert(res_c4.dia_cita === "", `c4: dia_cita cleared on uppercase CANCELACIÓN (got: '${res_c4.dia_cita}')`);

// Test c5: New appointment booking overwrites prevData appointment
const aiOutput_c5 = {
  content: 'Cita cambiada para el 12 de agosto a las 10:00 am.\n\n|||DATOS|||\n{"nombre": "Maria Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "dia_cita": "2026-08-12", "hora_cita": "10:00"}'
};
const agenda_c5 = { agenda_disponible: "2026-08-12: 10:00" };
const res_c5 = runFormatearRespuesta(aiOutput_c5, prevData_c1, null, agenda_c5);
assert(res_c5.dia_cita === "2026-08-12", `c5: dia_cita updated to new valid date '2026-08-12' (got: '${res_c5.dia_cita}')`);
assert(res_c5.hora_cita === "10:00", `c5: hora_cita updated to new valid hour '10:00' (got: '${res_c5.hora_cita}')`);


// --- CASE (a) TESTS: SUNDAY DATE LOGIC & WEEKEND BLOCKING ---
console.log("\n--- Testing Case (a): Sunday Date Logic & Weekend Shielding ---");

// Test a1: AI attempts to schedule on Sunday 2026-08-02 (Sunday)
const aiOutput_a1 = {
  content: 'Te agendé para el domingo 2 de agosto a las 4:00 pm.\n\n|||DATOS|||\n{"nombre": "Pedro Gomez", "ciudad": "Maracay", "motivo_consulta": "Varices", "dia_cita": "2026-08-02", "hora_cita": "16:00"}'
};
const res_a1 = runFormatearRespuesta(aiOutput_a1, {});
assert(res_a1.dia_cita === "", `a1: Sunday date 2026-08-02 cleared (got: '${res_a1.dia_cita}')`);
assert(res_a1.hora_cita === "", `a1: Sunday hour cleared (got: '${res_a1.hora_cita}')`);
assert(res_a1.tipo_incidencia === "ALUCINACION_FIN_DE_SEMANA", `a1: incident type set to ALUCINACION_FIN_DE_SEMANA (got: '${res_a1.tipo_incidencia}')`);
assert(res_a1.bot_reply.includes('el lunes'), `a1: text replacement 'domingo' -> 'el lunes' in bot_reply (got: '${res_a1.bot_reply}')`);

// Test a2: AI attempts to schedule on Saturday 2026-08-01 (Saturday)
const aiOutput_a2 = {
  content: 'Te agendé para el sábado 1 de agosto a las 10:00 am.\n\n|||DATOS|||\n{"nombre": "Pedro Gomez", "ciudad": "Maracay", "motivo_consulta": "Varices", "dia_cita": "2026-08-01", "hora_cita": "10:00"}'
};
const res_a2 = runFormatearRespuesta(aiOutput_a2, {});
assert(res_a2.dia_cita === "", `a2: Saturday date 2026-08-01 cleared (got: '${res_a2.dia_cita}')`);
assert(res_a2.tipo_incidencia === "ALUCINACION_FIN_DE_SEMANA", `a2: Saturday incident caught (got: '${res_a2.tipo_incidencia}')`);


// --- CASE (b) TESTS: :30 EXCLUSION & PRE-SEND VALIDATOR SHIELD ---
console.log("\n--- Testing Case (b): :30 Exclusion & Pre-send Validator Shield ---");

// Test b1: AI text output includes "12:30 pm"
const aiOutput_b1 = {
  content: 'Te aparto a las 12:30 pm el lunes.\n\n|||DATOS|||\n{"nombre": "Ana Rivas", "ciudad": "Maracay", "motivo_consulta": "Dolor", "dia_cita": "2026-08-03", "hora_cita": "12:30"}'
};
const res_b1 = runFormatearRespuesta(aiOutput_b1, {});
assert(!res_b1.bot_reply.includes("12:30"), `b1: sanitizeTimes removed '12:30' from bot_reply (got: '${res_b1.bot_reply}')`);
assert(res_b1.dia_cita === "", `b1: dia_cita cleared due to invalid hour 12:30 (got: '${res_b1.dia_cita}')`);
assert(res_b1.hora_cita === "", `b1: hora_cita cleared due to invalid hour 12:30 (got: '${res_b1.hora_cita}')`);
assert(res_b1.tipo_incidencia === "ALUCINACION_HORARIO", `b1: incident type set to ALUCINACION_HORARIO (got: '${res_b1.tipo_incidencia}')`);

// Test b2: AI outputs valid 10:00 am
const aiOutput_b2 = {
  content: 'Te agendé para el lunes a las 10:00 am.\n\n|||DATOS|||\n{"nombre": "Ana Rivas", "ciudad": "Maracay", "motivo_consulta": "Dolor", "dia_cita": "2026-08-03", "hora_cita": "10:00"}'
};
const agenda_b2 = { agenda_disponible: "2026-08-03: 08:00, 09:00, 10:00, 11:00" };
const res_b2 = runFormatearRespuesta(aiOutput_b2, {}, null, agenda_b2);
assert(res_b2.dia_cita === "2026-08-03", `b2: valid hour 10:00 preserved (got: '${res_b2.dia_cita}')`);
assert(res_b2.hora_cita === "10:00", `b2: hora_cita set to 10:00 (got: '${res_b2.hora_cita}')`);
assert(res_b2.has_quality_incident === false, `b2: no quality incident for valid booking`);

console.log(`\n=================== TEST RESULTS: ${passedTests}/${totalTests} PASSED ===================\n`);
process.exit(passedTests === totalTests ? 0 : 1);
