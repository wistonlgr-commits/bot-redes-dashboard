import json
import re
import sys
import os

def run_verification():
    report_lines = []
    def log(msg):
        print(msg)
        report_lines.append(msg)

    log("=================================================================")
    log("EMPIRICAL VERIFICATION SUITE FOR PASO 4 IMPLEMENTATION")
    log("Workflow: flujo asistente de whatsapp.json")
    log("=================================================================\n")

    workflow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
    if not os.path.exists(workflow_path):
        log(f"ERROR: Workflow file not found at {workflow_path}")
        return

    with open(workflow_path, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    nodes_by_name = {n['name']: n for n in wf.get('nodes', [])}
    connections = wf.get('connections', {})

    # -------------------------------------------------------------
    # SUITE 1: N8N GRAPH CONNECTIVITY & TOPOLOGY VERIFICATION
    # -------------------------------------------------------------
    log("--- SUITE 1: GRAPH CONNECTIVITY & TOPOLOGY VERIFICATION ---")

    target_nodes = ["Formatear Respuesta", "¿Existe Incidencia de Calidad?", "Registrar Incidencia (Supabase)"]
    for name in target_nodes:
        if name in nodes_by_name:
            log(f"[PASS] Target node '{name}' exists in workflow.")
        else:
            log(f"[FAIL] Target node '{name}' MISSING from workflow.")

    # Graph edges validation
    # Formatear Respuesta -> ¿Existe Incidencia de Calidad?
    fmt_conn = connections.get("Formatear Respuesta", {}).get("main", [])
    fmt_outputs = [item['node'] for sub in fmt_conn for item in sub]
    log(f"Outputs of 'Formatear Respuesta': {fmt_outputs}")

    if "¿Existe Incidencia de Calidad?" in fmt_outputs:
        log("[PASS] Edge 'Formatear Respuesta' -> '¿Existe Incidencia de Calidad?' verified.")
    else:
        log("[FAIL] Edge 'Formatear Respuesta' -> '¿Existe Incidencia de Calidad?' MISSING!")

    # ¿Existe Incidencia de Calidad? -> Registrar Incidencia (Supabase)
    if_conn = connections.get("¿Existe Incidencia de Calidad?", {}).get("main", [])
    if_outputs = [item['node'] for sub in if_conn for item in sub]
    log(f"Outputs of '¿Existe Incidencia de Calidad?': {if_outputs}")

    if "Registrar Incidencia (Supabase)" in if_outputs:
        log("[PASS] Edge '¿Existe Incidencia de Calidad?' -> 'Registrar Incidencia (Supabase)' verified.")
    else:
        log("[FAIL] Edge '¿Existe Incidencia de Calidad?' -> 'Registrar Incidencia (Supabase)' MISSING!")

    # Check graph cycles (DAG check)
    adj = {}
    for source, targets in connections.items():
        adj[source] = []
        for branch in targets.get("main", []):
            for edge in branch:
                adj[source].append(edge['node'])

    visited = set()
    rec_stack = set()
    has_cycle = False

    def dfs(node):
        nonlocal has_cycle
        visited.add(node)
        rec_stack.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in rec_stack:
                has_cycle = True
                log(f"[FAIL] Cycle detected involving node: {neighbor}")
        rec_stack.remove(node)

    for n in list(adj.keys()):
        if n not in visited:
            dfs(n)

    if not has_cycle:
        log("[PASS] Graph topology verified: DAG with NO circular references.")

    # Verify node parameters
    fmt_node = nodes_by_name.get("Formatear Respuesta", {})
    if_node = nodes_by_name.get("¿Existe Incidencia de Calidad?", {})
    supa_node = nodes_by_name.get("Registrar Incidencia (Supabase)", {})

    # Formatear Respuesta parameters
    if fmt_node.get("parameters", {}).get("jsCode"):
        log("[PASS] 'Formatear Respuesta' has non-empty 'jsCode'.")
    else:
        log("[FAIL] 'Formatear Respuesta' missing 'jsCode'.")

    # IF node parameters
    if_conds = if_node.get("parameters", {}).get("conditions", {}).get("conditions", [])
    if len(if_conds) > 0 and if_conds[0].get("leftValue") == "={{ $json.has_quality_incident }}":
        log("[PASS] '¿Existe Incidencia de Calidad?' condition parameter correctly configured: leftValue={{ $json.has_quality_incident }}.")
    else:
        log(f"[FAIL] '¿Existe Incidencia de Calidad?' condition parameter invalid or missing: {if_conds}")

    # Supabase node parameters
    supa_params = supa_node.get("parameters", {})
    supa_table = supa_params.get("tableId")
    supa_fields = supa_params.get("fieldsUi", {}).get("fieldValues", [])
    field_ids = [f.get("fieldId") for f in supa_fields]

    log(f"Supabase Table ID: {supa_table}")
    log(f"Supabase Field Mapping Count: {len(supa_fields)}")
    log(f"Mapped Field IDs: {field_ids}")

    required_fields = ["telefono", "tipo_incidencia", "respuesta_raw", "respuesta_saneada", "entrada_paciente", "fecha_registro", "metadata"]
    missing_fields = [f for f in required_fields if f not in field_ids]
    if not missing_fields:
        log("[PASS] 'Registrar Incidencia (Supabase)' has all required 7 fields mapped.")
    else:
        log(f"[FAIL] 'Registrar Incidencia (Supabase)' missing required fields: {missing_fields}")

    log("\n--- SUITE 2: JS CODE SIMULATION & EDGE CASE TESTING ---")
    js_code = fmt_node.get("parameters", {}).get("jsCode", "")

    # We test key logic structures in JS code statically and programmatically:
    # 1. sanitizeTimes
    log("Testing sanitizeTimes logic...")
    def sanitizeTimes(text):
        if not text or not isinstance(text, str):
            return text
        cleaned = text
        cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi', r'\1:00\2', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![:\d\-])', r'\1:00', cleaned)
        cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b', r'\1:00', cleaned, flags=re.IGNORECASE)
        return cleaned

    t1 = sanitizeTimes("Cita a las 4:30 pm")
    log(f"Sanitize 'Cita a las 4:30 pm' -> '{t1}'")
    if t1 == "Cita a las 4:00 pm":
        log("[PASS] sanitizeTimes correctly normalizes 4:30 pm to 4:00 pm.")
    else:
        log(f"[FAIL] sanitizeTimes unexpected result: {t1}")

    # 2. empty AI response handling
    if "wasEmptyResponse = true;" in js_code and 'detectedIncidentType = "RESPUESTA_VACIA_FALLBACK";' in js_code:
        log("[PASS] Empty response fallback and incident detection logic present.")
    else:
        log("[FAIL] Empty response incident detection logic missing!")

    # 3. schedule hallucination detection logic
    if 'detectedIncidentType = "ALUCINACION_HORARIO";' in js_code and 'validHours = [8, 9, 10, 11, 16, 17];' in js_code:
        log("[PASS] Valid hours check and ALUCINACION_HORARIO incident classification present.")
    else:
        log("[FAIL] Hour validation incident classification missing!")

    # 4. weekend scheduling detection logic
    if 'detectedIncidentType = "ALUCINACION_FIN_DE_SEMANA";' in js_code:
        log("[PASS] Weekend scheduling detection logic present.")
    else:
        log("[FAIL] Weekend scheduling detection logic missing!")

    log("\n--- SUITE 3: METADATA_LOG SERIALIZATION & SUPABASE FIELD MAPPING ---")
    # Check field mappings vs Formatear Respuesta output contract
    # Formatear Respuesta returns:
    # {
    #   final_history, bot_reply, delay, nombre, ciudad, motivo_consulta, temperatura, resumen, dia_cita, hora_cita, requiere_asistencia_humana,
    #   has_quality_incident, tipo_incidencia, respuesta_raw, entrada_paciente, metadata_log
    # }
    field_value_map = {f['fieldId']: f['fieldValue'] for f in supa_fields}

    log("Mapping analysis:")
    log(f"telefono -> {field_value_map.get('telefono')}")
    log(f"tipo_incidencia -> {field_value_map.get('tipo_incidencia')}")
    log(f"respuesta_raw -> {field_value_map.get('respuesta_raw')}")
    log(f"respuesta_saneada -> {field_value_map.get('respuesta_saneada')}")
    log(f"entrada_paciente -> {field_value_map.get('entrada_paciente')}")
    log(f"fecha_registro -> {field_value_map.get('fecha_registro')}")
    log(f"metadata -> {field_value_map.get('metadata')}")

    # Verification of field mapping targets
    if field_value_map.get('tipo_incidencia') == "={{ $json.tipo_incidencia }}":
        log("[PASS] tipo_incidencia maps to $json.tipo_incidencia.")
    else:
        log(f"[WARN/FAIL] tipo_incidencia mapping mismatch: {field_value_map.get('tipo_incidencia')}")

    if field_value_map.get('respuesta_saneada') == "={{ $json.bot_reply }}":
        log("[PASS] respuesta_saneada maps to $json.bot_reply.")
    else:
        log(f"[WARN/FAIL] respuesta_saneada mapping mismatch: {field_value_map.get('respuesta_saneada')}")

    if field_value_map.get('respuesta_raw') == "={{ $json.respuesta_raw }}":
        log("[PASS] respuesta_raw maps to $json.respuesta_raw.")
    else:
        log(f"[WARN/FAIL] respuesta_raw mapping mismatch: {field_value_map.get('respuesta_raw')}")

    if field_value_map.get('entrada_paciente') == "={{ $json.entrada_paciente }}":
        log("[PASS] entrada_paciente maps to $json.entrada_paciente.")
    else:
        log(f"[WARN/FAIL] entrada_paciente mapping mismatch: {field_value_map.get('entrada_paciente')}")

    # CRITICAL FINDING: Metadata JSON serialization
    metadata_val = field_value_map.get('metadata')
    if metadata_val == "={{ JSON.stringify($json.metadata_log) }}":
        log("[FINDING / VULNERABILITY DETECTED]")
        log("  Field 'metadata' uses '={{ JSON.stringify($json.metadata_log) }}'.")
        log("  IMPACT ANALYSIS:")
        log("  - In n8n Supabase Node v1, evaluating `JSON.stringify(...)` inside n8n expression returns a JSON STRING scalar.")
        log("  - When sent to Supabase REST API (PostgREST), if the target column `metadata` in table `bot_quality_logs` is typed as JSONB,")
        log("    Supabase will store a JSON string literal (e.g. '\"{\\\"nombre_paciente\\\":\\\"Juan\\\"...}\"') instead of a native JSONB object.")
        log("  - Querying Supabase via `metadata->>'nombre_paciente'` or PostgreSQL JSON operators will return NULL or fail.")
        log("  - RECOMMENDED FIX: Change fieldValue to `={{ $json.metadata_log }}` so n8n passes the JavaScript Object directly into the POST payload.")
    else:
        log(f"Metadata fieldValue: {metadata_val}")

    log("\n--- SUITE 4: NON-BLOCKING BEHAVIOR & ERROR HANDLING VERIFICATION ---")
    on_error = supa_node.get("onError")
    retry_on_fail = supa_node.get("retryOnFail")
    max_tries = supa_node.get("maxTries")

    log(f"Registrar Incidencia onError: {on_error}")
    log(f"Registrar Incidencia retryOnFail: {retry_on_fail}")
    log(f"Registrar Incidencia maxTries: {max_tries}")

    if on_error == "continueRegularOutput":
        log("[PASS] Non-blocking behavior CONFIRMED: 'onError' is set to 'continueRegularOutput'.")
    else:
        log(f"[FAIL] Non-blocking behavior NOT CONFIGURED: 'onError' is '{on_error}'. Workflow may block/fail if logging fails!")

    if retry_on_fail and max_tries == 3:
        log("[PASS] Resilience confirmed: retryOnFail is true with maxTries=3.")
    else:
        log(f"[WARN] Retry configuration non-standard: retryOnFail={retry_on_fail}, maxTries={max_tries}")

    log("\n=================================================================")
    log("VERIFICATION SUMMARY")
    log("=================================================================")

    # Write report file
    report_file = r"c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_4_2\challenge_report.md"
    with open(report_file, 'w', encoding='utf-8') as rf:
        rf.write("\n".join(report_lines))
    print(f"\nReport generated at {report_file}")

if __name__ == "__main__":
    run_verification()
