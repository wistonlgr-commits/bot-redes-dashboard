import json

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
baseline_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json"

with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

with open(baseline_path, "r", encoding="utf-8") as f:
    baseline_data = json.load(f)

MODIFIABLE = {"Cerebro Inteligencia Artificial", "Formatear Agenda", "Formatear Respuesta"}

target_nodes = {n["name"]: n for n in target_data["nodes"]}
baseline_nodes = {n["name"]: n for n in baseline_data["nodes"]}

print(f"Total target nodes: {len(target_nodes)}")
print(f"Total baseline nodes: {len(baseline_nodes)}")

diffs = []
for name, b_node in baseline_nodes.items():
    if name in MODIFIABLE:
        continue
    t_node = target_nodes.get(name)
    if not t_node:
        diffs.append(f"Missing node: {name}")
    elif b_node != t_node:
        diffs.append(f"Node modified: {name}")

print(f"Unmodified nodes check (20 nodes):")
if not diffs:
    print("SUCCESS: All 20 non-modifiable nodes are 100% identical to baseline!")
else:
    print(f"FAIL: Found {len(diffs)} differences:")
    for d in diffs:
        print(f"  - {d}")

# Check connections
target_conn = target_data.get("connections")
baseline_conn = baseline_data.get("connections")

print(f"Connections check: {'IDENTICAL' if target_conn == baseline_conn else 'DIFFERENT'}")
