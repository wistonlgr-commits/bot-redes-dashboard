import json

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

node_map = {n.get("name"): n for n in target_data.get("nodes", [])}
resp_node = node_map.get("Formatear Respuesta")
resp_js = resp_node.get("parameters", {}).get("jsCode", "")

print("=== FORMATEAR RESPUESTA JS CODE ===")
print(resp_js[:500])
print("...")
print(resp_js[-500:])
print(f"Contains sanitizeTimes: {'sanitizeTimes' in resp_js}")
print(f"Contains has_quality_incident: {'has_quality_incident' in resp_js}")
