import json

workflow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

with open(workflow_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("1. JSON syntax check: VALID JSON")

node15 = None
node9 = None

for n in data.get("nodes", []):
    if n.get("name") == "Formatear Agenda":
        node15 = n
    elif n.get("name") == "Cerebro Inteligencia Artificial":
        node9 = n

assert node15 is not None, "Node #15 missing"
assert node9 is not None, "Node #9 missing"

jsCode = node15["parameters"]["jsCode"]

# Check Requirement 1: 12h/24h parsing present
assert "parseTimeTo24hHour" in jsCode, "parseTimeTo24hHour function missing in Node #15"
assert "isPM" in jsCode and "isAM" in jsCode, "AM/PM logic missing in parseTimeTo24hHour"

# Check Requirement 2: Positive availability strings present
assert "MAÑANA DISPONIBLE:" in jsCode, "MAÑANA DISPONIBLE missing in Node #15 output"
assert "TARDE DISPONIBLE:" in jsCode, "TARDE DISPONIBLE missing in Node #15 output"

# Check Requirement 4: Purge all :30 references
assert ":30" not in jsCode, "Found ':30' in Node #15 jsCode!"
assert "3:30" not in jsCode, "Found '3:30' in Node #15 jsCode!"
assert "4:30" not in jsCode, "Found '4:30' in Node #15 jsCode!"

# Check Requirement 5: Returns agenda_disponible and agenda_ocupada
assert "agenda_disponible:" in jsCode, "agenda_disponible missing from return object"
assert "agenda_ocupada:" in jsCode, "agenda_ocupada missing from return object"

# Check Node #9 system prompt
prompt = node9["parameters"]["messages"]["values"][0]["content"]
assert "[AGENDA_DISPONIBLE]" in prompt, "[AGENDA_DISPONIBLE] tag missing in Node #9 prompt"
assert "Formatear Agenda" in prompt, "Formatear Agenda reference missing in Node #9 prompt"

print("2. Requirement checks: ALL PASSED SUCCESSFULLY!")
