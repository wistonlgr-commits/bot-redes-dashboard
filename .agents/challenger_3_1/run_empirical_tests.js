const fs = require('fs');
const path = require('path');

// 1. Read workflow JSON and extract jsCode from node "Formatear Respuesta"
const workflowPath = path.join(__dirname, '..', '..', 'flujo asistente de whatsapp.json');
const workflowRaw = fs.readFileSync(workflowPath, 'utf8');
const workflowObj = JSON.parse(workflowRaw);

const formatearNode = workflowObj.nodes.find(n => n.name === 'Formatear Respuesta');
if (!formatearNode || !formatearNode.parameters || !formatearNode.parameters.jsCode) {
  console.error("ERROR: Could not find 'Formatear Respuesta' node or jsCode in workflow JSON.");
  process.exit(1);
}

const jsCode = formatearNode.parameters.jsCode;
console.log("Successfully extracted jsCode from 'Formatear Respuesta' node.\n");

// Function runner wrapping node JS code
function runFormatearRespuesta($json, $node = {}) {
  if (!$node["Refrescar Datos de Supabase"]) {
    $node["Refrescar Datos de Supabase"] = {
      json: {
        chat_history: [],
        Nombre: "Paciente Base",
        Ciudad: "Caracas",
        Motivo_Consulta: "Consulta General",
        Temperatura: "Tibio",
        Resumen: "Cliente frecuente",
        Dia_Cita: "",
        Hora_Cita: "",
        requiere_asistencia_humana: ""
      }
    };
  }

  if (!$node["Formatear Agenda"]) {
    $node["Formatear Agenda"] = {
      json: {
        agenda_disponible: `2026-08-03: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00
2026-08-04: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00
2026-08-05: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00
2026-08-06: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00
2026-08-07: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00
2026-08-01: NO LABORABLE (Sábado)
2026-08-02: NO LABORABLE (Domingo)`
      }
    };
  }

  const func = new Function('$json', '$node', jsCode);
  return func($json, $node);
}

// Contract Assertion Function
function assertContract(output) {
  const issues = [];
  const requiredKeys = [
    'final_history', 'bot_reply', 'delay', 'nombre', 'ciudad',
    'motivo_consulta', 'temperatura', 'resumen', 'dia_cita',
    'hora_cita', 'requiere_asistencia_humana'
  ];

  if (typeof output !== 'object' || output === null) {
    issues.push("Output is not a valid object");
    return issues;
  }

  for (const key of requiredKeys) {
    if (!(key in output)) {
      issues.push(`Missing required output key: '${key}'`);
    }
  }

  if (!Array.isArray(output.final_history)) {
    issues.push("final_history is not an Array");
  }

  if (typeof output.bot_reply !== 'string' || output.bot_reply.trim() === '') {
    issues.push("bot_reply is empty or not a string");
  }

  if (typeof output.delay !== 'number' || output.delay < 3000 || output.delay > 8000) {
    issues.push(`delay (${output.delay}) is out of expected range [3000, 8000]`);
  }

  if (output.bot_reply && output.bot_reply.includes('|||DATOS|||')) {
    issues.push("bot_reply contains residual |||DATOS||| delimiter");
  }

  if (output.bot_reply && (output.bot_reply.includes('{{') || output.bot_reply.includes('}}'))) {
    issues.push("bot_reply contains residual double curly braces '{{' or '}}'");
  }

  return issues;
}

// TEST SUITES
const testCases = [
  // Bug Discovery Test: Recursion Depth limit check
  {
    id: "0.1",
    category: "Recursion Depth Failure",
    description: "Gemini API nested format at depth 6 (candidates[0].content.parts[0].text)",
    input: {
      candidates: [{
        content: {
          parts: [{
            text: "Hola, tu cita para el lunes está lista. |||DATOS||| {\"nombre\":\"Carlos\", \"dia_cita\":\"2026-08-03\", \"hora_cita\":\"08:00\"}"
          }]
        }
      }]
    },
    verify: (out) => {
      const assertions = [];
      const notFallback = out.bot_reply !== "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
      assertions.push({ name: "findText reaches depth 6 text (Does NOT fail to empty fallback)", pass: notFallback, actual: out.bot_reply });
      return assertions;
    }
  },

  // 1. Half-hour hallucinations
  {
    id: "1.1",
    category: "Half-hour hallucinations",
    description: "Cita para el lunes a las 8:30 am (valid hour 8:00 after sanitization)",
    input: {
      text: "Claro, te confirmo tu cita para el lunes a las 8:30 am. |||DATOS||| {\"nombre\":\"Carlos Perez\", \"dia_cita\":\"2026-08-03\", \"hora_cita\":\"8:30 am\"}"
    },
    verify: (out) => {
      const assertions = [];
      const passText = out.bot_reply.includes("8:00 am");
      assertions.push({ name: "Text sanitized 8:30 am -> 8:00 am", pass: passText, actual: out.bot_reply });
      const passHora = out.hora_cita === "08:00";
      assertions.push({ name: "hora_cita normalized to 08:00", pass: passHora, actual: out.hora_cita });
      const passDia = out.dia_cita === "2026-08-03";
      assertions.push({ name: "dia_cita kept 2026-08-03", pass: passDia, actual: out.dia_cita });
      return assertions;
    }
  },
  {
    id: "1.2",
    category: "Half-hour hallucinations",
    description: "Te espero a las 14:30 (invalid hour 14:00 after sanitization)",
    input: {
      text: "Te espero a las 14:30 para la consulta. |||DATOS||| {\"nombre\":\"Maria Lopez\", \"dia_cita\":\"2026-08-03\", \"hora_cita\":\"14:30\"}"
    },
    verify: (out) => {
      const assertions = [];
      const passText = out.bot_reply.includes("14:00");
      assertions.push({ name: "Text sanitized 14:30 -> 14:00", pass: passText, actual: out.bot_reply });
      const passHoraCleared = out.hora_cita === "";
      assertions.push({ name: "hora_cita invalidated/cleared", pass: passHoraCleared, actual: out.hora_cita });
      const passDiaCleared = out.dia_cita === "";
      assertions.push({ name: "dia_cita invalidated/cleared", pass: passDiaCleared, actual: out.dia_cita });
      const passAlert = typeof out.requiere_asistencia_humana === 'string' && out.requiere_asistencia_humana.includes("Horario no permitido");
      assertions.push({ name: "Human assistance alert flagged for invalid hour", pass: passAlert, actual: out.requiere_asistencia_humana });
      return assertions;
    }
  },
  {
    id: "1.3",
    category: "Half-hour hallucinations",
    description: "Verbal expression '8 y media' in response text and data block",
    input: {
      text: "Te esperamos el lunes a las 8 y media. |||DATOS||| {\"nombre\":\"Juan Gomez\", \"dia_cita\":\"2026-08-03\", \"hora_cita\":\"8 y media\"}"
    },
    verify: (out) => {
      const assertions = [];
      const passText = out.bot_reply.includes("8:00");
      assertions.push({ name: "Verbal '8 y media' sanitized to 8:00", pass: passText, actual: out.bot_reply });
      const passHora = out.hora_cita === "08:00";
      assertions.push({ name: "hora_cita normalized to 08:00", pass: passHora, actual: out.hora_cita });
      return assertions;
    }
  },

  // 2. Weekend requests
  {
    id: "2.1",
    category: "Weekend requests",
    description: "Quiero cita el domingo a las 10:00 (Sunday 2026-08-02)",
    input: {
      text: "Quiero cita el domingo a las 10:00 am. |||DATOS||| {\"nombre\":\"Pedro Picapiedra\", \"dia_cita\":\"2026-08-02\", \"hora_cita\":\"10:00 am\"}"
    },
    verify: (out) => {
      const assertions = [];
      const passText = out.bot_reply.includes("el lunes");
      assertions.push({ name: "Text 'el domingo' replaced with 'el lunes'", pass: passText, actual: out.bot_reply });
      const passDia = out.dia_cita === "";
      assertions.push({ name: "dia_cita cleared due to weekend hallucination", pass: passDia, actual: out.dia_cita });
      const passHora = out.hora_cita === "";
      assertions.push({ name: "hora_cita cleared due to weekend hallucination", pass: passHora, actual: out.hora_cita });
      const passAlert = typeof out.requiere_asistencia_humana === 'string' && out.requiere_asistencia_humana.includes("fin de semana");
      assertions.push({ name: "Human assistance alert flagged for weekend", pass: passAlert, actual: out.requiere_asistencia_humana });
      return assertions;
    }
  },
  {
    id: "2.2",
    category: "Weekend requests",
    description: "Cita para este sábado a las 9:00 am (Saturday 2026-08-01)",
    input: {
      text: "Te aparté cita este sábado a las 9:00 am. |||DATOS||| {\"nombre\":\"Laura Ramos\", \"dia_cita\":\"2026-08-01\", \"hora_cita\":\"9:00 am\"}"
    },
    verify: (out) => {
      const assertions = [];
      const passText = out.bot_reply.includes("el lunes");
      assertions.push({ name: "Text 'este sábado' replaced with 'el lunes'", pass: passText, actual: out.bot_reply });
      const passDia = out.dia_cita === "";
      assertions.push({ name: "dia_cita cleared for Saturday", pass: passDia, actual: out.dia_cita });
      const passHora = out.hora_cita === "";
      assertions.push({ name: "hora_cita cleared for Saturday", pass: passHora, actual: out.hora_cita });
      return assertions;
    }
  },

  // 3. Empty/null Gemini response text
  {
    id: "3.1",
    category: "Empty/null Gemini response",
    description: "Empty string response text",
    input: { text: "" },
    verify: (out) => {
      const assertions = [];
      const passFallback = out.bot_reply === "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
      assertions.push({ name: "Deterministic fallback reply returned", pass: passFallback, actual: out.bot_reply });
      const passAlert = out.requiere_asistencia_humana === "Respuesta de IA vacía - Fallback determinista activado";
      assertions.push({ name: "Human assistance alert flagged empty response", pass: passAlert, actual: out.requiere_asistencia_humana });
      return assertions;
    }
  },
  {
    id: "3.2",
    category: "Empty/null Gemini response",
    description: "Null input object fields",
    input: { response: null },
    verify: (out) => {
      const assertions = [];
      const passFallback = out.bot_reply.length > 10;
      assertions.push({ name: "Fallback reply activated without crashing", pass: passFallback, actual: out.bot_reply });
      return assertions;
    }
  },
  {
    id: "3.3",
    category: "Empty/null Gemini response",
    description: "Short string (< 15 chars) object input",
    input: { text: "Short text" },
    verify: (out) => {
      const assertions = [];
      const passFallback = out.bot_reply.includes("Disculpa la demora");
      assertions.push({ name: "Fallback triggered for text < 15 chars", pass: passFallback, actual: out.bot_reply });
      return assertions;
    }
  },

  // 4. Malformed JSON block after |||DATOS|||
  {
    id: "4.1",
    category: "Malformed JSON block",
    description: "Unclosed JSON syntax with valid string keys",
    input: {
      text: "Perfecto, agendado. |||DATOS||| {\"nombre\": \"Ana\", \"ciudad\": \"Caracas\", \"motivo_consulta\": \"Dolor de muela\", \"dia_cita\": \"2026-08-03\", \"hora_cita\": \"10:00 am\""
    },
    verify: (out) => {
      const assertions = [];
      const passNoDatosInReply = !out.bot_reply.includes("|||DATOS|||");
      assertions.push({ name: "bot_reply stripped of |||DATOS||| block", pass: passNoDatosInReply, actual: out.bot_reply });
      const passNombre = out.nombre === "Ana";
      assertions.push({ name: "Regex fallback extracted 'nombre'", pass: passNombre, actual: out.nombre });
      const passMotivo = out.motivo_consulta === "Dolor de muela";
      assertions.push({ name: "Regex fallback extracted 'motivo_consulta'", pass: passMotivo, actual: out.motivo_consulta });
      const passHora = out.hora_cita === "10:00";
      assertions.push({ name: "Regex fallback extracted 'hora_cita' and validated to 10:00", pass: passHora, actual: out.hora_cita });
      return assertions;
    }
  },
  {
    id: "4.2",
    category: "Malformed JSON block",
    description: "Completely corrupted non-JSON string after |||DATOS|||",
    input: {
      text: "Hola, ¿cómo estás? |||DATOS||| INVALID_GARBAGE_###@@@"
    },
    verify: (out) => {
      const assertions = [];
      const passCleanText = out.bot_reply === "Hola, ¿cómo estás?";
      assertions.push({ name: "bot_reply cleanly extracted without garbage", pass: passCleanText, actual: out.bot_reply });
      const passSafeExecution = typeof out === 'object' && out !== null;
      assertions.push({ name: "Node executed safely without throwing exception", pass: passSafeExecution, actual: "No crash" });
      return assertions;
    }
  },
  {
    id: "4.3",
    category: "Malformed JSON block",
    description: "Double braces {{ }} and Markdown code block wrapping JSON",
    input: {
      text: "Agendado con éxito. |||DATOS||| ```json\n{{\n  \"nombre\": \"Luis Miguel\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"09:00 am\"\n}}\n```"
    },
    verify: (out) => {
      const assertions = [];
      const passNombre = out.nombre === "Luis Miguel";
      assertions.push({ name: "Parsed JSON wrapped in {{ }} and markdown block", pass: passNombre, actual: out.nombre });
      const passHora = out.hora_cita === "09:00";
      assertions.push({ name: "Extracted hora_cita 09:00", pass: passHora, actual: out.hora_cita });
      return assertions;
    }
  }
];

// EXECUTE TEST SUITE
console.log("=================================================");
console.log("  RUNNING EMPIRICAL ADVERSARIAL TEST SUITE");
console.log("=================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const resultsLog = [];

for (const tc of testCases) {
  totalTests++;
  console.log(`Test ${tc.id} [${tc.category}]: ${tc.description}`);
  
  let output;
  let execError = null;
  try {
    output = runFormatearRespuesta(tc.input);
  } catch (err) {
    execError = err;
  }

  if (execError) {
    failedTests++;
    console.log(`  ❌ EXECUTION FAILED: ${execError.message}\n`);
    resultsLog.push({
      id: tc.id,
      category: tc.category,
      description: tc.description,
      status: "FAIL",
      execError: execError.message,
      contractIssues: [],
      assertions: []
    });
    continue;
  }

  const contractIssues = assertContract(output);
  const assertions = tc.verify ? tc.verify(output) : [];
  
  const allAssertionsPassed = assertions.every(a => a.pass);
  const contractPassed = contractIssues.length === 0;

  if (allAssertionsPassed && contractPassed) {
    passedTests++;
    console.log("  ✅ PASS");
    assertions.forEach(a => console.log(`     - ${a.name}: ${a.actual}`));
    console.log();
  } else {
    failedTests++;
    console.log("  ❌ FAIL");
    if (!contractPassed) {
      console.log("     Contract Issues:", contractIssues);
    }
    assertions.forEach(a => {
      const icon = a.pass ? "✓" : "✗";
      console.log(`     ${icon} ${a.name} (Actual: ${a.actual})`);
    });
    console.log();
  }

  resultsLog.push({
    id: tc.id,
    category: tc.category,
    description: tc.description,
    status: (allAssertionsPassed && contractPassed) ? "PASS" : "FAIL",
    output,
    contractIssues,
    assertions
  });
}

console.log("=================================================");
console.log(`  SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("=================================================\n");

// Write execution results to JSON artifact
const summaryPath = path.join(__dirname, 'test_results.json');
fs.writeFileSync(summaryPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalTests,
  passedTests,
  failedTests,
  results: resultsLog
}, null, 2));

console.log(`Results saved to ${summaryPath}`);
