const fs = require('fs');
const path = require('path');

// Read target code
const code = fs.readFileSync(path.join(__dirname, 'target_code.js'), 'utf-8');

function runNode(jsonInput, nodeData = {}) {
  // Wrap code in a function simulating n8n execution environment
  const wrapped = `
  function execute($json, $node) {
    ${code}
  }
  return execute(jsonInput, nodeData);
  `;
  const fn = new Function('jsonInput', 'nodeData', wrapped);
  return fn(jsonInput, nodeData);
}

// Default mock nodes
const mockNodes = {
  "Refrescar Datos de Supabase": {
    json: {
      chat_history: [
        { role: "user", content: "Hola" }
      ],
      Nombre: "Juan Perez",
      Ciudad: "Caracas",
      Motivo_Consulta: "Dolor de muela",
      Temperatura: "Calido",
      Resumen: "Cliente pregunta por citas",
      Dia_Cita: "",
      Hora_Cita: "",
      requiere_asistencia_humana: ""
    }
  },
  "Formatear Agenda": {
    json: {
      agenda_disponible: "2026-08-03: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00\n2026-08-04: 08:00, 09:00, 10:00, 11:00\n2026-08-05: NO LABORABLE"
    }
  }
};

const tests = [];

// Test 1: Saneamiento de Horarios :30 -> :00 in bot_reply and hora_cita
tests.push({
  name: "1. Saneamiento de Horarios :30 -> :00",
  run: () => {
    const input = {
      output: {
        text: "Te confirmo tu cita para el 2026-08-03 a las 10:30 am. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"10:30 am\"\n}"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      bot_reply: res.bot_reply,
      hora_cita: res.hora_cita,
      dia_cita: res.dia_cita,
      pass_reply: res.bot_reply.includes("10:00 am"),
      pass_hora: res.hora_cita === "10:00"
    };
  }
});

// Test 2: Saneamiento de Horarios "9 y media"
tests.push({
  name: "2. Saneamiento de Horarios '9 y media'",
  run: () => {
    const input = {
      output: {
        text: "Tu cita quedó a las 9 y media. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"09:00\"\n}"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      bot_reply: res.bot_reply,
      pass: res.bot_reply.includes("9:00")
    };
  }
});

// Test 3: Weekend date sanitization (Saturday)
tests.push({
  name: "3. Weekend sanitization (Saturday 2026-08-01)",
  run: () => {
    const input = {
      output: {
        text: "Te agendé para el sábado 2026-08-01 a las 10:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-01\",\n  \"hora_cita\": \"10:00\"\n}"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      bot_reply: res.bot_reply,
      dia_cita: res.dia_cita,
      hora_cita: res.hora_cita,
      alerta: res.requiere_asistencia_humana,
      pass_dia_wiped: res.dia_cita === "",
      pass_hora_wiped: res.hora_cita === "",
      pass_text_replaced: res.bot_reply.includes("el lunes") && !res.bot_reply.includes("el sábado"),
      pass_alerta: res.requiere_asistencia_humana.includes("fin de semana")
    };
  }
});

// Test 4: Markdown, {{ }}, and |||DATOS||| tags cleanup
tests.push({
  name: "4. Clean handling of markdown, {{ }}, |||DATOS|||",
  run: () => {
    const input = {
      output: {
        text: "Hola {{Juan}}, tu cita es el *2026-08-03* a las 10:00. |||DATOS|||\n```json\n{{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"10:00\"\n}}\n```"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      bot_reply: res.bot_reply,
      nombre: res.nombre,
      dia_cita: res.dia_cita,
      hora_cita: res.hora_cita,
      no_curly: !res.bot_reply.includes("{{") && !res.bot_reply.includes("}}"),
      no_datos_tag: !res.bot_reply.includes("|||DATOS|||")
    };
  }
});

// Test 5: Fallback when Gemini output is empty/null
tests.push({
  name: "5. Fallback on empty/null Gemini output",
  run: () => {
    const input = {
      output: {
        text: ""
      }
    };
    const res = runNode(input, mockNodes);
    return {
      bot_reply: res.bot_reply,
      alerta: res.requiere_asistencia_humana,
      pass_fallback: res.bot_reply === "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?",
      pass_alerta: res.requiere_asistencia_humana.includes("Respuesta de IA vacía")
    };
  }
});

// Test 6: Contract completeness (11 fields check)
tests.push({
  name: "6. Contract completeness (11 fields check)",
  run: () => {
    const input = {
      output: {
        text: "Hola, ¿cómo estás? En qué te puedo colaborar hoy?"
      }
    };
    const res = runNode(input, mockNodes);
    const keys = Object.keys(res);
    const expectedKeys = [
      "final_history", "bot_reply", "delay", "nombre", "ciudad",
      "motivo_consulta", "temperatura", "resumen", "dia_cita",
      "hora_cita", "requiere_asistencia_humana"
    ];
    const missing = expectedKeys.filter(k => !(k in res));
    const extra = keys.filter(k => !expectedKeys.includes(k));
    return {
      totalKeys: keys.length,
      keys: keys,
      missing: missing,
      extra: extra,
      pass: keys.length === 11 && missing.length === 0
    };
  }
});

// Test 7: Adversarial - Short response length (<= 15 chars)
tests.push({
  name: "7. Adversarial: Short Gemini response (e.g. '¡Hola! Claro.')",
  run: () => {
    const input = {
      output: {
        text: "¡Hola! Claro."
      }
    };
    const res = runNode(input, mockNodes);
    return {
      original: input.output.text,
      bot_reply: res.bot_reply,
      was_overwritten: res.bot_reply !== "¡Hola! Claro.",
      alerta: res.requiere_asistencia_humana
    };
  }
});

// Test 8: Adversarial - NO LABORABLE day in agenda with hour present in dayLine
tests.push({
  name: "8. Adversarial: NO LABORABLE day in agenda",
  run: () => {
    const input = {
      output: {
        text: "Te agendé el 2026-08-05 a las 10:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-05\",\n  \"hora_cita\": \"10:00\"\n}"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      dia_cita: res.dia_cita,
      hora_cita: res.hora_cita,
      alerta: res.requiere_asistencia_humana,
      pass_blocked: res.dia_cita === "" && res.requiere_asistencia_humana.includes("no laborable")
    };
  }
});

// Test 9: Adversarial - Invalid hour slot (e.g. 14:00)
tests.push({
  name: "9. Adversarial: Invalid hour slot (14:00 / 2 PM)",
  run: () => {
    const input = {
      output: {
        text: "Te agendé el 2026-08-03 a las 14:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"14:00\"\n}"
      }
    };
    const res = runNode(input, mockNodes);
    return {
      dia_cita: res.dia_cita,
      hora_cita: res.hora_cita,
      alerta: res.requiere_asistencia_humana,
      pass_blocked: res.dia_cita === "" && res.requiere_asistencia_humana.includes("Horario no permitido")
    };
  }
});

// Test 10: Adversarial - Missing patient name on appointment attempt
tests.push({
  name: "10. Adversarial: Appointment without patient name",
  run: () => {
    const customNodes = JSON.parse(JSON.stringify(mockNodes));
    customNodes["Refrescar Datos de Supabase"].json.Nombre = ""; // No name in DB either
    const input = {
      output: {
        text: "Cita agendada para el 2026-08-03 a las 10:00. |||DATOS|||\n{\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"10:00\"\n}"
      }
    };
    const res = runNode(input, customNodes);
    return {
      dia_cita: res.dia_cita,
      hora_cita: res.hora_cita,
      alerta: res.requiere_asistencia_humana,
      pass_blocked: res.dia_cita === "" && res.requiere_asistencia_humana.includes("sin nombre")
    };
  }
});

console.log("=== RUNNING TEST SUITE ===");
tests.forEach(t => {
  console.log(`\n--- Test: ${t.name} ---`);
  try {
    const out = t.run();
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error("ERROR:", e);
  }
});
