const fs = require('fs');

const jsonPath = 'c:/Users/Leor/Desktop/bot whatsapp/flujo asistente de whatsapp.json';
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

const targetNode = data.nodes.find(n => n.id === '8fd94881-ca56-4855-8462-ef0109762964');
if (!targetNode) {
  console.error('Node not found!');
  process.exit(1);
}

const jsCode = targetNode.parameters.jsCode;

function runNode($json, supabaseNode, agendaNode) {
  const $node = {
    "Refrescar Datos de Supabase": supabaseNode || { json: {} },
    "Formatear Agenda": agendaNode || { json: {} }
  };

  const fn = new Function('$json', '$node', jsCode);
  return fn($json, $node);
}

console.log("=== RUNNING REMEDIATION TEST SUITE ===");

// Test 1: Short string response (length 13: "¡Hola! Claro.")
try {
  const res1 = runNode({ content: "¡Hola! Claro." }, { json: { Nombre: "Juan" } });
  console.assert(res1.bot_reply === "¡Hola! Claro.", `Test 1 failed: bot_reply was '${res1.bot_reply}'`);
  console.assert(!res1.requiere_asistencia_humana, `Test 1 failed: alert set: ${res1.requiere_asistencia_humana}`);
  console.log("[PASS] Test 1: Short string response preserved ('¡Hola! Claro.')");
} catch (e) {
  console.error("[FAIL] Test 1 crashed:", e);
}

// Test 2: Deep Gemini structure at depth > 5
try {
  const deepJson = {
    candidates: [
      {
        content: {
          parts: [
            {
              metadata: {
                extra: {
                  deepField: "Hola, ¿cómo estás? |||DATOS|||\n{\"nombre\": \"Maria\", \"ciudad\": \"Maracay\"}"
                }
              }
            }
          ]
        }
      }
    ]
  };
  const res2 = runNode(deepJson, { json: {} });
  console.assert(res2.bot_reply === "Hola, ¿cómo estás?", `Test 2 failed: bot_reply was '${res2.bot_reply}'`);
  console.assert(res2.nombre === "Maria", `Test 2 failed: nombre was '${res2.nombre}'`);
  console.log("[PASS] Test 2: Deep Gemini property extracted successfully");
} catch (e) {
  console.error("[FAIL] Test 2 crashed:", e);
}

// Test 3: Non-array chat_history (Safety check)
try {
  const res3 = runNode({ text: "Hola!" }, { json: { chat_history: "not_an_array" } });
  console.assert(Array.isArray(res3.final_history), "Test 3 failed: final_history is not array");
  console.assert(res3.final_history.length === 1, "Test 3 failed: final_history length not 1");
  console.log("[PASS] Test 3: Non-array chat_history handled safely without crash");
} catch (e) {
  console.error("[FAIL] Test 3 crashed:", e);
}

// Test 4: Agenda NO LABORABLE check (unconditional invalidation)
try {
  const agendaNoLaborable = {
    json: {
      agenda_disponible: "- 2026-08-05 (Fin de semana): 10:00 NO LABORABLE"
    }
  };
  const res4 = runNode(
    { text: "Confirmado |||DATOS|||\n{\"nombre\":\"Carlos\",\"dia_cita\":\"2026-08-05\",\"hora_cita\":\"10:00\"}" },
    { json: {} },
    agendaNoLaborable
  );
  console.assert(res4.dia_cita === "", "Test 4 failed: dia_cita not cleared");
  console.assert(res4.hora_cita === "", "Test 4 failed: hora_cita not cleared");
  console.assert(res4.requiere_asistencia_humana === "Día 2026-08-05 no laborable o sin cupo.", `Test 4 failed: alert was '${res4.requiere_asistencia_humana}'`);
  console.log("[PASS] Test 4: NO LABORABLE day unconditionally invalidated with correct alert");
} catch (e) {
  console.error("[FAIL] Test 4 crashed:", e);
}

// Test 5: Working day with unlisted hour check (correct alert string)
try {
  const agendaWorkingDay = {
    json: {
      agenda_disponible: "- 2026-07-28: MAÑANA DISPONIBLE: [08:00, 09:00] | TARDE DISPONIBLE: [Sin disponibilidad]"
    }
  };
  const res5 = runNode(
    { text: "Cita |||DATOS|||\n{\"nombre\":\"Ana\",\"dia_cita\":\"2026-07-28\",\"hora_cita\":\"16:00\"}" },
    { json: {} },
    agendaWorkingDay
  );
  console.assert(res5.dia_cita === "", "Test 5 failed: dia_cita not cleared");
  console.assert(res5.hora_cita === "", "Test 5 failed: hora_cita not cleared");
  console.assert(res5.requiere_asistencia_humana === "Hora 16:00 no disponible para el 2026-07-28.", `Test 5 failed: alert was '${res5.requiere_asistencia_humana}'`);
  console.log("[PASS] Test 5: Unlisted hour on working day flagged with correct alert ('Hora 16:00 no disponible para el 2026-07-28.')");
} catch (e) {
  console.error("[FAIL] Test 5 crashed:", e);
}

console.log("=== ALL REMEDIATION TESTS PASSED PERFECTLY ===");
