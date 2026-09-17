import json
import re
import sys

workflow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

print(f"--- 1. Testing JSON Syntax of {workflow_path} ---")
try:
    with open(workflow_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print("SUCCESS: JSON syntax is 100% valid.")
except Exception as e:
    print(f"FAILED: Invalid JSON syntax: {e}")
    sys.exit(1)

nodes = {node.get('name'): node for node in data.get('nodes', [])}
print(f"Total nodes found: {len(nodes)}")

results = []

# --- BUG-01 Verification ---
print("\n--- 2. Verifying BUG-01 (Cerebro Inteligencia Artificial) ---")
node_cerebro = nodes.get("Cerebro Inteligencia Artificial")
if not node_cerebro:
    results.append(("BUG-01", False, "Node 'Cerebro Inteligencia Artificial' not found"))
else:
    # Check parameters/options for system prompt or messages
    prompt_str = json.dumps(node_cerebro, ensure_ascii=False)
    has_toFormat = "$now.setZone('America/Caracas').toFormat(" in prompt_str
    has_old_format = "$now.setZone('America/Caracas').format(" in prompt_str
    
    print(f"Contains .toFormat(): {has_toFormat}")
    print(f"Contains old .format(): {has_old_format}")
    
    if has_toFormat and not has_old_format:
        results.append(("BUG-01", True, "Luxon `.toFormat()` is correctly used and `.format()` is completely removed."))
    else:
        results.append(("BUG-01", False, f"Fix check failed. toFormat={has_toFormat}, old_format={has_old_format}"))

# --- BUG-02 Verification ---
print("\n--- 3. Verifying BUG-02 (Crear Nuevo Paciente & Actualizar Última Interacción) ---")
node_crear = nodes.get("Crear Nuevo Paciente")
node_act = nodes.get("Actualizar Última Interacción")

bug2_ok = True
bug2_details = []

if not node_crear:
    bug2_ok = False
    bug2_details.append("Node 'Crear Nuevo Paciente' not found")
else:
    crear_str = json.dumps(node_crear, ensure_ascii=False)
    if "body?.data?.message?.conversation" in crear_str and "body?.data?.message?.extendedTextMessage?.text" in crear_str:
        bug2_details.append("Crear Nuevo Paciente has optional chaining `?.` on body, data, message, extendedTextMessage.")
    else:
        bug2_ok = False
        bug2_details.append(f"Crear Nuevo Paciente missing optional chaining: {crear_str[:200]}")

if not node_act:
    bug2_ok = False
    bug2_details.append("Node 'Actualizar Última Interacción' not found")
else:
    act_str = json.dumps(node_act, ensure_ascii=False)
    if "body?.data?.message?.conversation" in act_str and "body?.data?.message?.extendedTextMessage?.text" in act_str:
        bug2_details.append("Actualizar Última Interacción has optional chaining `?.` on body, data, message, extendedTextMessage.")
    else:
        bug2_ok = False
        bug2_details.append(f"Actualizar Última Interacción missing optional chaining: {act_str[:200]}")

results.append(("BUG-02", bug2_ok, " | ".join(bug2_details)))

# --- BUG-03 Verification ---
print("\n--- 4. Verifying BUG-03 (Enviar Mensaje de WhatsApp) ---")
node_enviar = nodes.get("Enviar Mensaje de WhatsApp")
if not node_enviar:
    results.append(("BUG-03", False, "Node 'Enviar Mensaje de WhatsApp' not found"))
else:
    enviar_str = json.dumps(node_enviar, ensure_ascii=False)
    expected_regex = r".replace(/@s\.whatsapp\.net|@c\.us/g, '')"
    old_replace = ".replace('@s.whatsapp.net', '')"
    
    has_regex = "/@s\\.whatsapp\\.net|@c\\.us/g" in enviar_str
    has_old = old_replace in enviar_str
    
    print(f"Contains regex replacement for @s.whatsapp.net and @c.us: {has_regex}")
    print(f"Contains old single string replace: {has_old}")
    
    if has_regex and not has_old:
        results.append(("BUG-03", True, "Regex `.replace(/@s\\.whatsapp\.net|@c\\.us/g, '')` correctly handles both @s.whatsapp.net and @c.us suffixes."))
    else:
        results.append(("BUG-03", False, f"BUG-03 check failed. has_regex={has_regex}, has_old={has_old}"))

# --- BUG-04 Verification ---
print("\n--- 5. Verifying BUG-04 (¿Es mensaje válido?) ---")
node_valido = nodes.get("¿Es mensaje válido?")
if not node_valido:
    results.append(("BUG-04", False, "Node '¿Es mensaje válido?' not found"))
else:
    valido_str = json.dumps(node_valido, ensure_ascii=False)
    
    c1 = "body?.event" in valido_str
    c2 = "body?.data?.key?.remoteJid" in valido_str
    c3 = "body?.data?.messageType" in valido_str
    
    print(f"Condition 1 (body?.event): {c1}")
    print(f"Condition 2 (body?.data?.key?.remoteJid): {c2}")
    print(f"Condition 3 (body?.data?.messageType): {c3}")
    
    if c1 and c2 and c3:
        results.append(("BUG-04", True, "All leftValue conditions in '¿Es mensaje válido?' use optional chaining `?.` safely handling empty or missing data/key properties."))
    else:
        results.append(("BUG-04", False, f"BUG-04 check failed. c1={c1}, c2={c2}, c3={c3}"))

print("\n================ SUMMARY ================")
all_passed = True
for bug_id, status, detail in results:
    status_str = "PASS" if status else "FAIL"
    print(f"[{status_str}] {bug_id}: {detail}")
    if not status:
        all_passed = False

print(f"\nOVERALL RESULT: {'100% PASS' if all_passed else 'FAILURE'}")
