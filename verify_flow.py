#!/usr/bin/env python3
"""
verify_flow.py - Automated Compliance Audit & Verification Script
WhatsApp Bot Restructuring Project - Phase 2 Verification
"""

import sys
import json
import os

MODIFIABLE_NODE_NAMES = {
    "Cerebro Inteligencia Artificial",
    "Formatear Agenda",
    "Formatear Respuesta"
}

def verify_workflow(target_path, baseline_path):
    print("==================================================")
    print(f"VERIFYING WORKFLOW: {target_path}")
    print(f"BASELINE REFERENCE: {baseline_path}")
    print("==================================================\n")

    errors = []

    # CHK-01: Load flujo asistente de whatsapp.json with json.load() and confirm valid JSON.
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            target_data = json.load(f)
        print("[PASS] CHK-01: Target JSON file successfully loaded and parsed.")
    except Exception as e:
        print(f"[FAIL] CHK-01: Target JSON file could not be loaded: {e}")
        sys.exit(1)

    try:
        with open(baseline_path, "r", encoding="utf-8") as f:
            baseline_data = json.load(f)
        print("[PASS] CHK-01b: Baseline JSON file successfully loaded.")
    except Exception as e:
        print(f"[FAIL] CHK-01b: Baseline JSON file could not be loaded: {e}")
        sys.exit(1)

    target_nodes = target_data.get("nodes", [])
    baseline_nodes = baseline_data.get("nodes", [])

    # CHK-02: Verify node count == 23.
    if len(target_nodes) != 23:
        errors.append(f"CHK-02: Expected 23 nodes, found {len(target_nodes)}")
    else:
        print("[PASS] CHK-02: Total node count is exactly 23.")

    # CHK-03: Verify connections dictionary matches original file connections.
    target_conn = target_data.get("connections", {})
    baseline_conn = baseline_data.get("connections", {})
    if target_conn != baseline_conn:
        errors.append("CHK-03: Workflow connections do not match original file connections.")
    else:
        print("[PASS] CHK-03: Workflow connections match original topology exactly.")

    # Node Maps
    target_node_map = {n.get("name"): n for n in target_nodes}
    baseline_node_map = {n.get("name"): n for n in baseline_nodes}

    # CHK-11: Compare parameters of all 20 unmodified nodes against original JSON file and fail if any difference exists.
    unmod_count = 0
    diff_unmod = []
    for name, base_node in baseline_node_map.items():
        if name in MODIFIABLE_NODE_NAMES:
            continue
        unmod_count += 1
        tgt_node = target_node_map.get(name)
        if tgt_node is None:
            diff_unmod.append(f"Node '{name}' missing from target workflow.")
        else:
            base_params = base_node.get("parameters", {})
            tgt_params = tgt_node.get("parameters", {})
            if base_params != tgt_params or base_node != tgt_node:
                diff_unmod.append(f"Unmodified node '{name}' differs from original JSON specification.")

    if unmod_count == 20 and not diff_unmod:
        print("[PASS] CHK-11: Parameters and specifications of all 20 unmodified nodes match original JSON 100%.")
    else:
        errors.append(f"CHK-11: Unmodified node check failed. Issues: {diff_unmod}")

    # Modifiable Nodes
    ai_node = target_node_map.get("Cerebro Inteligencia Artificial")
    agenda_node = target_node_map.get("Formatear Agenda")
    resp_node = target_node_map.get("Formatear Respuesta")

    # CHK-04: Verify modelId.value and modelId.cachedResultName are models/gemini-3.6-flash.
    if not ai_node:
        errors.append("CHK-04: Node 'Cerebro Inteligencia Artificial' not found.")
    else:
        model_info = ai_node.get("parameters", {}).get("modelId", {})
        val = model_info.get("value")
        cached = model_info.get("cachedResultName")
        expected_model = "models/gemini-3.6-flash"
        if val != expected_model or cached != expected_model:
            errors.append(f"CHK-04: AI model mismatch. Value: '{val}', Cached: '{cached}'. Expected: '{expected_model}'.")
        else:
            print(f"[PASS] CHK-04: modelId.value and modelId.cachedResultName correctly set to '{expected_model}'.")

        # Extract System Prompt
        prompt_content = ""
        try:
            messages = ai_node.get("parameters", {}).get("messages", {}).get("values", [])
            if messages:
                prompt_content = messages[0].get("content", "")
        except Exception:
            pass

        # CHK-05: Verify System Prompt contains key phrases from all 5 few-shot examples.
        few_shot_phrases = [
            "Un gusto saludarte",
            "quedamos atentos",
            "Eco Doppler Venoso para un diagnóstico completo"
        ]
        missing_phrases = [p for p in few_shot_phrases if p not in prompt_content]
        if missing_phrases:
            errors.append(f"CHK-05: System Prompt missing required few-shot key phrases: {missing_phrases}")
        else:
            print("[PASS] CHK-05: System Prompt contains required few-shot example key phrases.")

        # CHK-06: Verify System Prompt contains |||DATOS||| and JSON extraction format template.
        if "|||DATOS|||" not in prompt_content or "requiere_asistencia_humana" not in prompt_content:
            errors.append("CHK-06: System Prompt missing '|||DATOS|||' block or JSON extraction format template.")
        else:
            print("[PASS] CHK-06: System Prompt contains '|||DATOS|||' block and JSON extraction template.")

        # CHK-07: Verify System Prompt contains [AGENDA_DISPONIBLE].
        if "[AGENDA_DISPONIBLE]" not in prompt_content:
            errors.append("CHK-07: System Prompt missing '[AGENDA_DISPONIBLE]' tag.")
        else:
            print("[PASS] CHK-07: System Prompt contains '[AGENDA_DISPONIBLE]'.")

        # CHK-08: Count "OBLIGATORIO" (<= 2) and "ESTRICTAMENTE" (<= 1) in System Prompt and fail if exceeded.
        ob_count = prompt_content.count("OBLIGATORIO")
        es_count = prompt_content.count("ESTRICTAMENTE")
        if ob_count > 2:
            errors.append(f"CHK-08: 'OBLIGATORIO' appears {ob_count} times (max allowed: 2).")
        if es_count > 1:
            errors.append(f"CHK-08: 'ESTRICTAMENTE' appears {es_count} times (max allowed: 1).")
        if ob_count <= 2 and es_count <= 1:
            print(f"[PASS] CHK-08: Keyword limits respected ('OBLIGATORIO': {ob_count}/2, 'ESTRICTAMENTE': {es_count}/1).")

    # CHK-09: Verify Formatear Agenda code contains [BLOQUEO], SLOTS_PRESENCIAL, SLOTS_ONLINE, currentHourCaracas.
    if not agenda_node:
        errors.append("CHK-09: Node 'Formatear Agenda' not found.")
    else:
        code_agenda = agenda_node.get("parameters", {}).get("jsCode", "")
        required_agenda_tokens = ["[BLOQUEO]", "SLOTS_PRESENCIAL", "SLOTS_ONLINE", "currentHourCaracas"]
        missing_agenda = [t for t in required_agenda_tokens if t not in code_agenda]
        if missing_agenda:
            errors.append(f"CHK-09: Node 'Formatear Agenda' code missing tokens: {missing_agenda}")
        else:
            print("[PASS] CHK-09: 'Formatear Agenda' code contains required tokens ([BLOQUEO], SLOTS_PRESENCIAL, SLOTS_ONLINE, currentHourCaracas).")

    # CHK-10: Verify Formatear Respuesta code contains sanitizeTimes, has_quality_incident.
    if not resp_node:
        errors.append("CHK-10: Node 'Formatear Respuesta' not found.")
    else:
        code_resp = resp_node.get("parameters", {}).get("jsCode", "")
        required_resp_tokens = ["sanitizeTimes", "has_quality_incident"]
        missing_resp = [t for t in required_resp_tokens if t not in code_resp]
        if missing_resp:
            errors.append(f"CHK-10: Node 'Formatear Respuesta' code missing signatures: {missing_resp}")
        else:
            print("[PASS] CHK-10: 'Formatear Respuesta' code contains required signatures (sanitizeTimes, has_quality_incident).")

    # SUMMARY
    print("\n--------------------------------------------------")
    if errors:
        print(f"VERIFICATION FAILED: {len(errors)} error(s) detected:")
        for err in errors:
            print(f"  ❌ {err}")
        print("--------------------------------------------------")
        sys.exit(1)
    else:
        print("VERIFICATION SUCCESSFUL: All 11 checks passed with zero errors!")
        print("--------------------------------------------------")
        sys.exit(0)

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
    baseline = sys.argv[2] if len(sys.argv) > 2 else r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json"
    verify_workflow(target, baseline)
