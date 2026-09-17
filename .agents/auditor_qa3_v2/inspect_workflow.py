import json
import sys

target_file = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

try:
    with open(target_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    print("JSON Syntax Validity: VALID")
except Exception as e:
    print(f"JSON Syntax Validity: INVALID ({e})")
    sys.exit(1)

nodes = data.get("nodes", [])
connections = data.get("connections", {})

print(f"Total Nodes: {len(nodes)}")

nodes_by_name = {n.get("name"): n for n in nodes}
nodes_by_id = {n.get("id"): n for n in nodes}

print("\nNode List:")
for idx, n in enumerate(nodes, 1):
    print(f"{idx}. Name: '{n.get('name')}', ID: '{n.get('id')}', Type: '{n.get('type')}'")

# Look for Formatear Respuesta node
formatear_nodes = [n for n in nodes if "Formatear Respuesta" in n.get("name", "") or n.get("id") in ["0654eaec-ef7a-4ec0-951a-85d85fe77508", "8fd94881-ca56-4855-8462-ef0109762964"]]
print(f"\nFormatear Respuesta node count: {len(formatear_nodes)}")
for fn in formatear_nodes:
    print("--- Formatear Respuesta Node Detail ---")
    print(json.dumps(fn, indent=2, ensure_ascii=False))

