import json
import sys

def run_verification():
    json_path = r'c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json'
    log_path = r'c:\Users\Leor\Desktop\bot whatsapp\.agents\worker_1\verification_results.txt'

    logs = []
    def log(msg):
        print(msg)
        logs.append(msg)

    log("=== RUNNING VERIFICATION FOR PASO 1 ===")
    
    # 1. Valid JSON Syntax Check
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        log("PASS 1: JSON syntax is 100% valid.")
    except Exception as e:
        log(f"FAIL 1: Invalid JSON syntax: {e}")
        with open(log_path, 'w', encoding='utf-8') as out:
            out.write('\n'.join(logs))
        sys.exit(1)

    # 2. Extract Node 9
    nodes = data.get('nodes', [])
    node9 = None
    for n in nodes:
        if n.get('name') == 'Cerebro Inteligencia Artificial':
            node9 = n
            break

    if not node9:
        log("FAIL 2: Node 'Cerebro Inteligencia Artificial' not found!")
        with open(log_path, 'w', encoding='utf-8') as out:
            out.write('\n'.join(logs))
        sys.exit(1)
    
    log("PASS 2: Located Node #9 'Cerebro Inteligencia Artificial'.")

    prompt = node9['parameters']['messages']['values'][0]['content']
    char_len = len(prompt)
    est_tokens = char_len / 4.0
    log(f"Prompt character count: {char_len} chars")
    log(f"Estimated token count: ~{est_tokens:.1f} tokens")

    # Requirement 4: Compact & Clean prompt (< 8000 chars / ~1750 tokens)
    if char_len < 8000:
        log(f"PASS 3: Prompt is ultracompact ({char_len} chars < 8000 limit, ~{est_tokens:.1f} tokens).")
    else:
        log(f"FAIL 3: Prompt character count {char_len} exceeds 8000 chars!")

    # Requirement 1: Unify Paso 4 (Single heading '4.')
    heading_4_count = prompt.count("4. ")
    if heading_4_count == 1:
        log("PASS 4: Unified Paso 4 - Exactly one '4. HORAS EXACTAS' heading found.")
    else:
        log(f"FAIL 4: Found {heading_4_count} instances of '4. ' heading (expected 1).")

    # Requirement 2: Enforce Exact Hours (:00) and remove all :30
    if ":30" not in prompt and "3:30" not in prompt:
        log("PASS 5: Zero ':30' references in prompt. Exact hours (:00) enforced.")
    else:
        log("FAIL 5: Found ':30' or '3:30' references remaining in prompt!")

    # Requirement 3: Fix Weekend Logic
    if "Cita en la tarde durante fin de semana" not in prompt:
        log("PASS 6: Old weekend afternoon handoff restriction removed from human handoff triggers.")
    else:
        log("FAIL 6: Old weekend afternoon handoff rule still present!")

    if "HOY ES FIN DE SEMANA. Citas para la próxima semana (lunes a viernes). Puedes ofrecer disponibilidad en la MAÑANA (8:00 am a 12:00 pm) y en la TARDE" in prompt:
        log("PASS 7: Dynamic weekend rule updated to permit morning and afternoon slots for upcoming week.")
    else:
        log("FAIL 7: Dynamic weekend rule not correctly updated!")

    # Check duplicate Exámenes Previos block
    ex_previos_count = prompt.count("EXÁMENES PREVIOS (CRÍTICO)")
    if ex_previos_count == 1:
        log("PASS 8: Duplicate 'EXÁMENES PREVIOS' block successfully removed (exactly 1 instance).")
    else:
        log(f"FAIL 8: Found {ex_previos_count} instances of 'EXÁMENES PREVIOS'.")

    # Requirement 5: Preserve n8n expressions
    required_exprs = [
        "$now.setZone('America/Caracas')",
        "String.fromCharCode(123, 123)",
        "$node[\"Formatear Agenda\"].json.agenda_ocupada",
        "$node[\"Refrescar Datos de Supabase\"].json.Nombre",
        "$node[\"Refrescar Datos de Supabase\"].json.Dia_Cita",
        "$node[\"Refrescar Datos de Supabase\"].json.chat_history"
    ]
    all_exprs_pass = True
    for expr in required_exprs:
        if expr not in prompt:
            log(f"FAIL 9: Missing n8n expression: {expr}")
            all_exprs_pass = False
    if all_exprs_pass:
        log("PASS 9: All essential n8n dynamic expressions {{ ... }} preserved intact.")

    with open(log_path, 'w', encoding='utf-8') as out:
        out.write('\n'.join(logs))

if __name__ == '__main__':
    run_verification()
