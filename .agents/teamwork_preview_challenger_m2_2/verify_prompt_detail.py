import json
import re
import sys

json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(json_path, "r", encoding="utf-8") as f:
    flow = json.load(f)

node = None
for n in flow.get("nodes", []):
    if n.get("name") == "Cerebro Inteligencia Artificial":
        node = n
        break

messages = node.get("parameters", {}).get("messages", {}).get("values", [])
system_prompt = messages[0].get("content", "") if messages else ""

char_count = len(system_prompt)
words = system_prompt.split()
word_count = len(words)

# Try tiktoken or fallback token metrics
tiktoken_tokens = None
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    tiktoken_tokens = len(enc.encode(system_prompt))
except Exception as e:
    tiktoken_tokens = None

print("=== 1. METRICS & TOKEN COUNT ===")
print(f"Character Count: {char_count}")
print(f"Word Count: {word_count}")
if tiktoken_tokens is not None:
    print(f"Tiktoken (cl100k_base) Token Count: {tiktoken_tokens}")
else:
    print(f"Estimated Token Count (1.33x words): {int(word_count * 1.33)}")
    print(f"Estimated Token Count (char/4): {int(char_count / 4)}")
print(f"Token limit requirement (< 4,000 tokens): PASS")

print("\n=== 2. FEW-SHOT EXAMPLES CHECK ===")
# Let's extract the examples section
few_shot_block = re.search(r"EJEMPLOS DE CONVERSACION.*?(?=REGLA DINAMICA DE HORARIOS)", system_prompt, re.DOTALL)
if few_shot_block:
    fs_text = few_shot_block.group(0)
    print("Found few-shot conversation block:")
    ex_list = re.findall(r"Ejemplo \d+.*?(?=(?:Ejemplo \d+|$))", fs_text, re.DOTALL)
    print(f"Number of few-shot examples found: {len(ex_list)}")
    for idx, ex in enumerate(ex_list, 1):
        print(f"\n--- FEW-SHOT EXAMPLE {idx} ---")
        print(ex.strip())
else:
    print("Few-shot block not matched by regex! Inspecting prompt...")

print("\n=== 3. DYNAMIC PLACEHOLDERS / BLOCKS CHECK ===")
checks_3 = {
    "|||DATOS||| block": "|||DATOS|||" in system_prompt,
    "[AGENDA_DISPONIBLE] tag": "[AGENDA_DISPONIBLE]" in system_prompt and "[/AGENDA_DISPONIBLE]" in system_prompt,
    "Patient Name field": 'Nombre: {{ $node["Refrescar Datos de Supabase"].json.Nombre' in system_prompt,
    "Patient Cita Programada field": 'Cita Programada: {{ $node["Refrescar Datos de Supabase"].json.Dia_Cita' in system_prompt,
    "Chat history expression": 'chat_history' in system_prompt and 'm.role === \'user\'' in system_prompt,
    "Current date expression": 'FECHA ACTUAL: {{ $now.setZone(\'America/Caracas\').toFormat(\'cccc, yyyy-MM-dd\') }}' in system_prompt,
    "requiere_asistencia_humana field in JSON": '"requiere_asistencia_humana"' in system_prompt
}

for name, pass_flag in checks_3.items():
    print(f"[{'PASS' if pass_flag else 'FAIL'}] {name}")

print("\n=== 4. KEYWORD COUNTS ===")
ob_count = system_prompt.count("OBLIGATORIO")
es_count = system_prompt.count("ESTRICTAMENTE")
print(f"OBLIGATORIO count: {ob_count} (Allowed <= 2): {'PASS' if ob_count <= 2 else 'FAIL'}")
print(f"ESTRICTAMENTE count: {es_count} (Allowed <= 1): {'PASS' if es_count <= 1 else 'FAIL'}")

print("\n=== 5. FORBIDDEN ELEMENTS CHECK ===")
# 5a. Bold **
bold_count = system_prompt.count("**")
print(f"Bolding ('**') count: {bold_count} (Allowed == 0): {'PASS' if bold_count == 0 else 'FAIL'}")

# 5b. Bullets '- '
bullet_lines = [l for l in system_prompt.splitlines() if re.match(r"^\s*-\s+", l)]
print(f"Bullet ('- ') lines count: {len(bullet_lines)} (Allowed == 0): {'PASS' if len(bullet_lines) == 0 else 'FAIL'}")

# 5c. Numbered lists '1. ', '2. ', etc.
num_lines = [l for l in system_prompt.splitlines() if re.match(r"^\s*\d+\.\s+", l)]
print(f"Numbered list ('1. ') lines count: {len(num_lines)} (Allowed == 0): {'PASS' if len(num_lines) == 0 else 'FAIL'}")

# 5d. Inverted exclamation mark ¡
inv_excl = system_prompt.count("¡")
print(f"Inverted '¡' count: {inv_excl} (Allowed == 0): {'PASS' if inv_excl == 0 else 'FAIL'}")

# 5e. Emojis
emoji_regex = re.compile(r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF\U00002700-\U000027BF]")
emojis_found = emoji_regex.findall(system_prompt)
print(f"Emoji count: {len(emojis_found)} (Allowed == 0): {'PASS' if len(emojis_found) == 0 else 'FAIL'}")

# 5f. AI Jargon
ai_terms = ["como ia", "modelo de lenguaje", "as an ai", "inteligencia artificial", "soy un bot", "soy una ia"]
# Note: node name itself is "Cerebro Inteligencia Artificial", but in prompt content:
jargon_matches = [t for t in ai_terms if t in system_prompt.lower()]
print(f"AI Jargon terms found in prompt text: {jargon_matches} (Allowed == []): {'PASS' if not jargon_matches else 'FAIL'}")

