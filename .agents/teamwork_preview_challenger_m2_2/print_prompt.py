import json

json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(json_path, "r", encoding="utf-8") as f:
    flow = json.load(f)

for n in flow.get("nodes", []):
    if n.get("name") == "Cerebro Inteligencia Artificial":
        messages = n.get("parameters", {}).get("messages", {}).get("values", [])
        prompt = messages[0].get("content", "") if messages else ""
        print("=== SYSTEM PROMPT START ===")
        print(prompt)
        print("=== SYSTEM PROMPT END ===")
