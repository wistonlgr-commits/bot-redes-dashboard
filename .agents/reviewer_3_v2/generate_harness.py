import json

with open(r'c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

jsCode = ''
for node in data.get('nodes', []):
    if node.get('id') == '8fd94881-ca56-4855-8462-ef0109762964':
        jsCode = node.get('parameters', {}).get('jsCode', '')

wrappedCode = "(function() {\n" + jsCode + "\n})()"

test_runner_js = f'''const vm = require("vm");

function runNodeScript(jsonInput, supabaseNodeInput, agendaNodeInput) {{
    const context = {{
        $json: jsonInput,
        $node: {{
            "Refrescar Datos de Supabase": supabaseNodeInput || {{ json: {{}} }},
            "Formatear Agenda": agendaNodeInput || {{ json: {{}} }}
        }},
        console: console,
        Intl: Intl,
        Date: Date,
        Math: Math,
        parseInt: parseInt,
        isNaN: isNaN,
        Array: Array,
        Object: Object,
        RegExp: RegExp,
        String: String
    }};

    const code = {json.dumps(wrappedCode)};
    const script = new vm.Script(code);
    return script.runInNewContext(context);
}}

console.log("=== ADVERSARIAL STRESS TEST SUITE ===");

let passed = 0;
let total = 0;

function assert(condition, name, details = '') {{
    total++;
    if (condition) {{
        passed++;
        console.log(`[PASS] ${{name}}`);
    }} else {{
        console.error(`[FAIL] ${{name}} - ${{details}}`);
    }}
}}

// 1. Short text acceptance in findText
const r1 = runNodeScript({{ data: {{ message: "Ok" }} }});
assert(r1.bot_reply === "Ok", "findText accepts short text 'Ok'");

const r2 = runNodeScript({{ response: "Sí" }});
assert(r2.bot_reply === "Sí", "findText accepts short text 'Sí'");

// Priority check: content > text > findText
const r3 = runNodeScript({{ content: "Content wins", text: "Text loses", nested: "Nested loses" }});
assert(r3.bot_reply === "Content wins", "Priority $json.content");

const r4 = runNodeScript({{ text: "Text wins", nested: "Nested loses" }});
assert(r4.bot_reply === "Text wins", "Priority $json.text when content absent");

// 2. chat_history safety tests
const r5 = runNodeScript({{ content: "Hi" }}, {{ json: {{ chat_history: "string_val" }} }});
assert(Array.isArray(r5.final_history) && r5.final_history.length === 1, "chat_history handles string input gracefully");

const r6 = runNodeScript({{ content: "Hi" }}, {{ json: {{ chat_history: 12345 }} }});
assert(Array.isArray(r6.final_history) && r6.final_history.length === 1, "chat_history handles number input gracefully");

const r7 = runNodeScript({{ content: "Hi" }}, {{ json: {{ chat_history: [ {{ role: "user", content: "1" }} ] }} }});
assert(r7.final_history.length === 2, "chat_history preserves existing array history");

// 3. Alert categorization accuracy
// 3a. NO LABORABLE
const agendaNL = {{ json: {{ agenda_disponible: "2026-08-03: NO LABORABLE" }} }};
const r8 = runNodeScript({{ content: 'Ok |||DATOS||| {{"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"09:00"}}' }}, {{ json: {{}} }}, agendaNL);
assert(r8.requiere_asistencia_humana === "Día 2026-08-03 no laborable o sin cupo.", "Categorizes NO LABORABLE alert correctly", r8.requiere_asistencia_humana);

// 3b. Unlisted hour in agenda
const agendaPartial = {{ json: {{ agenda_disponible: "2026-08-03: 08:00, 09:00" }} }};
const r9 = runNodeScript({{ content: 'Ok |||DATOS||| {{"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"10:00"}}' }}, {{ json: {{}} }}, agendaPartial);
assert(r9.requiere_asistencia_humana === "Hora 10:00 no disponible para el 2026-08-03.", "Categorizes unlisted hour alert correctly", r9.requiere_asistencia_humana);

// 3c. Unlisted hour in validHours rule (e.g. 15:00)
const r10 = runNodeScript({{ content: 'Ok |||DATOS||| {{"nombre":"Ana","dia_cita":"2026-08-03","hora_cita":"15:00"}}' }}, {{ json: {{}} }}, agendaPartial);
assert(r10.requiere_asistencia_humana.includes("Horario no permitido detectado"), "Categorizes out-of-bounds business hour correctly", r10.requiere_asistencia_humana);

// 3d. Missing patient name
const r11 = runNodeScript({{ content: 'Ok |||DATOS||| {{"dia_cita":"2026-08-03","hora_cita":"08:00"}}' }}, {{ json: {{}} }}, agendaPartial);
assert(r11.requiere_asistencia_humana === "Intento de agendamiento sin nombre de paciente.", "Categorizes missing patient name alert correctly", r11.requiere_asistencia_humana);

// 4. Output Contract
const r12 = runNodeScript({{ content: "Test contract" }});
const keys = Object.keys(r12);
assert(keys.length === 11, "Output object has exactly 11 keys");
const requiredKeys = [
    'final_history', 'bot_reply', 'delay', 'nombre', 'ciudad',
    'motivo_consulta', 'temperatura', 'resumen', 'dia_cita',
    'hora_cita', 'requiere_asistencia_humana'
];
const missingKeys = requiredKeys.filter(k => !(k in r12));
assert(missingKeys.length === 0, "All 11 required keys are present", missingKeys.join(', '));

console.log(`\\nSummary: ${{passed}} / ${{total}} tests passed.`);
'''

with open(r'c:\Users\Leor\Desktop\bot whatsapp\.agents\reviewer_3_v2\test_harness.js', 'w', encoding='utf-8') as tf:
    tf.write(test_runner_js)
print("Updated test_harness.js generated")
