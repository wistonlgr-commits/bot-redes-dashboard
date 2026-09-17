"""
Empirical Test Harness for Paso 1 System Prompt & Workflow Nodes
Target file: flujo asistente de whatsapp.json
Working Directory: c:\\Users\\Leor\\Desktop\\bot whatsapp\\.agents\\challenger_1_2
"""

import json
import re

def test_formatear_agenda_hour_parsing():
    """
    Empirical Test for Formatear Agenda (node line 819-830)
    Tests how 12-hour formatted time strings (e.g. '04:00 pm', '4:00 pm') are parsed.
    """
    test_cases = [
        {"Hora_Cita": "04:00 pm", "Dia_Cita": "2026-07-27"},
        {"Hora_Cita": "4:00 pm", "Dia_Cita": "2026-07-27"},
        {"Hora_Cita": "05:00 pm", "Dia_Cita": "2026-07-27"},
        {"Hora_Cita": "08:00 am", "Dia_Cita": "2026-07-27"},
        {"Hora_Cita": "16:00", "Dia_Cita": "2026-07-27"},
    ]
    
    results = []
    for case in test_cases:
        time_str = case["Hora_Cita"].strip()
        time_lower = time_str.lower()
        
        # Original node logic:
        parts = time_str.split(':')
        hora = None
        if len(parts) >= 2:
            try:
                hora = int(parts[0])
            except ValueError:
                hora = None
                
        # Classification in node logic:
        is_manana = (hora is not None and 8 <= hora < 12)
        is_tarde = (hora is not None and hora >= 12)
        
        results.append({
            "input_hora": time_str,
            "parsed_hora_int": hora,
            "classified_manana": is_manana,
            "classified_tarde": is_tarde,
            "bug_detected": (time_lower.endswith("pm") and hora < 12 and not is_tarde)
        })
    return results

def test_formatear_respuesta_json_parser():
    """
    Empirical Test for Formatear Respuesta (node line 336)
    Tests JSON parsing, double brace cleanup, and fallback regex extraction.
    """
    test_samples = [
        # Case 1: Standard double brace output from Gemini
        {
            "name": "Double Braces standard",
            "raw": 'Hola! Con gusto. |||DATOS|||\n{{\"nombre\": \"Juan\", \"ciudad\": \"Maracay\", \"requiere_asistencia_humana\": \"\"}}',
            "expected_nombre": "Juan"
        },
        # Case 2: Markdown block + Double Braces
        {
            "name": "Markdown block + double braces",
            "raw": 'Claro! |||DATOS|||\n```json\n{{\"nombre\": \"Maria\", \"ciudad\": \"Valencia\"}}\n```',
            "expected_nombre": "Maria"
        },
        # Case 3: Boolean value (no quotes) in JSON (triggers JSON.parse or fallback)
        {
            "name": "Boolean value requiring assistance",
            "raw": 'Un momento. |||DATOS|||\n{\"nombre\": \"Carlos\", \"requiere_asistencia_humana\": true}',
            "expected_alerta": True
        },
        # Case 4: Invalid JSON string (missing closing quote) -> Triggers Fallback Regex
        {
            "name": "Malformed JSON triggering fallback regex",
            "raw": 'Respuesta. |||DATOS|||\n{\"nombre\": \"Pedro\", \"ciudad\": \"Cagua\", \"resumen\": \"unclosed string}',
            "expected_fallback_nombre": "Pedro"
        },
        # Case 5: Escaped quotes in summary string triggering fallback regex
        {
            "name": "Escaped quotes in summary string",
            "raw": 'Respuesta. |||DATOS|||\n{\"nombre\": \"Ana\", \"resumen\": \"dijo \\\"tengo várices\\\" en pierna\"}',
            "expected_fallback_resumen": 'dijo \\"tengo várices\\" en pierna'
        }
    ]
    
    results = []
    for sample in test_samples:
        full_response = sample["raw"]
        partes = full_response.split('|||DATOS|||')
        bot_msg = partes[0].strip()
        json_str = partes[1].strip()
        
        # Cleanup code from node:
        json_str_clean = re.sub(r'^\{\{', '{', json_str)
        json_str_clean = re.sub(r'\}\}$', '}', json_str_clean)
        json_str_clean = re.sub(r'\{\{', '{', json_str_clean)
        json_str_clean = re.sub(r'\}\}', '}', json_str_clean)
        json_str_clean = re.sub(r'```json\s*', '', json_str_clean, flags=re.IGNORECASE)
        json_str_clean = re.sub(r'```\s*', '', json_str_clean, flags=re.IGNORECASE).strip()
        
        parse_ok = False
        parsed_data = {}
        try:
            parsed_data = json.loads(json_str_clean)
            parse_ok = True
        except Exception as e:
            parse_ok = False
            
        # Fallback regex extraction:
        fallback_data = {}
        if not parse_ok:
            for field in ['nombre', 'ciudad', 'motivo_consulta', 'temperatura', 'resumen', 'dia_cita', 'hora_cita', 'requiere_asistencia_humana']:
                match = re.search(r'"' + field + r'"\s*:\s*"([^"]*)"', json_str_clean)
                if match:
                    fallback_data[field] = match.group(1)
                    
        results.append({
            "test_name": sample["name"],
            "cleaned_json_str": json_str_clean,
            "json_parse_ok": parse_ok,
            "parsed_data": parsed_data,
            "fallback_data": fallback_data
        })
    return results

if __name__ == '__main__':
    print("=== FORMATEAR AGENDA HOUR PARSING TEST ===")
    agenda_results = test_formatear_agenda_hour_parsing()
    print(json.dumps(agenda_results, indent=2))
    
    print("\n=== FORMATEAR RESPUESTA JSON PARSER TEST ===")
    respuesta_results = test_formatear_respuesta_json_parser()
    print(json.dumps(respuesta_results, indent=2))
