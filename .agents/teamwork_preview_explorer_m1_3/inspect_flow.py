import json

flow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

with open(flow_path, "r", encoding="utf-8") as f:
    data = json.load(f)

nodes = data.get("nodes", [])

for idx, n in enumerate(nodes, 1):
    print(f"{idx:02d} | ID: {n.get('id')} | Name: {repr(n.get('name'))} | Type: {n.get('type')} | Version: {n.get('typeVersion')} | Pos: {n.get('position')}")
