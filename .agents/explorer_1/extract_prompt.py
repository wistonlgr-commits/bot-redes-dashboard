import json

filename = 'flujo asistente de whatsapp.json'
with open(filename, 'r', encoding='utf-8') as f:
    data = json.load(f)

node_cerebro = None
for n in data.get('nodes', []):
    if n.get('name') == 'Cerebro Inteligencia Artificial':
        node_cerebro = n
        break

if node_cerebro:
    print("Found 'Cerebro Inteligencia Artificial':")
    print("Node Type:", node_cerebro.get('type'))
    print("Parameters keys:", list(node_cerebro.get('parameters', {}).keys()))
    print("Full parameters JSON:")
    print(json.dumps(node_cerebro.get('parameters', {}), indent=2, ensure_ascii=False))
else:
    print("Node not found!")
