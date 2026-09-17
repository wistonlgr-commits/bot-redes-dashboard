const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Path to workflow JSON
const workflowPath = 'c:/Users/Leor/Desktop/bot whatsapp/flujo asistente de whatsapp.json';

console.log("=================================================");
console.log("PASO 4 EMPIRICAL VERIFICATION & STRESS TEST HARNESS");
console.log("=================================================\n");

// 1. PARSE JSON & STRUCTURAL VERIFICATION
if (!fs.existsSync(workflowPath)) {
  console.error(`ERROR: Workflow file not found at ${workflowPath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(workflowPath, 'utf8');
let workflow;
try {
  workflow = JSON.parse(rawData);
  console.log(`[PASS] Successfully parsed ${workflowPath}`);
} catch (e) {
  console.error(`[FAIL] JSON Parse Error: ${e.message}`);
  process.exit(1);
}

// Structural checks
const nodes = workflow.nodes || [];
const connections = workflow.connections || {};

console.log(`\n--- STRUCTURAL METRICS ---`);
console.log(`Total Nodes: ${nodes.length}`);
console.log(`Workflow Name: "${workflow.name}"`);

// Locate Paso 4 Nodes
const formatearRespuestaNode = nodes.find(n => n.name === 'Formatear Respuesta');
const siIncidenciaNode = nodes.find(n => n.name === '¿Existe Incidencia de Calidad?');
const registrarIncidenciaNode = nodes.find(n => n.name === 'Registrar Incidencia (Supabase)');

console.log('\n--- PASO 4 NODES INSPECTION ---');
console.log(`Formatear Respuesta Node ID: ${formatearRespuestaNode ? formatearRespuestaNode.id : 'MISSING'}`);
console.log(`¿Existe Incidencia de Calidad? Node ID: ${siIncidenciaNode ? siIncidenciaNode.id : 'MISSING'}`);
console.log(`Registrar Incidencia (Supabase) Node ID: ${registrarIncidenciaNode ? registrarIncidenciaNode.id : 'MISSING'}`);

let structuralFailures = [];

if (!formatearRespuestaNode) structuralFailures.push("Missing 'Formatear Respuesta' node");
if (!siIncidenciaNode) structuralFailures.push("Missing '¿Existe Incidencia de Calidad?' node");
if (!registrarIncidenciaNode) structuralFailures.push("Missing 'Registrar Incidencia (Supabase)' node");

// Verify Connections
console.log('\n--- CONNECTIONS VERIFICATION ---');
const connFormatear = connections['Formatear Respuesta'];
console.log('Formatear Respuesta outputs:', JSON.stringify(connFormatear, null, 2));

const connSiIncidencia = connections['¿Existe Incidencia de Calidad?'];
console.log('¿Existe Incidencia de Calidad? outputs:', JSON.stringify(connSiIncidencia, null, 2));

// Check if Formatear Respuesta connects to ¿Existe Incidencia de Calidad?
let isConnectedToIf = false;
if (connFormatear && connFormatear.main && connFormatear.main[0]) {
  isConnectedToIf = connFormatear.main[0].some(c => c.node === '¿Existe Incidencia de Calidad?');
}
console.log(`Connection (Formatear Respuesta -> ¿Existe Incidencia de Calidad?): ${isConnectedToIf ? 'CONNECTED [PASS]' : 'DISCONNECTED [FAIL]'}`);
if (!isConnectedToIf) structuralFailures.push("Formatear Respuesta is not connected to ¿Existe Incidencia de Calidad?");

// Check if ¿Existe Incidencia de Calidad? connects to Registrar Incidencia (Supabase)
let isConnectedToLog = false;
if (connSiIncidencia && connSiIncidencia.main && connSiIncidencia.main[0]) {
  isConnectedToLog = connSiIncidencia.main[0].some(c => c.node === 'Registrar Incidencia (Supabase)');
}
console.log(`Connection (¿Existe Incidencia de Calidad? -> Registrar Incidencia (Supabase)): ${isConnectedToLog ? 'CONNECTED [PASS]' : 'DISCONNECTED [FAIL]'}`);
if (!isConnectedToLog) structuralFailures.push("¿Existe Incidencia de Calidad? is not connected to Registrar Incidencia (Supabase)");

// Check Zero Token Requirement for Logging
console.log('\n--- ZERO REAL-TIME TOKEN LOGGING VERIFICATION ---');
const logNodeType = registrarIncidenciaNode ? registrarIncidenciaNode.type : '';
const logNodeParams = registrarIncidenciaNode ? registrarIncidenciaNode.parameters : {};
console.log(`Logging Node Type: ${logNodeType}`);
console.log(`Target Table: ${logNodeParams.tableId}`);
const isZeroToken = logNodeType === 'n8n-nodes-base.supabase' && logNodeParams.tableId === 'bot_quality_logs';
console.log(`Zero Token Async Logging: ${isZeroToken ? 'VERIFIED [PASS]' : 'UNVERIFIED [FAIL]'}`);
if (!isZeroToken) structuralFailures.push("Logging node does not use pure Supabase async DB insert");

// 2. EXECUTABLE HARNESS FOR FORMATEAR RESPUESTA JS CODE
console.log('\n=================================================');
console.log('EXECUTING JS CODE HARNESS IN VM FOR FORMATEAR RESPUESTA');
console.log('=================================================\n');

const jsCode = formatearRespuestaNode ? formatearRespuestaNode.parameters.jsCode : '';

function runFormatearRespuesta(mockInput) {
  // Context setup simulating n8n environment
  const sandbox = {
    $node: mockInput.$node || {
      "Recibir WhatsApp": {
        json: {
          body: {
            data: {
              message: {
                conversation: mockInput.userMessage || "Hola doctor"
              }
            }
          }
        }
      },
      "Refrescar Datos de Supabase": {
        json: mockInput.prevData || {
          chat_history: []
        }
      },
      "Formatear Agenda": {
        json: {
          agenda_disponible: mockInput.agendaDisponible || "- 2026-08-10: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [16:00, 17:00]\n- 2026-08-11: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [16:00, 17:00]"
        }
      }
    },
    $json: mockInput.$json || {},
    $now: mockInput.$now || {
      setZone: () => ({
        format: () => "Monday, 2026-07-27"
      })
    },
    console: console
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(jsCode);
  return script.runInContext(context);
}

// DEFINE TEST SUITE FOR MOCK GEMINI OUTPUTS & EDGE CASES
const testCases = [
  {
    id: "TC-01",
    name: "Empty Gemini Response (null content)",
    input: { $json: { content: "" } },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "RESPUESTA_VACIA_FALLBACK",
      bot_reply: "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"
    }
  },
  {
    id: "TC-02",
    name: "Empty Gemini Response (whitespace only)",
    input: { $json: { text: "   \n  " } },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "RESPUESTA_VACIA_FALLBACK",
      bot_reply: "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"
    }
  },
  {
    id: "TC-03",
    name: "Hallucinated Off-Slot Hour (14:00 / 2:00 PM)",
    input: {
      $json: {
        content: `Claro Juan, te agendo a las 2:00 pm. \n|||DATOS|||\n{{\"nombre\": \"Juan\", \"ciudad\": \"Maracay\", \"motivo_consulta\": \"Varices\", \"dia_cita\": \"2026-08-10\", \"hora_cita\": \"14:00\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ALUCINACION_HORARIO",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-04",
    name: "Hallucinated Invalid Minutes (08:42 AM)",
    input: {
      $json: {
        content: `Perfecto Pedro, a las 8:42 am.\n|||DATOS|||\n{{\"nombre\": \"Pedro\", \"dia_cita\": \"2026-08-10\", \"hora_cita\": \"08:42\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ALUCINACION_HORARIO",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-05",
    name: "Hallucinated Weekend Date - Saturday (2026-08-08)",
    input: {
      $json: {
        content: `Te espero este sábado 8 de agosto a las 8:00 am.\n|||DATOS|||\n{{\"nombre\": \"Ana\", \"dia_cita\": \"2026-08-08\", \"hora_cita\": \"08:00\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ALUCINACION_FIN_DE_SEMANA",
      dia_cita: "",
      hora_cita: "",
      bot_reply_contains: "el lunes"
    }
  },
  {
    id: "TC-06",
    name: "Hallucinated Weekend Date - Sunday (2026-08-09)",
    input: {
      $json: {
        content: `Te agendo para el domingo 9 de agosto a las 9:00 am.\n|||DATOS|||\n{{\"nombre\": \"Carlos\", \"dia_cita\": \"2026-08-09\", \"hora_cita\": \"09:00\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ALUCINACION_FIN_DE_SEMANA",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-07",
    name: "Hallucinated Past Date (2026-01-01)",
    input: {
      $json: {
        content: `Listo, te anoté para el 2026-01-01 a las 10:00 am.\n|||DATOS|||\n{{\"nombre\": \"Elena\", \"dia_cita\": \"2026-01-01\", \"hora_cita\": \"10:00\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ALUCINACION_FECHA_PASADA",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-08",
    name: "Scheduling Attempt Without Patient Name",
    input: {
      $json: {
        content: `Listo, quedó reservado a las 8:00 am.\n|||DATOS|||\n{{\"dia_cita\": \"2026-08-10\", \"hora_cita\": \"08:00\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "AGENDAMIENTO_SIN_NOMBRE",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-09",
    name: "Human Assistance Request - Rescheduling Policy (50%)",
    input: {
      $json: {
        content: `Perfecto. En unos momentos nuestra secretaria se pondrá en contacto contigo.\n|||DATOS|||\n{{\"requiere_asistencia_humana\": \"Paciente desea reagendar cita. Aplicar política de 50% abono.\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "REAGENDAMIENTO_POLITICA"
    }
  },
  {
    id: "TC-10",
    name: "Human Assistance Request - No-Show",
    input: {
      $json: {
        content: `Entiendo, te derivamos con la secretaria.\n|||DATOS|||\n{{\"requiere_asistencia_humana\": \"Paciente no asistió a cita previa. Aplicar protocolo de inasistencia.\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "INASISTENCIA_NOSHOW"
    }
  },
  {
    id: "TC-11",
    name: "Human Assistance Request - Complex Medical Question",
    input: {
      $json: {
        content: `Te comunico con la secretaria para que te atienda.\n|||DATOS|||\n{{\"requiere_asistencia_humana\": \"Consulta sobre cirugía de úlceras complejas.\"}}`
      }
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "ASISTENCIA_HUMANA_REQUERIDA"
    }
  },
  {
    id: "TC-12",
    name: "Unavailable Date in Agenda",
    input: {
      $json: {
        content: `Te aparto para el 2026-08-15 a las 08:00 am.\n|||DATOS|||\n{{\"nombre\": \"Luis\", \"dia_cita\": \"2026-08-15\", \"hora_cita\": \"08:00\"}}`
      },
      agendaDisponible: "- 2026-08-10: MAÑANA DISPONIBLE: [08:00]"
    },
    expected: {
      has_quality_incident: true,
      tipo_incidencia: "FECHA_NO_DISPONIBLE",
      dia_cita: "",
      hora_cita: ""
    }
  },
  {
    id: "TC-13",
    name: "Malformed JSON in |||DATOS||| (RegExp Fallback Recovery)",
    input: {
      $json: {
        content: `Hola Sofia! Te aparto la cita.\n|||DATOS|||\n"nombre": "Sofia", "ciudad": "Maracay", "motivo_consulta": "Dolor", "temperatura": "caliente", "dia_cita": "2026-08-10", "hora_cita": "08:00"`
      }
    },
    expected: {
      nombre: "Sofia",
      dia_cita: "2026-08-10",
      hora_cita: "08:00",
      has_quality_incident: false,
      tipo_incidencia: ""
    }
  },
  {
    id: "TC-14",
    name: "Normal Successful Appointment Confirmation (No Incident)",
    input: {
      $json: {
        content: `Listo Maria! Quedo anotada tu cita para el 2026-08-10 a las 08:00 am.\n|||DATOS|||\n{{\"nombre\": \"Maria\", \"ciudad\": \"Maracay\", \"motivo_consulta\": \"Varices\", \"temperatura\": \"caliente\", \"resumen\": \"Cita agendada\", \"dia_cita\": \"2026-08-10\", \"hora_cita\": \"08:00\", \"requiere_asistencia_humana\": \"\"}}`
      }
    },
    expected: {
      has_quality_incident: false,
      tipo_incidencia: "",
      dia_cita: "2026-08-10",
      hora_cita: "08:00"
    }
  }
];

let testPasses = 0;
let testFails = 0;
const testResults = [];

for (const tc of testCases) {
  try {
    const result = runFormatearRespuesta(tc.input);
    let passed = true;
    let failReasons = [];

    if (tc.expected.has_quality_incident !== undefined && result.has_quality_incident !== tc.expected.has_quality_incident) {
      passed = false;
      failReasons.push(`has_quality_incident expected ${tc.expected.has_quality_incident}, got ${result.has_quality_incident}`);
    }

    if (tc.expected.tipo_incidencia !== undefined && result.tipo_incidencia !== tc.expected.tipo_incidencia) {
      passed = false;
      failReasons.push(`tipo_incidencia expected "${tc.expected.tipo_incidencia}", got "${result.tipo_incidencia}"`);
    }

    if (tc.expected.dia_cita !== undefined && result.dia_cita !== tc.expected.dia_cita) {
      passed = false;
      failReasons.push(`dia_cita expected "${tc.expected.dia_cita}", got "${result.dia_cita}"`);
    }

    if (tc.expected.hora_cita !== undefined && result.hora_cita !== tc.expected.hora_cita) {
      passed = false;
      failReasons.push(`hora_cita expected "${tc.expected.hora_cita}", got "${result.hora_cita}"`);
    }

    if (tc.expected.bot_reply !== undefined && result.bot_reply !== tc.expected.bot_reply) {
      passed = false;
      failReasons.push(`bot_reply expected "${tc.expected.bot_reply}", got "${result.bot_reply}"`);
    }

    if (tc.expected.bot_reply_contains !== undefined && (!result.bot_reply || !result.bot_reply.includes(tc.expected.bot_reply_contains))) {
      passed = false;
      failReasons.push(`bot_reply expected to contain "${tc.expected.bot_reply_contains}", got "${result.bot_reply}"`);
    }

    if (tc.expected.nombre !== undefined && result.nombre !== tc.expected.nombre) {
      passed = false;
      failReasons.push(`nombre expected "${tc.expected.nombre}", got "${result.nombre}"`);
    }

    if (passed) {
      testPasses++;
      console.log(`[PASS] ${tc.id}: ${tc.name}`);
      testResults.push({ id: tc.id, name: tc.name, status: "PASS", details: result });
    } else {
      testFails++;
      console.log(`[FAIL] ${tc.id}: ${tc.name}`);
      failReasons.forEach(r => console.log(`       - ${r}`));
      testResults.push({ id: tc.id, name: tc.name, status: "FAIL", reasons: failReasons, details: result });
    }
  } catch (e) {
    testFails++;
    console.log(`[ERROR] ${tc.id}: ${tc.name} threw exception: ${e.stack}`);
    testResults.push({ id: tc.id, name: tc.name, status: "ERROR", error: e.message });
  }
}

console.log("\n=================================================");
console.log(`SUMMARY: ${testPasses} PASSED, ${testFails} FAILED, TOTAL ${testCases.length}`);
console.log("=================================================\n");

// Export detailed JSON results for report generator
const reportSummary = {
  workflowPath,
  totalNodes: nodes.length,
  structuralFailures,
  formatearRespuestaId: formatearRespuestaNode ? formatearRespuestaNode.id : null,
  siIncidenciaId: siIncidenciaNode ? siIncidenciaNode.id : null,
  registrarIncidenciaId: registrarIncidenciaNode ? registrarIncidenciaNode.id : null,
  isConnectedToIf,
  isConnectedToLog,
  isZeroToken,
  testPasses,
  testFails,
  testResults
};

fs.writeFileSync('c:/Users/Leor/Desktop/bot whatsapp/.agents/challenger_4_1/verification_summary.json', JSON.stringify(reportSummary, null, 2));
console.log("Wrote verification summary to verification_summary.json");
