import json

target_path = r'c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json'
with open(target_path, 'r', encoding='utf-8') as f:
    target = json.load(f)

ai_node = {n['name']: n for n in target['nodes']}['Cerebro Inteligencia Artificial']
prompt = ai_node['parameters']['messages']['values'][0]['content']

with open(r'c:\Users\Leor\Desktop\bot whatsapp\.agents\teamwork_preview_auditor_m2_1\extracted_prompt.txt', 'w', encoding='utf-8') as out:
    out.write(prompt)

print("Extracted prompt saved. Length:", len(prompt))
