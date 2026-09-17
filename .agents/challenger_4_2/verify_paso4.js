const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=================================================================");
console.log("NODE.JS JS-CODE EXECUTOR & EDGE CASE SUITE FOR FORMATEAR RESPUESTA");
console.log("=================================================================\n");

const workflowPath = "c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json";
const wf = JSON.load ? JSON.load(fs.readFileSync(workflowPath, 'utf8')) : JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const fmtNode = wf.nodes.find(n => n.name === 'Formatear Respuesta');
if (!fmtNode) {
  console.error("Formatear Respuesta node not found!");
  process.exit(1);
}

const jsCode = fmtNode.parameters.jsCode;
console.log("Successfully extracted jsCode from 'Formatear Respuesta' (" + jsCode.length + " bytes).\n");

// Helper to run code in VM sandbox with mock environment
function runInSandbox(mockJson, mockNodeMap = {}) {
  const sandbox = {
    $json: mockJson,
    $node: mockNodeMap,
    console: console,
    Math: Math,
    Date: Date,
    Intl: Intl,
    Array: Array,
    Object: Object,
    RegExp: RegExp,
    String: String,
    Number: Number,
    Boolean: Boolean,
    JSON: JSON,
    parseInt: parseInt,
    isNaN: isNaN
  };
  vm.createContext(sandbox);

  // Wrap code in an IIFE to capture return value
  const wrappedCode = `(function() {\n${jsCode}\n})()`;
  return vm.runInContext(wrappedCode, sandbox);
}

// Default mock nodes
const defaultMockNodes = {
  "Recibir WhatsApp": {
    json: {
      body: {
        data: {
          key: { remoteJid: "584121234567@s.whatsapp.net" },
          message: { conversation: "Hola, quiero pedir cita para el próximo lunes a las 4pm" }
        }
      }
    }
  },
  "Refrescar Datos de Supabase": {
    json: {
      Nombre: "Carlos Pérez",
      Ciudad: "Maracay",
      Motivo_Consulta: "Dolor de cabeza",
      Temperatura: "Cálido",
      chat_history: []
    }
  },
  "Formatear Agenda": {
    json: {
      agenda_disponible: "- 2026-07-27: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [16:00, 17:00]"
    }
  }
};

const results = [];

// Test Case 1: Valid scheduling response with quality incident (e.g. Schedule hallucination 3:00 PM)
try {
  const mockAI = {
    content: "¡Hola Carlos! Claro, con gusto. Te agendamos para el 2026-07-27 a las 3:00 PM.\n|||DATOS|||\n{\n  \"nombre\": \"Carlos Pérez\",\n  \"dia_cita\": \"2026-07-27\",\n  \"hora_cita\": \"15:00\"\n}"
  };
  const res = runInSandbox(mockAI, defaultMockNodes);
  console.log("TEST 1 (Schedule Hallucination 15:00):");
  console.log("  has_quality_incident:", res.has_quality_incident);
  console.log("  tipo_incidencia:", res.tipo_incidencia);
  console.log("  requiere_asistencia_humana:", res.requiere_asistencia_humana);
  console.log("  dia_cita:", res.dia_cita);
  console.log("  hora_cita:", res.hora_cita);
  if (res.has_quality_incident && res.tipo_incidencia === "ALUCINACION_HORARIO" && res.hora_cita === "") {
    results.push({ name: "Test 1: Schedule Hallucination", pass: true });
  } else {
    results.push({ name: "Test 1: Schedule Hallucination", pass: false, details: res });
  }
} catch (e) {
  results.push({ name: "Test 1: Schedule Hallucination", pass: false, error: e.message });
}

// Test Case 2: Valid response, no incident
try {
  const mockAI = {
    content: "¡Hola Carlos! Te confirmo tu cita para el 2026-07-27 a las 4:00 PM.\n|||DATOS|||\n{\n  \"nombre\": \"Carlos Pérez\",\n  \"dia_cita\": \"2026-07-27\",\n  \"hora_cita\": \"16:00\"\n}"
  };
  const res = runInSandbox(mockAI, defaultMockNodes);
  console.log("\nTEST 2 (Valid 16:00 Schedule):");
  console.log("  has_quality_incident:", res.has_quality_incident);
  console.log("  tipo_incidencia:", res.tipo_incidencia);
  console.log("  dia_cita:", res.dia_cita);
  console.log("  hora_cita:", res.hora_cita);
  if (!res.has_quality_incident && res.tipo_incidencia === "" && res.dia_cita === "2026-07-27" && res.hora_cita === "16:00") {
    results.push({ name: "Test 2: Valid Schedule", pass: true });
  } else {
    results.push({ name: "Test 2: Valid Schedule", pass: false, details: res });
  }
} catch (e) {
  results.push({ name: "Test 2: Valid Schedule", pass: false, error: e.message });
}

// Test Case 3: Empty response fallback
try {
  const mockAI = { content: "" };
  const res = runInSandbox(mockAI, defaultMockNodes);
  console.log("\nTEST 3 (Empty Response Fallback):");
  console.log("  has_quality_incident:", res.has_quality_incident);
  console.log("  tipo_incidencia:", res.tipo_incidencia);
  console.log("  bot_reply:", res.bot_reply);
  if (res.has_quality_incident && res.tipo_incidencia === "RESPUESTA_VACIA_FALLBACK") {
    results.push({ name: "Test 3: Empty Response Fallback", pass: true });
  } else {
    results.push({ name: "Test 3: Empty Response Fallback", pass: false, details: res });
  }
} catch (e) {
  results.push({ name: "Test 3: Empty Response Fallback", pass: false, error: e.message });
}

// Test Case 4: Malformed |||DATOS||| JSON string with fallback regex extraction
try {
  const mockAI = {
    content: "Respuesta con JSON malformado\n|||DATOS|||\n{ \"nombre\": \"Carlos\", \"dia_cita\": \"2026-07-27\", \"hora_cita\": \"16:00\" (missing closing bracket"
  };
  const res = runInSandbox(mockAI, defaultMockNodes);
  console.log("\nTEST 4 (Malformed JSON Fallback):");
  console.log("  nombre:", res.nombre);
  console.log("  dia_cita:", res.dia_cita);
  console.log("  hora_cita:", res.hora_cita);
  if (res.nombre === "Carlos" && res.dia_cita === "2026-07-27" && res.hora_cita === "16:00") {
    results.push({ name: "Test 4: Malformed JSON Fallback", pass: true });
  } else {
    results.push({ name: "Test 4: Malformed JSON Fallback", pass: false, details: res });
  }
} catch (e) {
  results.push({ name: "Test 4: Malformed JSON Fallback", pass: false, error: e.message });
}

// Test Case 5: Special characters & emojis in metadata_log
try {
  const mockAI = {
    content: "¡Hola! 🏥 Consulta de traumatología 👍\n|||DATOS||\n{\n  \"nombre\": \"José María O'Connor\",\n  \"ciudad\": \"San Juan de los Morros #123\"\n}"
  };
  const res = runInSandbox(mockAI, defaultMockNodes);
  console.log("\nTEST 5 (Special Characters & Emojis):");
  console.log("  metadata_log:", res.metadata_log);
  const serialized = JSON.stringify(res.metadata_log);
  console.log("  JSON.stringify(metadata_log):", serialized);
  if (typeof serialized === 'string' && serialized.includes("José María")) {
    results.push({ name: "Test 5: Special Characters & Emojis", pass: true });
  } else {
    results.push({ name: "Test 5: Special Characters & Emojis", pass: false });
  }
} catch (e) {
  results.push({ name: "Test 5: Special Characters & Emojis", pass: false, error: e.message });
}

console.log("\n=================================================================");
console.log("TEST RESULTS SUMMARY:");
results.forEach(r => console.log(` - ${r.pass ? '[PASS]' : '[FAIL]'} ${r.name} ${r.error ? '(' + r.error + ')' : ''}`));
console.log("=================================================================");
