#!/usr/bin/env python3
"""
Comprehensive Verification Harness for n8n Workflow
File under test: flujo asistente de whatsapp.json
Challenger: 5_2
"""

import json
import re
import sys
import os
from typing import Dict, List, Any, Set, Tuple

WORKFLOW_PATH = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
REPORT_PATH = r"c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_5_2\challenge_report.md"
HANDOFF_PATH = r"c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_5_2\handoff.md"

def load_workflow(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------------------------------------------------------
# TEST 1: Schema & Integrity Verification
# ---------------------------------------------------------
def test_schema_and_integrity(wf: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = []
    
    # Check top-level keys
    required_top = ["name", "nodes", "connections"]
    for key in required_top:
        if key in wf:
            results.append({"test": f"Top-level field '{key}'", "status": "PASS", "details": f"Found '{key}'."})
        else:
            results.append({"test": f"Top-level field '{key}'", "status": "FAIL", "details": f"Missing top-level key '{key}'."})
            
    nodes = wf.get("nodes", [])
    connections = wf.get("connections", {})
    
    # Validate node structure
    node_names = set()
    node_ids = set()
    node_map = {}
    
    for idx, node in enumerate(nodes):
        name = node.get("name")
        node_id = node.get("id")
        node_type = node.get("type")
        
        if not name:
            results.append({"test": f"Node #{idx} Name", "status": "FAIL", "details": "Node missing 'name'."})
            continue
        if name in node_names:
            results.append({"test": f"Node Name Uniqueness: '{name}'", "status": "FAIL", "details": f"Duplicate node name '{name}'."})
        node_names.add(name)
        
        if not node_id:
            results.append({"test": f"Node '{name}' ID", "status": "FAIL", "details": f"Node '{name}' missing 'id'."})
        else:
            if node_id in node_ids:
                results.append({"test": f"Node ID Uniqueness: '{node_id}'", "status": "FAIL", "details": f"Duplicate node ID '{node_id}'."})
            node_ids.add(node_id)
            
        if not node_type:
            results.append({"test": f"Node '{name}' Type", "status": "FAIL", "details": f"Node '{name}' missing 'type'."})
            
        if "parameters" not in node:
            results.append({"test": f"Node '{name}' Parameters", "status": "FAIL", "details": f"Node '{name}' missing 'parameters'."})
            
        node_map[name] = node

    results.append({"test": "Total Nodes Validated", "status": "PASS", "details": f"Successfully parsed {len(nodes)} node definitions."})
    return results, node_map

# ---------------------------------------------------------
# TEST 2: Connection Topology & Reachability Analysis
# ---------------------------------------------------------
def test_topology_and_connections(wf: Dict[str, Any], node_map: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = []
    connections = wf.get("connections", {})
    
    adj: Dict[str, List[Tuple[str, int, int]]] = {name: [] for name in node_map}
    in_degree: Dict[str, int] = {name: 0 for name in node_map}
    
    for source_name, conn_data in connections.items():
        if source_name not in node_map:
            results.append({"test": f"Connection Source '{source_name}'", "status": "FAIL", "details": f"Source node '{source_name}' does not exist in workflow nodes!"})
            continue
            
        main_outputs = conn_data.get("main", [])
        for output_idx, branch in enumerate(main_outputs):
            for target_info in branch:
                target_name = target_info.get("node")
                target_type = target_info.get("type", "main")
                target_idx = target_info.get("index", 0)
                
                if target_name not in node_map:
                    results.append({"test": f"Connection Target '{target_name}'", "status": "FAIL", "details": f"Target node '{target_name}' (from '{source_name}' output {output_idx}) does not exist in workflow nodes!"})
                else:
                    adj[source_name].append((target_name, output_idx, target_idx))
                    in_degree[target_name] += 1

    # Check reachable nodes starting from trigger nodes (e.g. Webhook)
    trigger_nodes = [name for name, node in node_map.items() if "webhook" in node.get("type", "").lower() or "trigger" in node.get("type", "").lower()]
    
    visited = set()
    queue = list(trigger_nodes)
    while queue:
        curr = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)
        for target_name, _, _ in adj[curr]:
            queue.append(target_name)
            
    unreachable = set(node_map.keys()) - visited
    if unreachable:
        results.append({"test": "Node Reachability from Trigger", "status": "WARN", "details": f"Unreachable nodes from trigger: {list(unreachable)}"})
    else:
        results.append({"test": "Node Reachability from Trigger", "status": "PASS", "details": "All nodes are reachable from trigger nodes."})

    return results, adj

# ---------------------------------------------------------
# TEST 3: Expression & Reference Resolution Analysis
# ---------------------------------------------------------
def extract_expressions(obj: Any) -> List[str]:
    expressions = []
    if isinstance(obj, str):
        if obj.startswith("=") or "{{" in obj:
            expressions.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            expressions.extend(extract_expressions(v))
    elif isinstance(obj, list):
        for item in obj:
            expressions.extend(extract_expressions(item))
    return expressions

def test_expressions_and_references(node_map: Dict[str, Any], adj: Dict[str, List[Tuple[str, int, int]]]) -> List[Dict[str, Any]]:
    results = []
    
    # Compute topological predecessor sets for each node
    all_nodes = list(node_map.keys())
    predecessors: Dict[str, Set[str]] = {name: set() for name in all_nodes}
    
    # BFS/DFS for predecessor reachability
    for start_node in all_nodes:
        stack = [start_node]
        visited_nodes = set()
        while stack:
            curr = stack.pop()
            if curr in visited_nodes:
                continue
            visited_nodes.add(curr)
            for target_name, _, _ in adj.get(curr, []):
                predecessors[target_name].add(start_node)
                stack.append(target_name)

    # Regex patterns for node references in n8n expressions
    # $node["Node Name"] or $node['Node Name'] or $('Node Name')
    node_ref_pattern = re.compile(r'(?:\$node\[["\']([^"\']+)["\']\]|\$\(["\']([^"\']+)["\']\))')
    
    # Audit each node's expressions
    for node_name, node in node_map.items():
        params = node.get("parameters", {})
        exprs = extract_expressions(params)
        
        for expr in exprs:
            # 1. Check node references ($node["..."] or $('...'))
            matches = node_ref_pattern.findall(expr)
            for m in matches:
                ref_node = m[0] if m[0] else m[1]
                
                # Check if referenced node exists
                if ref_node not in node_map:
                    results.append({
                        "test": f"Node Reference Check in '{node_name}'",
                        "status": "FAIL",
                        "details": f"Node '{node_name}' references non-existent node '{ref_node}' in expression: {expr[:80]}..."
                    })
                else:
                    # Check if referenced node is an upstream predecessor
                    if ref_node != node_name and ref_node not in predecessors[node_name]:
                        results.append({
                            "test": f"Topological Dependency in '{node_name}'",
                            "status": "FAIL",
                            "details": f"Node '{node_name}' references node '{ref_node}', but '{ref_node}' is NOT an upstream predecessor in DAG topology!"
                        })
                    else:
                        results.append({
                            "test": f"Node Reference Check in '{node_name}'",
                            "status": "PASS",
                            "details": f"Valid upstream reference to '{ref_node}'."
                        })
                        
            # 2. Specific Bug Detection: $now.setZone(...).format(...) vs toFormat(...)
            if "$now" in expr and ".format(" in expr:
                results.append({
                    "test": f"Luxon DateTime API Syntax in '{node_name}'",
                    "status": "FAIL",
                    "details": f"Node '{node_name}' calls '$now...format(...)' which is NOT a valid Luxon method (should be 'toFormat(...)'). Expression: {expr[:100]}"
                })
                
            # 3. Unsafe Deep Access (Missing Optional Chaining)
            unsafe_patterns = [
                (r'\$node\["Recibir WhatsApp"\]\.json\.body\.data\.message\.conversation \|\| \$node\["Recibir WhatsApp"\]\.json\.body\.data\.message\.extendedTextMessage\.text',
                 "Unsafe property access on `extendedTextMessage.text` without optional chaining `?.`. Throws TypeError if message type is not extendedTextMessage and conversation is empty.")
            ]
            for pattern, msg in unsafe_patterns:
                if re.search(pattern, expr):
                    results.append({
                        "test": f"Unsafe Expression in '{node_name}'",
                        "status": "FAIL",
                        "details": f"Node '{node_name}': {msg}"
                    })

            # 4. Leading character anomaly in Google Sheets / expression prefix
            if "=\t" in expr:
                results.append({
                    "test": f"Expression Prefix Anomaly in '{node_name}'",
                    "status": "WARN",
                    "details": f"Node '{node_name}' contains leading tab after equal sign `=\\t`. May result in literal tab character '\\t' prepended to value in target system."
                })

            # 5. WhatsApp JID phone replacement limitation
            if "remoteJid.replace('@s.whatsapp.net', '')" in expr:
                results.append({
                    "test": f"Phone JID Stripping Logic in '{node_name}'",
                    "status": "WARN",
                    "details": f"Node '{node_name}' uses `.replace('@s.whatsapp.net', '')`. Does not handle `@c.us` or formatted JIDs, leaving non-numeric suffix for Evolution API."
                })

    return results

# ---------------------------------------------------------
# TEST 4: Code Node Empirical Execution & Edge Case Simulation
# ---------------------------------------------------------
def simulate_formatear_respuesta_node(ai_output: str, supabase_data: dict, agenda_txt: str) -> dict:
    """
    Python harness simulating the exact logic of Node 'Formatear Respuesta' (lines 336-435).
    """
    def sanitize_times(text: str) -> str:
        if not text or not isinstance(text, str):
            return text
        cleaned = text
        cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi', r'\1:00\2', cleaned)
        cleaned = re.sub(r'(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![d:\-])', r'\1:00', cleaned)
        cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b', r'\1:00', cleaned, flags=re.IGNORECASE)
        return cleaned

    was_empty_response = False
    full_response = ai_output
    if not full_response or not full_response.strip():
        full_response = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"
        was_empty_response = True

    raw_ai_output = full_response
    full_response = full_response.replace('\\\\n', '\n').replace('\\n', '\n')
    full_response = re.sub(r'[ \t]+', ' ', full_response).strip()

    bot_msg = full_response
    datos_extraidos = {
        'nombre': None, 'ciudad': None, 'motivo_consulta': None,
        'temperatura': None, 'resumen': None, 'dia_cita': None,
        'hora_cita': None, 'requiere_asistencia_humana': None
    }
    detected_incident_type = ""

    if was_empty_response:
        datos_extraidos['requiere_asistencia_humana'] = "Respuesta de IA vacía - Fallback determinista activado"
        detected_incident_type = "RESPUESTA_VACIA_FALLBACK"

    if '|||DATOS|||' in full_response:
        partes = full_response.split('|||DATOS|||')
        bot_msg = partes[0].strip()
        json_str = partes[1].strip()
        json_str = re.sub(r'^\s*\{\{', '{', json_str)
        json_str = re.sub(r'\}\}\s*$', '}', json_str)
        json_str = re.sub(r'\{\{', '{', json_str)
        json_str = re.sub(r'\}\}', '}', json_str)
        json_str = re.sub(r'```json\s*', '', json_str, flags=re.IGNORECASE)
        json_str = re.sub(r'```\s*', '', json_str, flags=re.IGNORECASE).strip()

        try:
            datos = json.loads(json_str)
            for k in datos_extraidos:
                if k in datos:
                    datos_extraidos[k] = datos[k] or ""
        except Exception:
            # Fallback regex extraction
            def extraer(campo):
                m = re.search(rf'"{campo}"\s*:\s*"([^"]*)"', json_str)
                return m.group(1) if m else None
            for k in datos_extraidos:
                v = extraer(k)
                if v is not None:
                    datos_extraidos[k] = v

    prev_data = supabase_data or {}
    nombre_final = datos_extraidos['nombre'] if datos_extraidos['nombre'] is not None else prev_data.get('Nombre', '')
    ciudad_final = datos_extraidos['ciudad'] if datos_extraidos['ciudad'] is not None else prev_data.get('Ciudad', '')
    motivo_final = datos_extraidos['motivo_consulta'] if datos_extraidos['motivo_consulta'] is not None else prev_data.get('Motivo_Consulta', '')
    temp_final = datos_extraidos['temperatura'] if datos_extraidos['temperatura'] is not None else prev_data.get('Temperatura', '')
    resumen_final = datos_extraidos['resumen'] if datos_extraidos['resumen'] is not None else prev_data.get('Resumen', '')
    dia_final = datos_extraidos['dia_cita'] if datos_extraidos['dia_cita'] is not None else prev_data.get('Dia_Cita', '')
    hora_final = datos_extraidos['hora_cita'] if datos_extraidos['hora_cita'] is not None else prev_data.get('Hora_Cita', '')
    alerta_final = datos_extraidos['requiere_asistencia_humana'] if datos_extraidos['requiere_asistencia_humana'] is not None else prev_data.get('requiere_asistencia_humana', '')

    if alerta_final in ['false', 'False', 'no']:
        alerta_final = ""

    bot_msg = sanitize_times(bot_msg)
    if hora_final:
        hora_final = sanitize_times(hora_final)

    if hora_final and hora_final.strip():
        h_raw = hora_final.strip().lower()
        hour24 = None
        minutes_str = "00"
        is_pm = 'pm' in h_raw or 'p.m.' in h_raw
        is_am = 'am' in h_raw or 'a.m.' in h_raw
        clean = re.sub(r'(am|pm|a\.m\.|p\.m\.)', '', h_raw, flags=re.IGNORECASE).strip()
        parts = clean.split(':')
        if len(parts) >= 1:
            try:
                h = int(parts[0])
                if is_pm and h < 12: h += 12
                if is_am and h == 12: h = 0
                hour24 = h
            except ValueError:
                pass
        if len(parts) >= 2:
            minutes_str = parts[1].strip()

        valid_hours = [8, 9, 10, 11, 16, 17]
        if hour24 is not None and hour24 in valid_hours and minutes_str in ["00", "0", ""]:
            hora_final = f"{hour24:02d}:00"
        else:
            if not alerta_final:
                alerta_final = f"Horario no permitido detectado ({hora_final}). Cita anulada para verificación manual."
            if not detected_incident_type:
                detected_incident_type = "ALUCINACION_HORARIO"
            dia_final = ""
            hora_final = ""

    if (dia_final or hora_final) and (not nombre_final or not nombre_final.strip()):
        if not alerta_final:
            alerta_final = "Intento de agendamiento sin nombre de paciente."
        if not detected_incident_type:
            detected_incident_type = "AGENDAMIENTO_SIN_NOMBRE"
        dia_final = ""
        hora_final = ""

    return {
        "bot_reply": bot_msg,
        "nombre": nombre_final,
        "dia_cita": dia_final,
        "hora_cita": hora_final,
        "requiere_asistencia_humana": alerta_final,
        "has_quality_incident": bool(detected_incident_type),
        "tipo_incidencia": detected_incident_type
    }

def test_code_node_simulations() -> List[Dict[str, Any]]:
    results = []
    
    # Test case 1: Normal scheduling
    ai_out_1 = 'Hola Juan! Te agendé para el 2026-07-28 a las 9:00 am. |||DATOS|||\n{"nombre": "Juan Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Consulta varices", "dia_cita": "2026-07-28", "hora_cita": "09:00", "requiere_asistencia_humana": ""}'
    res_1 = simulate_formatear_respuesta_node(ai_out_1, {}, "- 2026-07-28: MAÑANA DISPONIBLE: [08:00, 09:00]")
    if res_1["dia_cita"] == "2026-07-28" and res_1["hora_cita"] == "09:00" and not res_1["has_quality_incident"]:
        results.append({"test": "Simulation: Valid Appointment Scheduling", "status": "PASS", "details": "Correctly preserved appointment date and time."})
    else:
        results.append({"test": "Simulation: Valid Appointment Scheduling", "status": "FAIL", "details": f"Unexpected simulation output: {res_1}"})

    # Test case 2: Scheduling without name (should get blocked by shield)
    ai_out_2 = 'Te agendé cita el 2026-07-28 a las 10:00 am. |||DATOS|||\n{"nombre": "", "ciudad": "Maracay", "dia_cita": "2026-07-28", "hora_cita": "10:00"}'
    res_2 = simulate_formatear_respuesta_node(ai_out_2, {}, "")
    if res_2["dia_cita"] == "" and res_2["hora_cita"] == "" and res_2["tipo_incidencia"] == "AGENDAMIENTO_SIN_NOMBRE":
        results.append({"test": "Simulation: Shield blocks Appointment without Name", "status": "PASS", "details": "Correctly wiped date/time and raised AGENDAMIENTO_SIN_NOMBRE incident."})
    else:
        results.append({"test": "Simulation: Shield blocks Appointment without Name", "status": "FAIL", "details": f"Failed to block appointment without name: {res_2}"})

    # Test case 3: Scheduling invalid hour (e.g. 14:00 / 2:00 pm)
    ai_out_3 = 'Cita agendada a las 2:00 pm. |||DATOS|||\n{"nombre": "Maria", "dia_cita": "2026-07-28", "hora_cita": "14:00"}'
    res_3 = simulate_formatear_respuesta_node(ai_out_3, {}, "")
    if res_3["dia_cita"] == "" and res_3["hora_cita"] == "" and res_3["tipo_incidencia"] == "ALUCINACION_HORARIO":
        results.append({"test": "Simulation: Shield blocks Invalid Hour (14:00)", "status": "PASS", "details": "Correctly caught invalid hour hallucination."})
    else:
        results.append({"test": "Simulation: Shield blocks Invalid Hour (14:00)", "status": "FAIL", "details": f"Failed to block invalid hour: {res_3}"})

    return results


def main():
    print(f"[*] Loading workflow from {WORKFLOW_PATH}...")
    wf = load_workflow(WORKFLOW_PATH)
    
    all_results = []
    
    print("[*] Test 1: Schema & Integrity...")
    res_1, node_map = test_schema_and_integrity(wf)
    all_results.extend(res_1)
    
    print("[*] Test 2: Connection Topology & Reachability...")
    res_2, adj = test_topology_and_connections(wf, node_map)
    all_results.extend(res_2)
    
    print("[*] Test 3: Expression & Reference Resolution...")
    res_3 = test_expressions_and_references(node_map, adj)
    all_results.extend(res_3)
    
    print("[*] Test 4: Code Node Simulations...")
    res_4 = test_code_node_simulations()
    all_results.extend(res_4)
    
    # Print summary of results
    pass_cnt = sum(1 for r in all_results if r["status"] == "PASS")
    fail_cnt = sum(1 for r in all_results if r["status"] == "FAIL")
    warn_cnt = sum(1 for r in all_results if r["status"] == "WARN")
    
    print(f"\n================ SUMMARY ================")
    print(f"Total Checks: {len(all_results)} | PASS: {pass_cnt} | FAIL: {fail_cnt} | WARN: {warn_cnt}")
    print(f"=========================================\n")
    
    for r in all_results:
        print(f"[{r['status']}] {r['test']}: {r['details']}")

if __name__ == "__main__":
    main()
