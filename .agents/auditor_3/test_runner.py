import json
import subprocess

with open(r'c:\Users\Leor\Desktop\bot whatsapp\.agents\auditor_3\js_code.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

# Make sanitizeTimes global for direct testing, then run main body in runNode
wrapper = f"""
{js_code}

function runNode($json, $node) {{
  // The code is executed in n8n scope
}}
"""

# Let's extract sanitizeTimes and findText definition or place them at file scope
wrapper_code = f"""
// MÓDULO 1: Desinfección de Horarios en Media Hora (:30 -> :00) y Expresiones Verbales
function sanitizeTimes(text) {{
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;
  cleaned = cleaned.replace(/(\\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\\s*(?:am|pm|a\\.m\\.|p\\.m\\.|AM|PM|A\\.M\\.|P\\.M\\.))/gi, '$1:00$2');
  cleaned = cleaned.replace(/(?<![\\d\\-])(\\b(?:[01]?\\d|2[0-3])):(?:15|20|30|45)\\b(?![\\d:\\-])/g, '$1:00');
  cleaned = cleaned.replace(/(\\b(?:1[0-2]|0?[1-9]))\\s+y\\s+(?:media|30)\\b/gi, '$1:00');
  return cleaned;
}}

function findText(obj, depth) {{
  if (depth > 5) return "";
  if (typeof obj === 'string' && obj.length > 15) return obj;
  if (Array.isArray(obj)) {{
    for (const item of obj) {{
      const found = findText(item, depth + 1);
      if (found) return found;
    }}
  }}
  if (typeof obj === 'object' && obj !== null) {{
    for (const val of Object.values(obj)) {{
      const found = findText(val, depth + 1);
      if (found) return found;
    }}
  }}
  return "";
}}

function executeNode($json, $node) {{
{js_code[js_code.find('// MÓDULO 3:'):]}
}}

console.log("=== TEST 1: sanitizeTimes ===");
console.log("10:30 am ->", sanitizeTimes("10:30 am"));
console.log("09:30 ->", sanitizeTimes("09:30"));
console.log("4 y media ->", sanitizeTimes("4 y media"));
console.log("16:30 pm ->", sanitizeTimes("16:30 pm"));
console.log("2026-07-26 ->", sanitizeTimes("2026-07-26"));
console.log("11:00 am ->", sanitizeTimes("11:00 am"));
console.log("8:15 ->", sanitizeTimes("8:15"));
console.log("5:45 pm ->", sanitizeTimes("5:45 pm"));

console.log("\\n=== TEST 2: Full Node Execution ===");
const mockJson = {{
  output: "Perfecto, tu cita queda agendada para el 2026-07-27 a las 10:30 am. |||DATOS|||{{\\"nombre\\": \\"Juan Perez\\", \\"ciudad\\": \\"Caracas\\", \\"motivo_consulta\\": \\"Ortodoncia\\", \\"temperatura\\": \\"normal\\", \\"resumen\\": \\"Consulta de valoracion\\", \\"dia_cita\\": \\"2026-07-27\\", \\"hora_cita\\": \\"10:30 am\\", \\"requiere_asistencia_humana\\": \\"false\\"}}"
}};
const mockNode = {{
  "Refrescar Datos de Supabase": {{
    json: {{
      chat_history: [],
      Nombre: "Juan Perez"
    }}
  }},
  "Formatear Agenda": {{
    json: {{
      agenda_disponible: "2026-07-27: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00"
    }}
  }}
}};

const res = executeNode(mockJson, mockNode);
console.log("Output:", JSON.stringify(res, null, 2));
"""

test_js_file = r'c:\Users\Leor\Desktop\bot whatsapp\.agents\auditor_3\test_runner.js'
with open(test_js_file, 'w', encoding='utf-8') as f:
    f.write(wrapper_code)

proc = subprocess.run(['node', test_js_file], capture_output=True, text=True)
print("STDOUT:")
print(proc.stdout)
print("STDERR:")
print(proc.stderr)
