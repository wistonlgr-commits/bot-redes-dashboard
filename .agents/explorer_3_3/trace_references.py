import json
import re

file_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()
    data = json.loads(content)

print("=== ALL NODES IN WORKFLOW ===")
for n in data.get("nodes", []):
    print(f"- {n.get('name')} (id: {n.get('id')}, type: {n.get('type')})")

print("\n=== EXPRESSIONS REFERENCING Formatear Respuesta ===")
matches = re.findall(r'(\$node\["Formatear Respuesta"\]|\$node\[\'Formatear Respuesta\'\])', content)
print(f"Count of Formatear Respuesta references: {len(matches)}")

print("\n=== EXPRESSIONS REFERENCING Cerebro Inteligencia Artificial ===")
matches_ai = re.findall(r'(\$node\["Cerebro Inteligencia Artificial"\]|\$node\[\'Cerebro Inteligencia Artificial\'\])', content)
print(f"Count of Cerebro Inteligencia Artificial references: {len(matches_ai)}")

print("\n=== DOWNSTREAM NODES FROM Formatear Respuesta ===")
conn = data.get("connections", {}).get("Formatear Respuesta", {})
print(json.dumps(conn, indent=2))
