import json

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(target_path, "r", encoding="utf-8") as f:
    data = json.load(f)

nodes = {n["name"]: n for n in data["nodes"]}
ai_node = nodes["Cerebro Inteligencia Artificial"]
prompt = ai_node["parameters"]["messages"]["values"][0]["content"]

print("=== SYSTEM PROMPT DETAILED AUDIT ===")
print(f"Length in chars: {len(prompt)}")
words = prompt.split()
print(f"Length in words: {len(words)}")
# Approximate token count (roughly 1.3 - 1.4 tokens per word for Spanish text, or len(prompt)/4)
print(f"Approx token estimate (len/4): {len(prompt)/4:.0f}")
print(f"Approx token estimate (words*1.3): {len(words)*1.3:.0f}")

print("\n--- KEYWORD COUNTS ---")
print(f"'OBLIGATORIO': {prompt.count('OBLIGATORIO')} (max: 2)")
print(f"'ESTRICTAMENTE': {prompt.count('ESTRICTAMENTE')} (max: 1)")

print("\n--- STRUCTURAL TAGS ---")
print(f"'|||DATOS|||' present: {'|||DATOS|||' in prompt}")
print(f"'[AGENDA_DISPONIBLE]' present: {'[AGENDA_DISPONIBLE]' in prompt}")
print(f"'requiere_asistencia_humana' present: {'requiere_asistencia_humana' in prompt}")

print("\n--- FEW-SHOT EXAMPLES ---")
few_shot_markers = [
    "Ejemplo 1", "Ejemplo 2", "Ejemplo 3", "Ejemplo 4", "Ejemplo 5",
    "Un gusto saludarte", "quedamos atentos", "Eco Doppler Venoso"
]
for m in few_shot_markers:
    print(f"Marker '{m}': {m in prompt}")

print("\n--- FIRST 300 CHARS ---")
print(repr(prompt[:300]))

print("\n--- LAST 300 CHARS ---")
print(repr(prompt[-300:]))
