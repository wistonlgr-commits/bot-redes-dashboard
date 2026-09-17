import json
import sys

def validate_n8n_workflow(file_path):
    report = []
    has_errors = False
    
    report.append(f"Validating workflow file: {file_path}")
    
    # 1. JSON Syntax Check
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        report.append("✅ 1. JSON Syntax: VALID JSON")
    except Exception as e:
        report.append(f"❌ 1. JSON Syntax Error: {e}")
        return False, report

    # 2. Structural Schema Check
    if not isinstance(data, dict):
        report.append("❌ Root object is not a JSON dictionary.")
        return False, report
        
    nodes = data.get('nodes', [])
    connections = data.get('connections', {})
    report.append(f"ℹ️ Total nodes count: {len(nodes)}")
    report.append(f"ℹ️ Total connections keys: {len(connections)}")
    
    # 3. Paso 2 Node Checks (#15 Formatear Agenda & #9 Cerebro IA)
    node15 = next((n for n in nodes if n.get('name') == 'Formatear Agenda'), None)
    if not node15:
        report.append("❌ Node 'Formatear Agenda' NOT FOUND.")
        has_errors = True
    else:
        report.append("✅ Node 'Formatear Agenda' EXISTS.")
        js_code = node15.get('parameters', {}).get('jsCode', '')
        
        # Sub-check: parseTimeTo24hHour exists
        if 'parseTimeTo24hHour' in js_code:
            report.append("✅ Node #15 includes parseTimeTo24hHour implementation.")
        else:
            report.append("❌ Node #15 missing parseTimeTo24hHour implementation.")
            has_errors = True
            
        # Sub-check: :30 references purged
        if ':30' in js_code:
            report.append("❌ Node #15 contains legacy ':30' time references!")
            has_errors = True
        else:
            report.append("✅ Node #15 has ZERO ':30' time references.")
            
        # Sub-check: output keys
        if 'agenda_disponible: txt' in js_code and 'agenda_ocupada: txt' in js_code:
            report.append("✅ Node #15 returns both agenda_disponible and agenda_ocupada.")
        else:
            report.append("❌ Node #15 missing required output keys.")
            has_errors = True

    node9 = next((n for n in nodes if n.get('name') == 'Cerebro Inteligencia Artificial'), None)
    if not node9:
        report.append("❌ Node 'Cerebro Inteligencia Artificial' NOT FOUND.")
        has_errors = True
    else:
        report.append("✅ Node 'Cerebro Inteligencia Artificial' EXISTS.")
        prompt = ''
        for param in node9.get('parameters', {}).get('options', {}).get('systemMessage', ''):
            prompt += str(param)
        # Check system message in parameters
        sys_msg = node9.get('parameters', {}).get('systemMessage', '')
        prompt += str(sys_msg)
        
        if '[AGENDA_DISPONIBLE]' in prompt:
            report.append("✅ Node #9 system prompt contains [AGENDA_DISPONIBLE] section.")
        else:
            report.append("❌ Node #9 system prompt missing [AGENDA_DISPONIBLE].")
            has_errors = True

        if 'Formatear Agenda' in prompt:
            report.append("✅ Node #9 prompt references 'Formatear Agenda' output.")
        else:
            report.append("❌ Node #9 prompt does not reference 'Formatear Agenda' output.")
            has_errors = True

    return not has_errors, report

if __name__ == '__main__':
    wf_path = r'c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json'
    success, report_lines = validate_n8n_workflow(wf_path)
    for line in report_lines:
        print(line)
