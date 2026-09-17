import json

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

node_map = {n.get("name"): n for n in target_data.get("nodes", [])}
agenda_node = node_map.get("Formatear Agenda")
agenda_js = agenda_node.get("parameters", {}).get("jsCode", "")

print("=== FORMATEAR AGENDA JS CODE ===")
print(agenda_js)
print("=== END FORMATEAR AGENDA JS CODE ===")
