import json
import re

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

node_map = {n.get("name"): n for n in target_data.get("nodes", [])}
ai_node = node_map.get("Cerebro Inteligencia Artificial")
messages = ai_node.get("parameters", {}).get("messages", {}).get("values", [])
prompt = messages[0].get("content", "") if messages else ""

print("=== FULL PROMPT START ===")
print(prompt)
print("=== FULL PROMPT END ===")
