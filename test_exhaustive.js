const fs = require('fs');

const flowJson = JSON.parse(fs.readFileSync('flujo asistente de whatsapp.json', 'utf8'));
const nodeFormatear = flowJson.nodes.find(n => n.name === 'Formatear Respuesta');
const jsCode = nodeFormatear.parameters.jsCode;

function extractSanitizeTimes(code) {
  const match = code.match(/function sanitizeTimes\(text\) \{[\s\S]*?\n\}/);
  if (!match) throw new Error("sanitizeTimes function not found");
  return new Function('text', match[0] + '\nreturn sanitizeTimes(text);');
}

const sanitizeTimes = extractSanitizeTimes(jsCode);

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

const exhaustiveTests = [
  // 1. ISO Timestamps
  { group: "1. ISO Timestamps", text: "2026-07-27T08:30:00Z", expect: "2026-07-27T08:30:00Z" },
  { group: "1. ISO Timestamps", text: "2026-07-27 08:30:00", expect: "2026-07-27 08:30:00" },
  { group: "1. ISO Timestamps", text: "2026-07-27T10:15:45Z", expect: "2026-07-27T10:15:45Z" },
  { group: "1. ISO Timestamps", text: "2026-07-27T16:20:00-04:00", expect: "2026-07-27T16:20:00-04:00" },
  { group: "1. ISO Timestamps", text: "2026-07-27T08:30:00.000Z", expect: "2026-07-27T08:30:00.000Z" },
  { group: "1. ISO Timestamps", text: "2026-07-27T08:45:00Z", expect: "2026-07-27T08:45:00Z" },

  // 2. Prices
  { group: "2. Prices", text: "$12.30", expect: "$12.30" },
  { group: "2. Prices", text: "12.30$", expect: "12.30$" },
  { group: "2. Prices", text: "$12.15", expect: "$12.15" },
  { group: "2. Prices", text: "$12.20", expect: "$12.20" },
  { group: "2. Prices", text: "$12.45", expect: "$12.45" },
  { group: "2. Prices", text: "12.15$", expect: "12.15$" },
  { group: "2. Prices", text: "12.20$", expect: "12.20$" },
  { group: "2. Prices", text: "12.45$", expect: "12.45$" },
  { group: "2. Prices", text: "El precio es de $15.30 dólares.", expect: "El precio es de $15.30 dólares." },
  { group: "2. Prices", text: "Total a pagar: 25.45$ únicamente.", expect: "Total a pagar: 25.45$ únicamente." },
  { group: "2. Prices", text: "Cuesta 50.20 EUR por persona.", expect: "Cuesta 50.20 EUR por persona." },

  // 3. Phone Numbers
  { group: "3. Phone Numbers", text: "0412-3012345", expect: "0412-3012345" },
  { group: "3. Phone Numbers", text: "0414-1512345", expect: "0414-1512345" },
  { group: "3. Phone Numbers", text: "0424-2012345", expect: "0424-2012345" },
  { group: "3. Phone Numbers", text: "0416-4512345", expect: "0416-4512345" },
  { group: "3. Phone Numbers", text: "Contacto: 0412-301-2345", expect: "Contacto: 0412-301-2345" },
  { group: "3. Phone Numbers", text: "WhatsApp: +58 412 3012345", expect: "WhatsApp: +58 412 3012345" },
  { group: "3. Phone Numbers", text: "Oficina: (0212) 301-2345", expect: "Oficina: (0212) 301-2345" },

  // 4. Multi-paragraph, emojis & markdown
  { 
    group: "4. Markdown & Emojis", 
    text: "### Resumen de la Cita 🗓️\n\n- **Nombre**: Ana Rivas\n- **Fecha**: 2026-07-27\n- **Hora**: 8:30 am\n- **Costo**: $20.15\n\n📌 *Nota*: Si tienes dudas, contáctanos al `0412-3012345`.\n\n¡Gracias por preferirnos! 🙏✨", 
    expect: "### Resumen de la Cita 🗓️\n\n- **Nombre**: Ana Rivas\n- **Fecha**: 2026-07-27\n- **Hora**: 8:00 am\n- **Costo**: $20.15\n\n📌 *Nota*: Si tienes dudas, contáctanos al `0412-3012345`.\n\n¡Gracias por preferirnos! 🙏✨" 
  },

  // 5. Genuine Appointment Time Hallucinations to Sanitize
  { group: "5. Appointment Times", text: "8:30 am", expect: "8:00 am" },
  { group: "5. Appointment Times", text: "8:15 am", expect: "8:00 am" },
  { group: "5. Appointment Times", text: "8:20 am", expect: "8:00 am" },
  { group: "5. Appointment Times", text: "8:45 am", expect: "8:00 am" },
  { group: "5. Appointment Times", text: "9:30 pm", expect: "9:00 pm" },
  { group: "5. Appointment Times", text: "10:15 a.m.", expect: "10:00 a.m." },
  { group: "5. Appointment Times", text: "11:45 P.M.", expect: "11:00 P.M." },
  { group: "5. Appointment Times", text: "08:30 AM", expect: "08:00 AM" },
  { group: "5. Appointment Times", text: "a las 8:30", expect: "a las 8:00" },
  { group: "5. Appointment Times", text: "a las 09:15", expect: "a las 09:00" },
  { group: "5. Appointment Times", text: "a las 10:20", expect: "a las 10:00" },
  { group: "5. Appointment Times", text: "a las 11:45", expect: "a las 11:00" },
  { group: "5. Appointment Times", text: "a las 8 y media", expect: "a las 8:00" },
  { group: "5. Appointment Times", text: "a las 9 y 30", expect: "a las 9:00" },
  { group: "5. Appointment Times", text: "a las 10 y media", expect: "a las 10:00" }
];

console.log("=== EXHAUSTIVE EMPIRICAL TESTS FOR sanitizeTimes ===");
let passed = 0;
let failed = 0;

exhaustiveTests.forEach((t, i) => {
  const result = sanitizeTimes(t.text);
  const isOk = result === t.expect;
  if (isOk) passed++; else failed++;
  console.log(`Test ${i+1} [${t.group}] -> ${isOk ? 'OK' : 'FAIL'}`);
  if (!isOk) {
    console.log(`   Input:    ${JSON.stringify(t.text)}`);
    console.log(`   Expected: ${JSON.stringify(t.expect)}`);
    console.log(`   Actual:   ${JSON.stringify(result)}`);
  }
});

console.log(`\nDirect sanitizeTimes Summary: ${passed} PASSED, ${failed} FAILED out of ${exhaustiveTests.length}\n`);

// End-to-end node testing for edge cases
console.log("=== END-TO-END NODE VALIDATION SCENARIOS ===");

const nodeTests = [
  {
    name: "Sanitize hallucinated time 8:30 am to 08:00 in node output fields",
    input: {
      output: "Tu cita quedó para el 2026-07-27 a las 8:30 am.\n|||DATOS|||\n{\n\"nombre\":\"Pedro\",\n\"dia_cita\":\"2026-07-27\",\n\"hora_cita\":\"8:30 am\"\n}"
    },
    agenda: { agenda_disponible: "2026-07-27: 08:00, 09:00" },
    check: (res) => res.hora_cita === "08:00" && res.bot_reply.includes("8:00 am") && !res.requiere_asistencia_humana
  },
  {
    name: "Price with period ($12.30) preserved while 8:30 am sanitized",
    input: {
      output: "El costo es $12.30 y la cita es a las 8:30 am.\n|||DATOS|||\n{\n\"nombre\":\"Ana\",\n\"dia_cita\":\"2026-07-27\",\n\"hora_cita\":\"08:30\"\n}"
    },
    agenda: { agenda_disponible: "2026-07-27: 08:00" },
    check: (res) => res.bot_reply.includes("$12.30") && res.bot_reply.includes("8:00 am") && res.hora_cita === "08:00"
  },
  {
    name: "ISO timestamp preserved in text while appointment time sanitized",
    input: {
      output: "Registro 2026-07-27T08:30:00Z guardado. Te esperamos a las 8:30 am.\n|||DATOS|||\n{\n\"nombre\":\"Luis\",\n\"dia_cita\":\"2026-07-27\",\n\"hora_cita\":\"8:30 am\"\n}"
    },
    agenda: { agenda_disponible: "2026-07-27: 08:00" },
    check: (res) => res.bot_reply.includes("2026-07-27T08:30:00Z") && res.bot_reply.includes("8:00 am") && res.hora_cita === "08:00"
  },
  {
    name: "Phone number 0412-3012345 preserved while appointment time 10:30 am sanitized",
    input: {
      output: "Contactar a 0412-3012345. Tu cita es a las 10:30 am.\n|||DATOS|||\n{\n\"nombre\":\"Maria\",\n\"dia_cita\":\"2026-07-27\",\n\"hora_cita\":\"10:30 am\"\n}"
    },
    agenda: { agenda_disponible: "2026-07-27: 10:00" },
    check: (res) => res.bot_reply.includes("0412-3012345") && res.bot_reply.includes("10:00 am") && res.hora_cita === "10:00"
  }
];

nodeTests.forEach((nt, idx) => {
  try {
    const res = runNode(nt.input, {}, nt.agenda);
    const ok = nt.check(res);
    console.log(`Node Test ${idx + 1} [${nt.name}]: ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) console.log("   Output:", res);
  } catch (e) {
    console.log(`Node Test ${idx + 1} [${nt.name}]: EXCEPTION`, e);
  }
});
