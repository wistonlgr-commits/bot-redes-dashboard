import subprocess
import json

with open(r'c:\Users\Leor\Desktop\bot whatsapp\.agents\auditor_3\js_code.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

test_suite_js = f"""
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

function runNode($json, $node) {{
{js_code[js_code.find('// MÓDULO 3:'):]}
}}

const results = [];

// Test 1: Valid appointment with :30 sanitization
{{
  const mockJson = {{
    output: "Perfecto Carlos, tu cita queda para el 2026-07-27 a las 10:30 am. |||DATOS|||{{\\"nombre\\": \\"Carlos Ramirez\\", \\"ciudad\\": \\"Caracas\\", \\"motivo_consulta\\": \\"Limpieza\\", \\"temperatura\\": \\"normal\\", \\"resumen\\": \\"Cita agendada\\", \\"dia_cita\\": \\"2026-07-27\\", \\"hora_cita\\": \\"10:30 am\\", \\"requiere_asistencia_humana\\": \\"false\\"}}"
  }};
  const mockNode = {{
    "Refrescar Datos de Supabase": {{ json: {{ chat_history: [], Nombre: "Carlos Ramirez" }} }},
    "Formatear Agenda": {{ json: {{ agenda_disponible: "2026-07-27: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00" }} }}
  }};
  results.push({{ test: "Valid :30 Sanitization", res: runNode(mockJson, mockNode) }});
}}

// Test 2: Invalid hour (14:00)
{{
  const mockJson = {{
    output: "Cita a las 2:00 pm. |||DATOS|||{{\\"nombre\\": \\"Ana\\", \\"dia_cita\\": \\"2026-07-27\\", \\"hora_cita\\": \\"2:00 pm\\"}}"
  }};
  const mockNode = {{
    "Refrescar Datos de Supabase": {{ json: {{ chat_history: [] }} }},
    "Formatear Agenda": {{ json: {{ agenda_disponible: "2026-07-27: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00" }} }}
  }};
  results.push({{ test: "Invalid Hour (14:00)", res: runNode(mockJson, mockNode) }});
}}

// Test 3: Missing patient name
{{
  const mockJson = {{
    output: "Cita agendada a las 10:00 am. |||DATOS|||{{\\"dia_cita\\": \\"2026-07-27\\", \\"hora_cita\\": \\"10:00 am\\"}}"
  }};
  const mockNode = {{
    "Refrescar Datos de Supabase": {{ json: {{ chat_history: [] }} }},
    "Formatear Agenda": {{ json: {{ agenda_disponible: "2026-07-27: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00" }} }}
  }};
  results.push({{ test: "Missing Patient Name", res: runNode(mockJson, mockNode) }});
}}

// Test 4: Weekend attempt
{{
  const mockJson = {{
    output: "Te agendamos este sábado 2026-08-01 a las 10:00 am. |||DATOS|||{{\\"nombre\\": \\"Pedro\\", \\"dia_cita\\": \\"2026-08-01\\", \\"hora_cita\\": \\"10:00 am\\"}}"
  }};
  const mockNode = {{
    "Refrescar Datos de Supabase": {{ json: {{ chat_history: [] }} }},
    "Formatear Agenda": {{ json: {{ agenda_disponible: "2026-08-01: 10:00" }} }}
  }};
  results.push({{ test: "Weekend Attempt", res: runNode(mockJson, mockNode) }});
}}

// Test 5: Empty response fallback
{{
  const mockJson = {{ output: "" }};
  const mockNode = {{
    "Refrescar Datos de Supabase": {{ json: {{ chat_history: [] }} }},
    "Formatear Agenda": {{ json: {{ agenda_disponible: "" }} }}
  }};
  results.push({{ test: "Empty AI Response Fallback", res: runNode(mockJson, mockNode) }});
}}

console.log(JSON.stringify(results, null, 2));
"""

with open(r'c:\Users\Leor\Desktop\bot whatsapp\.agents\auditor_3\run_suite.js', 'w', encoding='utf-8') as f:
    f.write(test_suite_js)

proc = subprocess.run(['node', r'c:\Users\Leor\Desktop\bot whatsapp\.agents\auditor_3\run_suite.js'], capture_output=True, text=True)
print("STDOUT:")
print(proc.stdout)
print("STDERR:")
print(proc.stderr)
