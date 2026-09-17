import json
import re
import sys

target_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
baseline_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json"

with open(target_path, "r", encoding="utf-8") as f:
    target_data = json.load(f)

with open(baseline_path, "r", encoding="utf-8") as f:
    baseline_data = json.load(f)

nodes = target_data.get("nodes", [])
node_map = {n.get("name"): n for n in nodes}

# 1. Cerebro Inteligencia Artificial
ai_node = node_map.get("Cerebro Inteligencia Artificial")
print("=== NODE: Cerebro Inteligencia Artificial ===")
model_val = ai_node.get("parameters", {}).get("modelId", {}).get("value")
model_cache = ai_node.get("parameters", {}).get("modelId", {}).get("cachedResultName")
print(f"Model ID value: {model_val}")
print(f"Model ID cachedResultName: {model_cache}")

messages = ai_node.get("parameters", {}).get("messages", {}).get("values", [])
prompt = messages[0].get("content", "") if messages else ""

char_count = len(prompt)
word_count = len(prompt.split())
# Estimate tokens
est_tokens = len(prompt) // 3.5
print(f"Prompt Length: {char_count} chars, {word_count} words (Est. tokens: ~{int(est_tokens)})")

ob_count = prompt.count("OBLIGATORIO")
es_count = prompt.count("ESTRICTAMENTE")
print(f"Count of 'OBLIGATORIO': {ob_count} (Limit <= 2)")
print(f"Count of 'ESTRICTAMENTE': {es_count} (Limit <= 1)")

has_bold = "**" in prompt
lines_with_dash_bullet = [line for line in prompt.split('\n') if re.match(r'^\s*-\s+', line)]
lines_with_num_bullet = [line for line in prompt.split('\n') if re.match(r'^\s*\d+\.\s+', line)]
has_inverted_exclamation = "¡" in prompt

# Emojis regex
emoji_pattern = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002600-\U000026FF"  # misc symbols
    "\U00002700-\U000027BF"  # dingbats
    "]+", flags=re.UNICODE
)
emojis_found = emoji_pattern.findall(prompt)

ai_buzzwords = ["asistente de ia", "modelo de lenguaje", "inteligencia artificial", "soy una ia", "soy un modelo"]
ai_words_found = [bw for bw in ai_buzzwords if bw in prompt.lower()]

print(f"Forbidden formatting check:")
print(f"  Bold '**': {has_bold}")
print(f"  Dash bullets ('- '): {len(lines_with_dash_bullet)} found -> {lines_with_dash_bullet[:3]}")
print(f"  Numbered bullets ('1. '): {len(lines_with_num_bullet)} found -> {lines_with_num_bullet[:3]}")
print(f"  Inverted exclamation '¡': {has_inverted_exclamation}")
print(f"  Emojis found: {emojis_found}")
print(f"  AI buzzwords found: {ai_words_found}")

print("\n--- Checking Few-Shot Examples ---")
examples = re.findall(r"Ejemplo \d+:.*?(?=(?:Ejemplo \d+:|\|\|\|DATOS\|\|\||$))", prompt, re.DOTALL)
print(f"Number of few-shot examples parsed: {len(examples)}")
for i, ex in enumerate(examples, 1):
    lines = [l.strip() for l in ex.strip().split('\n') if l.strip()]
    print(f"  Example {i}: {lines[0] if lines else ''}")

print("\n=== NODE: Formatear Agenda ===")
agenda_node = node_map.get("Formatear Agenda")
agenda_js = agenda_node.get("parameters", {}).get("jsCode", "")
print(f"Formatear Agenda JS length: {len(agenda_js)} chars")

print("\n=== NODE: Formatear Respuesta ===")
resp_node = node_map.get("Formatear Respuesta")
resp_js = resp_node.get("parameters", {}).get("jsCode", "")
base_resp_node = {n.get("name"): n for n in baseline_data.get("nodes", [])}.get("Formatear Respuesta")
base_resp_js = base_resp_node.get("parameters", {}).get("jsCode", "")
print(f"Formatear Respuesta JS identical to baseline: {resp_js == base_resp_js}")

