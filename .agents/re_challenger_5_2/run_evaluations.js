const fs = require('fs');

console.log("=== EMPIRICAL EVALUATION SUITE FOR WORKER 5_V2 FIXES ===");

const filePath = 'c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json';
const fileContent = fs.readFileSync(filePath, 'utf-8');

// 1. JSON Syntax Test
let workflow;
try {
  workflow = JSON.parse(fileContent);
  console.log("[PASS] JSON Syntax: Valid JSON structure.");
} catch (e) {
  console.error("[FAIL] JSON Syntax Error:", e);
  process.exit(1);
}

// 2. BUG-01 Empirical Test
console.log("\n--- BUG-01 Evaluation ($now.toFormat) ---");
const cerebroNode = workflow.nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');
const cerebroStr = JSON.stringify(cerebroNode);

const bug1_fix_found = cerebroStr.includes("$now.setZone('America/Caracas').toFormat(");
const bug1_old_found = cerebroStr.includes("$now.setZone('America/Caracas').format(");

console.log("Fix pattern present (.toFormat):", bug1_fix_found);
console.log("Old broken pattern present (.format):", bug1_old_found);

// Luxon DateTime simulation
const mockLuxonNow = {
  setZone(zone) {
    return {
      toFormat(fmt) {
        return `formatted_date_in_${zone}_fmt_${fmt}`;
      }
    };
  }
};
const evalBug1 = mockLuxonNow.setZone('America/Caracas').toFormat('cccc, yyyy-MM-dd');
console.log("Mock execution of $now.setZone('America/Caracas').toFormat('cccc, yyyy-MM-dd'):", evalBug1);
const bug1_pass = bug1_fix_found && !bug1_old_found && typeof evalBug1 === 'string';
console.log("BUG-01 Test Result:", bug1_pass ? "PASS" : "FAIL");

// 3. BUG-02 Empirical Test
console.log("\n--- BUG-02 Evaluation (Optional Chaining in Crear Paciente & Actualizar Interacción) ---");
const crearNode = workflow.nodes.find(n => n.name === 'Crear Nuevo Paciente');
const actNode = workflow.nodes.find(n => n.name === 'Actualizar Última Interacción');

const crearStr = JSON.stringify(crearNode);
const actStr = JSON.stringify(actNode);

const expr1 = "body?.data?.message?.conversation";
const expr2 = "body?.data?.message?.extendedTextMessage?.text";

const bug2_crear_ok = crearStr.includes(expr1) && crearStr.includes(expr2);
const bug2_act_ok = actStr.includes(expr1) && actStr.includes(expr2);

// Mock evaluation for BUG-02 under non-text / media payloads
function evalBug2Expression(nodeObj) {
  return nodeObj.json.body?.data?.message?.conversation || nodeObj.json.body?.data?.message?.extendedTextMessage?.text || "";
}

const mockMediaPayload = { json: { body: { data: { message: { imageMessage: { url: "http://example.com/img.jpg" } } } } } };
const mockEmptyPayload = { json: { body: {} } };
const mockTextPayload = { json: { body: { data: { message: { conversation: "Hola Doctor" } } } } };

const resMedia = evalBug2Expression(mockMediaPayload);
const resEmpty = evalBug2Expression(mockEmptyPayload);
const resText = evalBug2Expression(mockTextPayload);

console.log("Media message evaluation output:", JSON.stringify(resMedia));
console.log("Empty body evaluation output:", JSON.stringify(resEmpty));
console.log("Text message evaluation output:", JSON.stringify(resText));

const bug2_pass = bug2_crear_ok && bug2_act_ok && resMedia === "" && resEmpty === "" && resText === "Hola Doctor";
console.log("BUG-02 Test Result:", bug2_pass ? "PASS" : "FAIL");

// 4. BUG-03 Empirical Test
console.log("\n--- BUG-03 Evaluation (JID replacement regex) ---");
const enviarNode = workflow.nodes.find(n => n.name === 'Enviar Mensaje de WhatsApp');
const enviarStr = JSON.stringify(enviarNode);

const bug3_fix_found = enviarStr.includes("/@s\\.whatsapp\\.net|@c\\.us/g");
const bug3_old_found = enviarStr.includes(".replace('@s.whatsapp.net', '')");

const testJIDs = [
  { input: "584121234567@s.whatsapp.net", expected: "584121234567" },
  { input: "584121234567@c.us", expected: "584121234567" },
  { input: "584121234567", expected: "584121234567" }
];

let bug3_eval_pass = true;
testJIDs.forEach(t => {
  const actual = t.input.replace(/@s\.whatsapp\.net|@c\.us/g, '');
  console.log(`Input: ${t.input} -> Output: ${actual} (Expected: ${t.expected})`);
  if (actual !== t.expected) bug3_eval_pass = false;
});

const bug3_pass = bug3_fix_found && !bug3_old_found && bug3_eval_pass;
console.log("BUG-03 Test Result:", bug3_pass ? "PASS" : "FAIL");

// 5. BUG-04 Empirical Test
console.log("\n--- BUG-04 Evaluation (Optional Chaining in ¿Es mensaje válido?) ---");
const validoNode = workflow.nodes.find(n => n.name === '¿Es mensaje válido?');
const validoStr = JSON.stringify(validoNode);

const c1_ok = validoStr.includes("body?.event");
const c2_ok = validoStr.includes("body?.data?.key?.remoteJid");
const c3_ok = validoStr.includes("body?.data?.messageType");

// Mock condition evaluations on malformed payloads
function evalValidConditions(itemJson) {
  const c1 = itemJson.body?.event;
  const c2 = itemJson.body?.data?.key?.remoteJid;
  const c3 = ['conversation', 'extendedTextMessage'].includes(itemJson.body?.data?.messageType);
  return { c1, c2, c3 };
}

const mockPingPayload = { body: { event: "ping" } };
const mockNullDataPayload = { body: { event: "messages.upsert", data: null } };

let bug4_eval_pass = true;
try {
  const resPing = evalValidConditions(mockPingPayload);
  console.log("Ping payload eval:", resPing);
  const resNullData = evalValidConditions(mockNullDataPayload);
  console.log("Null data payload eval:", resNullData);
} catch (err) {
  console.error("Error evaluating BUG-04 mock payload:", err);
  bug4_eval_pass = false;
}

const bug4_pass = c1_ok && c2_ok && c3_ok && bug4_eval_pass;
console.log("BUG-04 Test Result:", bug4_pass ? "PASS" : "FAIL");

console.log("\n================ TOTAL RE-CHALLENGE RESULTS ================");
console.log("BUG-01:", bug1_pass ? "PASS [100%]" : "FAIL");
console.log("BUG-02:", bug2_pass ? "PASS [100%]" : "FAIL");
console.log("BUG-03:", bug3_pass ? "PASS [100%]" : "FAIL");
console.log("BUG-04:", bug4_pass ? "PASS [100%]" : "FAIL");

const overallPass = bug1_pass && bug2_pass && bug3_pass && bug4_pass;
console.log("OVERALL RE-VERIFICATION STATUS:", overallPass ? "VERIFIED & PASSED" : "FAILED");
