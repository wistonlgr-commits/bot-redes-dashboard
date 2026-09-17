import re
import datetime

# Let's write a Python test runner that mimics the exact JS logic of target_code.js line-by-line
# to verify all 10 scenarios with exact logic fidelity.

def sanitize_times(text):
    if not text or not isinstance(text, str):
        return text
    cleaned = text
    cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))', r'\1:00\2', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![\d:\-])', r'\1:00', cleaned)
    cleaned = re.sub(r'(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b', r'\1:00', cleaned, flags=re.IGNORECASE)
    return cleaned

def find_text(obj, depth=0):
    if depth > 5:
        return ""
    if isinstance(obj, str) and len(obj) > 15:
        return obj
    if isinstance(obj, list):
        for item in obj:
            found = find_text(item, depth + 1)
            if found:
                return found
    if isinstance(obj, dict):
        for val in obj.values():
            found = find_text(val, depth + 1)
            if found:
                return found
    return ""

def execute_escudo(json_input, node_data=None):
    if node_data is None:
        node_data = {}
    
    # Module 3
    history = []
    try:
        history = node_data.get("Refrescar Datos de Supabase", {}).get("json", {}).get("chat_history", [])
    except Exception:
        history = []
    
    full_response = find_text(json_input, 0)
    was_empty_response = False
    if not full_response or full_response.strip() == "":
        full_response = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"
        was_empty_response = True
    
    full_response = full_response.replace('\\\\n', '\n').replace('\\n', '\n')
    full_response = re.sub(r'[ \t]+', ' ', full_response).strip()
    
    bot_msg = full_response
    datos_extraidos = {
        "nombre": None, "ciudad": None, "motivo_consulta": None,
        "temperatura": None, "resumen": None, "dia_cita": None,
        "hora_cita": None, "requiere_asistencia_humana": None
    }
    
    if was_empty_response:
        datos_extraidos["requiere_asistencia_humana"] = "Respuesta de IA vacía - Fallback determinista activado"
        
    # Module 4
    if '|||DATOS|||' in full_response:
        partes = full_response.split('|||DATOS|||')
        bot_msg = partes[0].strip()
        json_str = partes[1].strip()
        json_str = re.sub(r'^\{\{', '{', json_str)
        json_str = re.sub(r'\}\}$', '}', json_str)
        json_str = json_str.replace('{{', '{').replace('}}', '}')
        json_str = re.sub(r'```json\s*', '', json_str, flags=re.IGNORECASE)
        json_str = re.sub(r'```\s*', '', json_str, flags=re.IGNORECASE).strip()
        
        parse_ok = False
        import json
        try:
            datos = json.loads(json_str)
            parse_ok = True
            if 'nombre' in datos: datos_extraidos['nombre'] = datos.get('nombre') or ""
            if 'ciudad' in datos: datos_extraidos['ciudad'] = datos.get('ciudad') or ""
            if 'motivo_consulta' in datos: datos_extraidos['motivo_consulta'] = datos.get('motivo_consulta') or ""
            if 'temperatura' in datos: datos_extraidos['temperatura'] = datos.get('temperatura') or ""
            if 'resumen' in datos: datos_extraidos['resumen'] = datos.get('resumen') or ""
            if 'dia_cita' in datos: datos_extraidos['dia_cita'] = datos.get('dia_cita') if isinstance(datos.get('dia_cita'), str) else ""
            if 'hora_cita' in datos: datos_extraidos['hora_cita'] = datos.get('hora_cita') if isinstance(datos.get('hora_cita'), str) else ""
            if 'requiere_asistencia_humana' in datos: datos_extraidos['requiere_asistencia_humana'] = datos.get('requiere_asistencia_humana') or ""
        except Exception:
            pass
            
        if not parse_ok:
            def extraer(campo):
                match = re.search(r'"' + campo + r'"\s*:\s*"([^"]*)"', json_str)
                return match.group(1) if match else None
            
            for campo in ['nombre', 'ciudad', 'motivo_consulta', 'temperatura', 'resumen', 'dia_cita', 'hora_cita', 'requiere_asistencia_humana']:
                val = extraer(campo)
                if val is not None:
                    datos_extraidos[campo] = val

    # Module 5
    prev_data = node_data.get("Refrescar Datos de Supabase", {}).get("json", {})
    nombre_final = datos_extraidos['nombre'] if datos_extraidos['nombre'] is not None else (prev_data.get('Nombre') or "")
    ciudad_final = datos_extraidos['ciudad'] if datos_extraidos['ciudad'] is not None else (prev_data.get('Ciudad') or "")
    motivo_final = datos_extraidos['motivo_consulta'] if datos_extraidos['motivo_consulta'] is not None else (prev_data.get('Motivo_Consulta') or "")
    temp_final = datos_extraidos['temperatura'] if datos_extraidos['temperatura'] is not None else (prev_data.get('Temperatura') or "")
    resumen_final = datos_extraidos['resumen'] if datos_extraidos['resumen'] is not None else (prev_data.get('Resumen') or "")
    dia_final = datos_extraidos['dia_cita'] if datos_extraidos['dia_cita'] is not None else (prev_data.get('Dia_Cita') or "")
    hora_final = datos_extraidos['hora_cita'] if datos_extraidos['hora_cita'] is not None else (prev_data.get('Hora_Cita') or "")
    alerta_final = datos_extraidos['requiere_asistencia_humana'] if datos_extraidos['requiere_asistencia_humana'] is not None else (prev_data.get('requiere_asistencia_humana') or "")

    if alerta_final in ['false', 'False', 'no']:
        alerta_final = ""

    # Module 6
    bot_msg = sanitize_times(bot_msg)
    if hora_final:
        hora_final = sanitize_times(hora_final)

    if hora_final and hora_final.strip() != "":
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
            dia_final = ""
            hora_final = ""

    if (dia_final or hora_final) and (not nombre_final or nombre_final.strip() == ""):
        if not alerta_final:
            alerta_final = "Intento de agendamiento sin nombre de paciente."
        dia_final = ""
        hora_final = ""

    if dia_final and dia_final.strip() != "":
        dia_final = dia_final.strip()
        date_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', dia_final)
        if not date_match:
            dia_final = ""
            hora_final = ""
        else:
            year = int(date_match.group(1))
            month = int(date_match.group(2))
            day = int(date_match.group(3))
            # UTC day of week calculation:
            dt = datetime.datetime(year, month, day, 12, 0, 0, tzinfo=datetime.timezone.utc)
            # Python weekday: Mon=0, Tue=1, ..., Sat=5, Sun=6. JS getUTCDay: Sun=0, Mon=1, ..., Sat=6
            js_day_of_week = (dt.weekday() + 1) % 7
            
            # America/Caracas timezone string representation
            # For testing past dates, let's use current date:
            today_str = "2026-07-26" # Fixed benchmark date matching local system time
            
            if dia_final < today_str:
                if not alerta_final: alerta_final = "Intento de agendamiento en fecha pasada."
                dia_final = ""
                hora_final = ""
            elif js_day_of_week in [0, 6]: # Sunday=0, Saturday=6
                if not alerta_final: alerta_final = "Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo)."
                dia_final = ""
                hora_final = ""
                bot_msg = re.sub(r'\b(este\s+|el\s+)?(sábado|sabado|domingo)\b', 'el lunes', bot_msg, flags=re.IGNORECASE)

    try:
        agenda_txt = node_data.get("Formatear Agenda", {}).get("json", {}).get("agenda_disponible", "") or ""
        if dia_final and hora_final and agenda_txt:
            lines = agenda_txt.split('\n')
            day_line = next((l for l in lines if dia_final in l), None)
            if not day_line:
                if not alerta_final: alerta_final = f"Fecha {dia_final} no disponible en la agenda."
                dia_final = ""
                hora_final = ""
            elif 'NO LABORABLE' in day_line or 'Sin disponibilidad' in day_line:
                if hora_final not in day_line:
                    if not alerta_final: alerta_final = f"Día {dia_final} no laborable o sin cupo."
                    dia_final = ""
                    hora_final = ""
            else:
                if hora_final not in day_line:
                    if not alerta_final: alerta_final = f"Hora {hora_final} no disponible para el {dia_final}."
                    dia_final = ""
                    hora_final = ""
    except Exception:
        pass

    bot_msg = re.sub(r'\|\|\|DATOS\|\|\|.*', '', bot_msg, flags=re.DOTALL).strip()
    bot_msg = bot_msg.replace('{{', '').replace('}}', '').strip()

    if not bot_msg or bot_msg.strip() == "":
        bot_msg = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"
        if not alerta_final:
            alerta_final = "Respuesta de IA vacía - Fallback determinista activado"

    history.append({"role": "assistant", "content": bot_msg})
    if len(history) > 8:
        history = history[-8:]
        
    return {
        "final_history": history,
        "bot_reply": bot_msg,
        "delay": 5000,
        "nombre": nombre_final,
        "ciudad": ciudad_final,
        "motivo_consulta": motivo_final,
        "temperatura": temp_final,
        "resumen": resumen_final,
        "dia_cita": dia_final,
        "hora_cita": hora_final,
        "requiere_asistencia_humana": alerta_final
    }

# Run test harness
mock_nodes = {
    "Refrescar Datos de Supabase": {
        "json": {
            "chat_history": [{"role": "user", "content": "Hola"}],
            "Nombre": "Juan Perez",
            "Ciudad": "Caracas",
            "Motivo_Consulta": "Dolor de muela",
            "Temperatura": "Calido",
            "Resumen": "Cliente pregunta por citas",
            "Dia_Cita": "",
            "Hora_Cita": "",
            "requiere_asistencia_humana": ""
        }
    },
    "Formatear Agenda": {
        "json": {
            "agenda_disponible": "2026-08-03: 08:00, 09:00, 10:00, 11:00, 16:00, 17:00\n2026-08-04: 08:00, 09:00, 10:00, 11:00\n2026-08-05: NO LABORABLE"
        }
    }
}

print("=== RUNNING PYTHON TEST HARNESS FOR ESCUDO ===")

# Test 1
res1 = execute_escudo({"output": {"text": "Te confirmo tu cita para el 2026-08-03 a las 10:30 am. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-03\",\n  \"hora_cita\": \"10:30 am\"\n}"}}, mock_nodes)
print("\nTest 1 (Sanitize :30):")
print(f"bot_reply: '{res1['bot_reply']}'")
print(f"hora_cita: '{res1['hora_cita']}'")

# Test 3
res3 = execute_escudo({"output": {"text": "Te agendé para el sábado 2026-08-01 a las 10:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-01\",\n  \"hora_cita\": \"10:00\"\n}"}}, mock_nodes)
print("\nTest 3 (Weekend 2026-08-01):")
print(f"bot_reply: '{res3['bot_reply']}'")
print(f"dia_cita: '{res3['dia_cita']}', hora_cita: '{res3['hora_cita']}'")
print(f"alerta: '{res3['requiere_asistencia_humana']}'")

# Test 7 (Short response)
res7 = execute_escudo({"output": {"text": "¡Hola! Claro."}}, mock_nodes)
print("\nTest 7 (Short response length 13):")
print(f"bot_reply: '{res7['bot_reply']}'")
print(f"alerta: '{res7['requiere_asistencia_humana']}'")

# Test 8 (NO LABORABLE)
res8 = execute_escudo({"output": {"text": "Te agendé el 2026-08-05 a las 10:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-05\",\n  \"hora_cita\": \"10:00\"\n}"}}, mock_nodes)
print("\nTest 8 (NO LABORABLE 2026-08-05):")
print(f"dia_cita: '{res8['dia_cita']}', hora_cita: '{res8['hora_cita']}'")
print(f"alerta: '{res8['requiere_asistencia_humana']}'")

# Test 8b (NO LABORABLE with 10:00 in text: "2026-08-05: 10:00 NO LABORABLE")
mock_nodes_8b = dict(mock_nodes)
mock_nodes_8b["Formatear Agenda"] = {"json": {"agenda_disponible": "2026-08-05: 10:00 NO LABORABLE"}}
res8b = execute_escudo({"output": {"text": "Te agendé el 2026-08-05 a las 10:00. |||DATOS|||\n{\n  \"nombre\": \"Juan Perez\",\n  \"dia_cita\": \"2026-08-05\",\n  \"hora_cita\": \"10:00\"\n}"}}, mock_nodes_8b)
print("\nTest 8b (NO LABORABLE line containing 10:00):")
print(f"dia_cita: '{res8b['dia_cita']}', hora_cita: '{res8b['hora_cita']}'")
print(f"alerta: '{res8b['requiere_asistencia_humana']}'")
