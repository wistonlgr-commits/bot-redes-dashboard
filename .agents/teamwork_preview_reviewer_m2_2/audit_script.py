import json
import sys

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
baseline_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json"

with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

with open(baseline_path, "r", encoding="utf-8") as f:
    baseline_data = json.load(f)

print("--- AUDIT REPORT ---")
print(f"Target keys: {list(target_data.keys())}")
print(f"Baseline keys: {list(baseline_data.keys())}")

# 1. Node counts
target_nodes = target_data.get("nodes", [])
baseline_nodes = baseline_data.get("nodes", [])
print(f"Target node count: {len(target_nodes)}")
print(f"Baseline node count: {len(baseline_nodes)}")

# 2. Connections check
target_conn = target_data.get("connections", {})
baseline_conn = baseline_data.get("connections", {})
conn_match = (target_conn == baseline_conn)
print(f"Connections match baseline: {conn_match}")
if not conn_match:
    print(f"Target connections keys: {len(target_conn)}")
    print(f"Baseline connections keys: {len(baseline_conn)}")

# 3. Node mapping
target_map = {n["name"]: n for n in target_nodes}
baseline_map = {n["name"]: n for n in baseline_nodes}

print("\n--- NODE NAMES AUDIT ---")
target_names = set(target_map.keys())
baseline_names = set(baseline_map.keys())
print(f"Missing in target: {baseline_names - target_names}")
print(f"Extra in target: {target_names - baseline_names}")

# 4. Unmodified nodes check
modifiable = {"Cerebro Inteligencia Artificial", "Formatear Agenda", "Formatear Respuesta"}
unmodified_diffs = []
for name in baseline_names:
    if name in modifiable:
        continue
    t_node = target_map.get(name)
    b_node = baseline_map.get(name)
    if t_node != b_node:
        unmodified_diffs.append((name, t_node, b_node))

print(f"\nUnmodified nodes count: {len(baseline_names - modifiable)}")
print(f"Unmodified nodes with diffs: {len(unmodified_diffs)}")
for name, t_n, b_n in unmodified_diffs:
    print(f"Diff in node: {name}")

# 5. Cerebro Inteligencia Artificial audit
ai_node = target_map.get("Cerebro Inteligencia Artificial")
print("\n--- CEREBRO INTELIGENCIA ARTIFICIAL AUDIT ---")
if ai_node:
    params = ai_node.get("parameters", {})
    model_id = params.get("modelId", {})
    print(f"modelId: {model_id}")
    messages = params.get("messages", {}).get("values", [])
    if messages:
        content = messages[0].get("content", "")
        print(f"Prompt length (chars): {len(content)}")
        print(f"Prompt word count: {len(content.split())}")
        print(f"OBLIGATORIO count: {content.count('OBLIGATORIO')}")
        print(f"ESTRICTAMENTE count: {content.count('ESTRICTAMENTE')}")
        print(f"Has |||DATOS|||: {'|||DATOS|||' in content}")
        print(f"Has [AGENDA_DISPONIBLE]: {'[AGENDA_DISPONIBLE]' in content}")
        few_shots = ["Un gusto saludarte", "quedamos atentos", "Eco Doppler Venoso para un diagnóstico completo"]
        for fs in few_shots:
            print(f"Has few-shot '{fs}': {fs in content}")

# 6. Formatear Agenda audit
agenda_node = target_map.get("Formatear Agenda")
print("\n--- FORMATEAR AGENDA AUDIT ---")
if agenda_node:
    code = agenda_node.get("parameters", {}).get("jsCode", "")
    print(f"JS code length: {len(code)} chars")
    tokens = ["[BLOQUEO]", "SLOTS_PRESENCIAL", "SLOTS_ONLINE", "currentHourCaracas"]
    for tok in tokens:
        print(f"Has token '{tok}': {tok in code}")

# 7. Formatear Respuesta audit
resp_node = target_map.get("Formatear Respuesta")
print("\n--- FORMATEAR RESPUESTA AUDIT ---")
if resp_node:
    code = resp_node.get("parameters", {}).get("jsCode", "")
    print(f"JS code length: {len(code)} chars")
    tokens = ["sanitizeTimes", "has_quality_incident"]
    for tok in tokens:
        print(f"Has token '{tok}': {tok in code}")
