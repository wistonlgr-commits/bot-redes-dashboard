import json

target_path = r'c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json'
with open(target_path, 'r', encoding='utf-8') as f:
    target = json.load(f)

ai_node = {n['name']: n for n in target['nodes']}['Cerebro Inteligencia Artificial']
prompt = ai_node['parameters']['messages']['values'][0]['content']

print("--- SYSTEM PROMPT ANALYSIS ---")
print("Char count:", len(prompt))
words = len(prompt.split())
print("Word count:", words)
print(f"Estimated tokens (~1.3 tokens/word): {int(words * 1.3)}")

print("OBLIGATORIO count:", prompt.count("OBLIGATORIO"))
print("ESTRICTAMENTE count:", prompt.count("ESTRICTAMENTE"))
print("|||DATOS||| present:", "|||DATOS|||" in prompt)
print("[AGENDA_DISPONIBLE] present:", "[AGENDA_DISPONIBLE]" in prompt)

few_shots = [
    "Un gusto saludarte",
    "quedamos atentos",
    "Eco Doppler Venoso para un diagnóstico completo"
]
for fs in few_shots:
    print(f"  - '{fs}':", fs in prompt)
