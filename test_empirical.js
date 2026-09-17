const fs = require('fs');

// Read node code from flujo asistente de whatsapp.json
const flowJson = JSON.parse(fs.readFileSync('flujo asistente de whatsapp.json', 'utf8'));
const nodeFormatear = flowJson.nodes.find(n => n.name === 'Formatear Respuesta');
const jsCode = nodeFormatear.parameters.jsCode;

console.log("Loaded Formatear Respuesta JS Code length:", jsCode.length);

// Extract sanitizeTimes function from JS code
function extractSanitizeTimes(code) {
  const match = code.match(/function sanitizeTimes\(text\) \{[\s\S]*?\n\}/);
  if (!match) throw new Error("sanitizeTimes function not found");
  return new Function('text', match[0] + '\nreturn sanitizeTimes(text);');
}

const sanitizeTimes = extractSanitizeTimes(jsCode);

const testCases = [
  // 1. ISO Timestamps
  { category: "ISO Timestamps", input: "2026-07-27T08:30:00Z", expected: "2026-07-27T08:30:00Z" },
  { category: "ISO Timestamps", input: "2026-07-27 08:30:00", expected: "2026-07-27 08:30:00" },
  { category: "ISO Timestamps", input: "Fecha de creación: 2026-07-27T10:30:45Z.", expected: "Fecha de creación: 2026-07-27T10:30:45Z." },
  { category: "ISO Timestamps", input: "2026-07-27T14:15:00-04:00", expected: "2026-07-27T14:15:00-04:00" },

  // 2. Prices
  { category: "Prices", input: "El costo es $12.30 por consulta.", expected: "El costo es $12.30 por consulta." },
  { category: "Prices", input: "El precio final es 12.30$.", expected: "El precio final es 12.30$." },
  { category: "Prices", input: "Total: $10.15 y $8.45", expected: "Total: $10.15 y $8.45" },
  { category: "Prices", input: "Cuesta 45.30 $ en total.", expected: "Cuesta 45.30 $ en total." },

  // 3. Phone numbers
  { category: "Phone numbers", input: "Llámanos al 0412-3012345.", expected: "Llámanos al 0412-3012345." },
  { category: "Phone numbers", input: "Contacto: 0414-301-2345", expected: "Contacto: 0414-301-2345" },
  { category: "Phone numbers", input: "+58-412-3012345", expected: "+58-412-3012345" },

  // 4. Multi-paragraph messages with emojis and markdown formatting
  { 
    category: "Multi-paragraph & Emojis", 
    input: "¡Hola! 👋🏻\n\nTu cita está agendada para el **lunes 27 de julio** a las *8:30 am*.\n\n📍 Ubicación: Consultorio 3.\n💰 Precio: $15.30.\n📞 Dudas al 0412-3012345.\n\n¡Te esperamos! 😊", 
    expected: "¡Hola! 👋🏻\n\nTu cita está agendada para el **lunes 27 de julio** a las *8:00 am*.\n\n📍 Ubicación: Consultorio 3.\n💰 Precio: $15.30.\n📞 Dudas al 0412-3012345.\n\n¡Te esperamos! 😊" 
  },

  // Genuine Appointment Times (Hallucinations)
  { category: "Genuine Appointment Times", input: "8:30 am", expected: "8:00 am" },
  { category: "Genuine Appointment Times", input: "08:30 AM", expected: "08:00 AM" },
  { category: "Genuine Appointment Times", input: "8:30 a.m.", expected: "8:00 a.m." },
  { category: "Genuine Appointment Times", input: "10:15 pm", expected: "10:00 pm" },
  { category: "Genuine Appointment Times", input: "09:45 PM", expected: "09:00 PM" },
  { category: "Genuine Appointment Times", input: "a las 8:30", expected: "a las 8:00" },
  { category: "Genuine Appointment Times", input: "a las 8 y media", expected: "a las 8:00" },
  { category: "Genuine Appointment Times", input: "a las 11 y 30", expected: "a las 11:00" }
];

console.log("\n=== RUNNING EMPIRICAL TESTS ON sanitizeTimes ===\n");

let passed = 0;
let failed = 0;
const results = [];

testCases.forEach((tc, idx) => {
  const output = sanitizeTimes(tc.input);
  const isSuccess = output === tc.expected;
  if (isSuccess) passed++; else failed++;
  results.push({
    id: idx + 1,
    category: tc.category,
    input: tc.input,
    expected: tc.expected,
    actual: output,
    passed: isSuccess
  });
  console.log(`Test ${idx + 1} [${tc.category}]: ${isSuccess ? 'PASS' : 'FAIL'}`);
  if (!isSuccess) {
    console.log(`   Input:    ${JSON.stringify(tc.input)}`);
    console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(output)}`);
  }
});

console.log(`\nSummary: ${passed} PASSED, ${failed} FAILED out of ${testCases.length} tests.`);
