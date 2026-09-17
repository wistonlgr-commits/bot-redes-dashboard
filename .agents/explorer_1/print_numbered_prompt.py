import json

with open('flujo asistente de whatsapp.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

prompt = ""
for n in data.get('nodes', []):
    if n.get('name') == 'Cerebro Inteligencia Artificial':
        prompt = n['parameters']['messages']['values'][0]['content']

lines = prompt.splitlines()
with open('.agents/explorer_1/numbered_prompt.txt', 'w', encoding='utf-8') as out:
    for idx, line in enumerate(lines, 1):
        out.write(f"{idx:3d}: {line}\n")

print(f"Wrote {len(lines)} lines to numbered_prompt.txt")
