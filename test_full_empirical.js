const fs = require('fs');

// Read node code from flujo asistente de whatsapp.json
const flowJson = JSON.parse(fs.readFileSync('flujo asistente de whatsapp.json', 'utf8'));
const nodeFormatear = flowJson.nodes.find(n => n.name === 'Formatear Respuesta');
const jsCode = nodeFormatear.parameters.jsCode;

function extractSanitizeTimes(code) {
  const match = code.match(/function sanitizeTimes\(text\) \{[\s\S]*?\n\}/);
  if (!match) throw new Error("sanitizeTimes function not found");
  return new Function('text', match[0] + '\nreturn sanitizeTimes(text);');
}

const sanitizeTimes = extractSanitizeTimes(jsCode);

console.log("=== COMPREHENSIVE STRESS TESTING OF sanitizeTimes ===");

const stressCases = [
  // Section 1: User requested edge cases
  { name: "ISO Timestamp Z", input: "2026-07-27T08:30:00Z", expected: "2026-07-27T08:30:00Z", category: "ISO" },
  { name: "ISO Timestamp Space", input: "2026-07-27 08:30:00", expected: "2026-07-27 08:30:00", category: "ISO" },
  { name: "ISO Timestamp Short (08:30Z)", input: "2026-07-27T08:30Z", expected: "2026-07-27T08:00Z", category: "ISO Edge" }, // Note: 08:30Z has no seconds
  { name: "Price leading dollar", input: "El costo de la consulta es de $12.30 en efectivo.", expected: "El costo de la consulta es de $12.30 en efectivo.", category: "Price" },
  { name: "Price trailing dollar", input: "Son 12.30$ en total.", expected: "Son 12.30$ en total.", category: "Price" },
  { name: "Price Euro", input: "Tarifa 45.30 € por sesión", expected: "Tarifa 45.30 € por sesión", category: "Price" },
  { name: "Price with colon", input: "El costo es 12:30$", expected: "El costo es 12:00$", category: "Price Colon Edge" },
  { name: "Phone format dash", input: "Puedes comunicarte al 0412-3012345.", expected: "Puedes comunicarte al 0412-3012345.", category: "Phone" },
  { name: "Phone format dots", input: "Teléfono: 0414.301.2345", expected: "Teléfono: 0414.301.2345", category: "Phone" },
  { name: "Phone international", input: "+58-412-301-2345", expected: "+58-412-301-2345", category: "Phone" },
  { name: "Multi-paragraph emojis & markdown", input: "¡Hola! 👋🏻\n\nTu cita está agendada para el **lunes 27 de julio** a las *8:30 am*.\n\n📍 Ubicación: Consultorio 3.\n💰 Precio: $15.30.\n📞 Dudas al 0412-3012345.\n\n¡Te esperamos! 😊", expected: "¡Hola! 👋🏻\n\nTu cita está agendada para el **lunes 27 de julio** a las *8:00 am*.\n\n📍 Ubicación: Consultorio 3.\n💰 Precio: $15.30.\n📞 Dudas al 0412-3012345.\n\n¡Te esperamos! 😊", category: "Formatting" },
  
  // Section 2: Hallucinated Time Sanitize targets
  { name: "8:30 am", input: "8:30 am", expected: "8:00 am", category: "Sanitization" },
  { name: "08:30 AM", input: "08:30 AM", expected: "08:00 AM", category: "Sanitization" },
  { name: "8:15 p.m.", input: "8:15 p.m.", expected: "8:00 p.m.", category: "Sanitization" },
  { name: "10:20 am", input: "10:20 am", expected: "10:00 am", category: "Sanitization" },
  { name: "11:45 PM", input: "11:45 PM", expected: "11:00 PM", category: "Sanitization" },
  { name: "a las 8:30", input: "a las 8:30", expected: "a las 8:00", category: "Sanitization" },
  { name: "a las 8:30 hrs", input: "a las 8:30 hrs", expected: "a las 8:00 hrs", category: "Sanitization" },
  { name: "a las 8 y media", input: "a las 8 y media", expected: "a las 8:00", category: "Sanitization" },
  { name: "a las 10 y 30", input: "a las 10 y 30", expected: "a las 10:00", category: "Sanitization" },

  // Section 3: False positive checks / subtleties
  { name: "Dot time format (8.30 am)", input: "8.30 am", expected: "8.30 am", category: "Dot Time Edge" }, // sanitizeTimes only replaces colon times or 'y media'
  { name: "24h format without am/pm (16:30)", input: "A las 16:30 hrs", expected: "A las 16:00 hrs", category: "24h Time" },
  { name: "Minutes not 15/20/30/45 (8:35 am)", input: "8:35 am", expected: "8:35 am", category: "Unmatched Minutes" }
];

let passCount = 0;
let failCount = 0;

stressCases.forEach(c => {
  const actual = sanitizeTimes(c.input);
  const ok = actual === c.expected;
  if (ok) passCount++; else failCount++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${c.category} - ${c.name}`);
  if (!ok) {
    console.log(`   IN:  ${JSON.stringify(c.input)}`);
    console.log(`   EXP: ${JSON.stringify(c.expected)}`);
    console.log(`   ACT: ${JSON.stringify(actual)}`);
  }
});

console.log(`\nDirect sanitizeTimes results: ${passCount} PASSED, ${failCount} FAILED out of ${stressCases.length}.\n`);

// Section 4: Full Node Execution Simulation Function
function runNode(inputJson, supabaseData, agendaData) {
  const sandbox = {
    $json: inputJson,
    $node: {
      "Refrescar Datos de Supabase": { json: supabaseData || {} },
      "Formatear Agenda": { json: agendaData || {} }
    },
    Math: Math,
    parseInt: parseInt,
    isNaN: isNaN,
    Array: Array,
    Object: Object,
    RegExp: RegExp,
    Date: Date,
    Intl: Intl,
    console: console
  };

  const wrappedCode = `
    (function() {
      const $json = sandbox.$json;
      const $node = sandbox.$node;
      ${jsCode}
    })()
  `;

  return eval(wrappedCode);
}

console.log("=== FULL NODE EVALUATION WITH INTEGRATED SCENARIOS ===");

const nodeScenarios = [
  {
    name: "Valid appointment with 8:30 am hallucination in bot reply & JSON block",
    inputJson: {
      output: "Perfecto Carlos, tu cita queda agendada para el lunes 2026-07-27 a las 8:30 am.\n|||DATOS|||\n{\n  \"nombre\": \"Carlos Gomez\",\n  \"ciudad\": \"Caracas\",\n  \"motivo_consulta\": \"Limpieza\",\n  \"temperatura\": \"Caliente\",\n  \"resumen\": \"Cliente solicita cita\",\n  \"dia_cita\": \"2026-07-27\",\n  \"hora_cita\": \"08:30 am\",\n  \"requiere_asistencia_humana\": \"\"\n}"
    },
    supabaseData: {
      chat_history: []
    },
    agendaData: {
      agenda_disponible: "2026-07-27: 08:00, 09:00, 10:00"
    },
    verify: (res) => {
      return res.hora_cita === "08:00" && 
             res.bot_reply.includes("8:00 am") && 
             !res.bot_reply.includes("8:30 am") &&
             res.requiere_asistencia_humana === "";
    }
  },
  {
    name: "Message containing ISO timestamp, price, phone, markdown, emojis AND 8:30 am hallucination",
    inputJson: {
      output: "¡Hola! 👋🏻\n\nTimestamp del sistema: 2026-07-27T08:30:00Z.\nTu cita está agendada para el **2026-07-27** a las *8:30 am*.\n\n📍 Consultorio 3.\n💰 Consulta: $12.30 (o 12.30$).\n📞 Llámanos al 0412-3012345.\n\n|||DATOS|||\n{\n  \"nombre\": \"María Pérez\",\n  \"ciudad\": \"Caracas\",\n  \"motivo_consulta\": \"Evaluación\",\n  \"temperatura\": \"Caliente\",\n  \"resumen\": \"Agendado\",\n  \"dia_cita\": \"2026-07-27\",\n  \"hora_cita\": \"08:30 am\",\n  \"requiere_asistencia_humana\": \"\"\n}"
    },
    supabaseData: {},
    agendaData: {
      agenda_disponible: "2026-07-27: 08:00, 09:00"
    },
    verify: (res) => {
      const b = res.bot_reply;
      const isoOk = b.includes("2026-07-27T08:30:00Z");
      const price1Ok = b.includes("$12.30");
      const price2Ok = b.includes("12.30$");
      const phoneOk = b.includes("0412-3012345");
      const timeSanitized = b.includes("8:00 am") && !b.includes("a las *8:30 am*");
      const dataHoraOk = res.hora_cita === "08:00";
      return isoOk && price1Ok && price2Ok && phoneOk && timeSanitized && dataHoraOk;
    }
  }
];

nodeScenarios.forEach((sc, idx) => {
  try {
    const res = runNode(sc.inputJson, sc.supabaseData, sc.agendaData);
    const pass = sc.verify(res);
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Scenario ${idx + 1}: ${sc.name}`);
    if (!pass) {
      console.log("   Result:", res);
    }
  } catch (e) {
    console.log(`[FAIL] Scenario ${idx + 1}: ${sc.name} threw exception:`, e);
  }
});
