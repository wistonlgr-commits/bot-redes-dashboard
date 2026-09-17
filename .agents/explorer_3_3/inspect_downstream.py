import json

file_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

for n in data.get("nodes", []):
    if n.get("name") in ["Enviar Mensaje de WhatsApp", "Guardar Resumen en Supabase", "Respaldar en Google Sheets"]:
        print(f"=== NODE: {n.get('name')} ===")
        print(json.dumps(n.get("parameters"), indent=2, ensure_ascii=False))
