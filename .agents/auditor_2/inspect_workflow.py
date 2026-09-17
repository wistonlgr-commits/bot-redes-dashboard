import json
import sys

json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

nodes = data.get("nodes", [])
print(f"Total nodes: {len(nodes)}")

node_15 = None
node_9 = None

for idx, n in enumerate(nodes):
    name = n.get("name")
    if name == "Formatear Agenda":
        node_15 = n
        print(f"Found Node Formatear Agenda at index {idx}, ID: {n.get('id')}")
    elif name == "Cerebro Inteligencia Artificial":
        node_9 = n
        print(f"Found Node Cerebro Inteligencia Artificial at index {idx}, ID: {n.get('id')}")

print("\n--- NODE #15 (Formatear Agenda) ---")
if node_15:
    js_code = node_15.get("parameters", {}).get("jsCode", "")
    print(f"JS Code Length: {len(js_code)}")
    print("JS Code preview (first 500 chars):")
    print(js_code[:500])
    print("\nJS Code preview (last 500 chars):")
    print(js_code[-500:])

print("\n--- NODE #9 (Cerebro Inteligencia Artificial) ---")
if node_9:
    prompt = node_9.get("parameters", {}).get("prompt", {}).get("messages", [{}])[0].get("content", "")
    print(f"Prompt Length: {len(prompt)}")
    print("Prompt containing AGENDA:")
    for line in prompt.split("\n"):
        if "AGENDA" in line or "agenda" in line or "Formatear Agenda" in line:
            print("  ", line)
