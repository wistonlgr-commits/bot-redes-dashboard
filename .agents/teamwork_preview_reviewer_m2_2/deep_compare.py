import json

with open(r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json", "r", encoding="utf-8") as f:
    target_data = json.load(f)

with open(r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json", "r", encoding="utf-8") as f:
    baseline_data = json.load(f)

target_nodes = {n["name"]: n for n in target_data["nodes"]}
baseline_nodes = {n["name"]: n for n in baseline_data["nodes"]}

modifiable = {"Cerebro Inteligencia Artificial", "Formatear Agenda", "Formatear Respuesta"}

print("=== DEEP COMPARISON OF UNMODIFIED NODES ===")
mismatches = []
for name, b_node in baseline_nodes.items():
    if name in modifiable:
        continue
    t_node = target_nodes.get(name)
    if not t_node:
        mismatches.append(f"Node '{name}' is missing in target!")
        continue
    
    # Check full dict equality
    if t_node != b_node:
        mismatches.append(f"Node '{name}' has differences!")
        # Find specific key diffs
        for k in b_node:
            if b_node[k] != t_node.get(k):
                mismatches.append(f"  - Key '{k}' mismatch in '{name}': base={b_node[k]} vs target={t_node.get(k)}")

if mismatches:
    print(f"FAILED: Found {len(mismatches)} mismatches:")
    for m in mismatches:
        print(m)
else:
    print("SUCCESS: All 20 unmodified nodes match original baseline 100% identically across all fields!")

print("\n=== DEEP COMPARISON OF CONNECTIONS ===")
if target_data["connections"] == baseline_data["connections"]:
    print("SUCCESS: Connections map matches original baseline topology 100% identically!")
else:
    print("FAILED: Connections map mismatch!")

print("\n=== DEEP COMPARISON OF WORKFLOW METADATA ===")
meta_keys = ["name", "active", "settings", "versionId", "meta", "id", "tags"]
for k in meta_keys:
    t_val = target_data.get(k)
    b_val = baseline_data.get(k)
    print(f"Key '{k}': target={t_val} | baseline={b_val} | match={t_val == b_val}")
