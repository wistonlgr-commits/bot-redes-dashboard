import json
import re
import sys

# Load workflow JSON
json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(json_path, "r", encoding="utf-8") as f:
    flow = json.load(f)

# Find node Cerebro Inteligencia Artificial
node = None
for n in flow.get("nodes", []):
    if n.get("name") == "Cerebro Inteligencia Artificial":
        node = n
        break

if not node:
    print("ERROR: Cerebro Inteligencia Artificial node not found!")
    sys.exit(1)

# Extract System Prompt
messages = node.get("parameters", {}).get("messages", {}).get("values", [])
system_prompt = messages[0].get("content", "") if messages else ""

print("=== SYSTEM PROMPT ANALYSIS ===")
print(f"System Prompt Length (chars): {len(system_prompt)}")
words = system_prompt.split()
word_count = len(words)
print(f"Word Count: {word_count}")

# Token estimation / tiktoken if available
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    tokens_cl100k = len(enc.encode(system_prompt))
    print(f"Tiktoken (cl100k_base) Token Count: {tokens_cl100k}")
    enc_o200k = tiktoken.get_encoding("o200k_base")
    tokens_o200k = len(enc_o200k.encode(system_prompt))
    print(f"Tiktoken (o200k_base) Token Count: {tokens_o200k}")
except Exception as e:
    print(f"Tiktoken import error / unavailable: {e}")
    # Standard estimate: 1 word ~ 1.3 tokens or char/4
    est_tokens = int(word_count * 1.3)
    print(f"Estimated Token Count (1.3x words): {est_tokens}")

print(f"Token limit constraint (< 4,000 tokens): {'PASS' if word_count * 1.5 < 4000 else 'FAIL'}")

print("\n=== KEYWORD COUNTS ===")
ob_count = system_prompt.count("OBLIGATORIO")
es_count = system_prompt.count("ESTRICTAMENTE")
print(f"OBLIGATORIO count: {ob_count} (Max allowed: 2) -> {'PASS' if ob_count <= 2 else 'FAIL'}")
print(f"ESTRICTAMENTE count: {es_count} (Max allowed: 1) -> {'PASS' if es_count <= 1 else 'FAIL'}")

print("\n=== FORBIDDEN ELEMENTS CHECK ===")
# 1. Bolding **
bold_matches = re.findall(r"\*\*.*?\*\*", system_prompt)
print(f"Bolding '**' matches: {len(bold_matches)} -> {bold_matches if bold_matches else 'PASS'}")

# 2. Bullets '- ' at start of line or item
bullet_matches = re.findall(r"^\s*-\s+", system_prompt, flags=re.MULTILINE)
print(f"Bullet '- ' lines: {len(bullet_matches)} -> {'PASS' if len(bullet_matches) == 0 else 'FAIL'}")

# 3. Numbered lists '1. ', '2. ', etc.
num_list_matches = re.findall(r"^\s*\d+\.\s+", system_prompt, flags=re.MULTILINE)
print(f"Numbered list lines: {len(num_list_matches)} -> {'PASS' if len(num_list_matches) == 0 else 'FAIL'}")

# 4. Inverted exclamation mark ¡
inv_excl_count = system_prompt.count("¡")
print(f"Inverted '¡' count: {inv_excl_count} -> {'PASS' if inv_excl_count == 0 else 'FAIL'}")

# 5. Emojis (unicode emoji range check)
emoji_pattern = re.compile(r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF\U00002700-\U000027BF]")
emojis_found = emoji_pattern.findall(system_prompt)
print(f"Emoji count: {len(emojis_found)} -> {'PASS' if len(emojis_found) == 0 else 'FAIL'}")

# 6. AI Jargon (e.g., 'Como IA', 'Como modelo de lenguaje', 'IA', 'As an AI')
ai_jargon_terms = ["como ia", "modelo de lenguaje", "as an ai", "inteligencia artificial", "soy un bot", "soy una ia"]
found_jargon = [term for term in ai_jargon_terms if term in system_prompt.lower()]
print(f"AI Jargon found: {found_jargon} -> {'PASS' if not found_jargon else 'FAIL'}")


print("\n=== DYNAMIC PLACEHOLDERS / BLOCKS CHECK ===")
placeholders = {
    "|||DATOS|||": "|||DATOS|||" in system_prompt,
    "[AGENDA_DISPONIBLE]": "[AGENDA_DISPONIBLE]" in system_prompt,
    "requiere_asistencia_humana": "requiere_asistencia_humana" in system_prompt,
    "resumen_caso": "resumen_caso" in system_prompt,
    "Paciente / Nombre": "nombre" in system_prompt.lower() or "paciente" in system_prompt.lower(),
    "Historial de chat": "historial" in system_prompt.lower() or "chat" in system_prompt.lower(),
    "Fecha / Hora actual": "fecha" in system_prompt.lower() or "hora" in system_prompt.lower() or "today" in system_prompt.lower() or "ahora" in system_prompt.lower()
}
for name, present in placeholders.items():
    print(f"Placeholder/Field '{name}': {'PASS' if present else 'FAIL'}")


print("\n=== FEW-SHOT EXAMPLES CHECK ===")
# Find examples in system prompt
examples = re.findall(r"Ejemplo \d+:.*?(?=Ejemplo \d+:|$)", system_prompt, flags=re.DOTALL)
if not examples:
    # Try alternative matching for EJEMPLO or few-shot sections
    examples = re.findall(r"EJEMPLO \d+:.*?(?=EJEMPLO \d+:|$)", system_prompt, flags=re.DOTALL)

print(f"Number of examples found in prompt: {len(examples)}")
for idx, ex in enumerate(examples, 1):
    print(f"--- Example {idx} snippet ---")
    lines = [line.strip() for line in ex.strip().split("\n") if line.strip()][:4]
    print("\n".join(lines))
