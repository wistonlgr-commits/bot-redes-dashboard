import json
import re

with open('flujo asistente de whatsapp.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

prompt = ""
for n in data.get('nodes', []):
    if n.get('name') == 'Cerebro Inteligencia Artificial':
        prompt = n['parameters']['messages']['values'][0]['content']

print(f"Total prompt length: {len(prompt)} characters")
words = prompt.split()
print(f"Total word count: {len(words)} words")
# Rough token estimate for Spanish text (~1.3 - 1.4 tokens per word or ~3.8 chars per token)
est_tokens = len(prompt) / 3.8
print(f"Estimated token count: ~{int(est_tokens)} tokens")

print("\n--- Section Analysis ---")
sections = prompt.split('\n\n')
print(f"Total paragraphs/sections: {len(sections)}")

print("\n--- Duplicate Headers / Sections ---")
headers = [line for line in prompt.splitlines() if line.isupper() or line.startswith('- ') or re.match(r'^\d+\.', line)]
print("Found numbered steps:")
for line in prompt.splitlines():
    if re.match(r'^\d+\.', line):
        print("  ", line)

print("\n--- Checking Repeated Instructions ---")
# Check repeated sentences or terms
keywords = ["EXÁMENES PREVIOS", "Paso 4", "4.", "HORAS EN PUNTO", "Eco Doppler", "requiere_asistencia_humana", " Zelle", "BCV"]
for kw in keywords:
    matches = [i for i, line in enumerate(prompt.splitlines()) if kw.lower() in line.lower()]
    print(f"Keyword '{kw}' appears {len(matches)} times on lines: {matches}")
