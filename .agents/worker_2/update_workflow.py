import json

workflow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
js_code_path = r"c:\Users\Leor\Desktop\bot whatsapp\formatear_agenda_corregido.js"

with open(js_code_path, "r", encoding="utf-8") as f:
    js_code = f.read()

with open(workflow_path, "r", encoding="utf-8") as f:
    data = json.load(f)

node15_found = False
node9_found = False

for node in data.get("nodes", []):
    if node.get("name") == "Formatear Agenda":
        node["parameters"]["jsCode"] = js_code
        node15_found = True
        print("Updated Node #15 (Formatear Agenda) jsCode.")

    if node.get("name") == "Cerebro Inteligencia Artificial":
        content = node["parameters"]["messages"]["values"][0]["content"]
        
        # Update placeholder section
        if "[AGENDA_OCUPADA]" in content:
            old_sec = 'AGENDA OCUPADA:\n[AGENDA_OCUPADA]\n{{ $node["Formatear Agenda"].json.agenda_ocupada || "Agenda libre" }}\n[/AGENDA_OCUPADA]'
            new_sec = 'AGENDA DISPONIBLE:\n[AGENDA_DISPONIBLE]\n{{ $node["Formatear Agenda"].json.agenda_disponible || $node["Formatear Agenda"].json.agenda_ocupada || "Sin disponibilidad" }}\n[/AGENDA_DISPONIBLE]'
            if old_sec in content:
                content = content.replace(old_sec, new_sec)
                print("Replaced AGENDA_OCUPADA section with AGENDA_DISPONIBLE in Node #9 prompt.")
            else:
                # Replace generically if whitespace differed
                content = content.replace("[AGENDA_OCUPADA]", "[AGENDA_DISPONIBLE]").replace("[/AGENDA_OCUPADA]", "[/AGENDA_DISPONIBLE]").replace("AGENDA OCUPADA:", "AGENDA DISPONIBLE:")
                print("Replaced AGENDA_OCUPADA tags with AGENDA_DISPONIBLE in Node #9 prompt.")

        # Replace text references
        content = content.replace("a menos que veas en la AGENDA OCUPADA", "a menos que veas en la AGENDA DISPONIBLE")
        content = content.replace("ES OBLIGATORIO LEER LA [AGENDA_OCUPADA]", "ES OBLIGATORIO LEER LA [AGENDA_DISPONIBLE]")
        content = content.replace("ES OBLIGATORIO LEER LA AGENDA OCUPADA", "ES OBLIGATORIO LEER LA AGENDA DISPONIBLE")
        
        node["parameters"]["messages"]["values"][0]["content"] = content
        node9_found = True
        print("Updated Node #9 (Cerebro Inteligencia Artificial) prompt.")

assert node15_found, "Node #15 Formatear Agenda not found!"
assert node9_found, "Node #9 Cerebro Inteligencia Artificial not found!"

with open(workflow_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Successfully saved updated workflow json.")
