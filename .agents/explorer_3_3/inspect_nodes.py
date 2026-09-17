import json

file_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

extracted = []
for n in data.get("nodes", []):
    if n.get("name") in ["Cerebro Inteligencia Artificial", "Formatear Respuesta", "Formatear Agenda", "Guardar Resumen en Supabase", "Respaldar en Google Sheets"]:
        extracted.append(n)

with open(r"c:\Users\Leor\Desktop\bot whatsapp\.agents\explorer_3_3\nodes_detail.json", "w", encoding="utf-8") as f:
    json.dump(extracted, f, indent=2, ensure_ascii=False)

print("Extracted nodes to nodes_detail.json")
