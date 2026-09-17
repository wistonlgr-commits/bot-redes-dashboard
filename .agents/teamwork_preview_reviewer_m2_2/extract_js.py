import json

with open(r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json", "r", encoding="utf-8") as f:
    target_data = json.load(f)

with open(r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json", "r", encoding="utf-8") as f:
    baseline_data = json.load(f)

t_map = {n["name"]: n for n in target_data["nodes"]}
b_map = {n["name"]: n for n in baseline_data["nodes"]}

# Extract Formatear Agenda code
agenda_code = t_map["Formatear Agenda"]["parameters"]["jsCode"]
with open(r"c:\Users\Leor\Desktop\bot whatsapp\.agents\teamwork_preview_reviewer_m2_2\agenda_code.js", "w", encoding="utf-8") as f:
    f.write(agenda_code)

# Extract Formatear Respuesta target & baseline code
resp_target = t_map["Formatear Respuesta"]["parameters"]["jsCode"]
resp_baseline = b_map["Formatear Respuesta"]["parameters"]["jsCode"]

with open(r"c:\Users\Leor\Desktop\bot whatsapp\.agents\teamwork_preview_reviewer_m2_2\resp_target.js", "w", encoding="utf-8") as f:
    f.write(resp_target)

with open(r"c:\Users\Leor\Desktop\bot whatsapp\.agents\teamwork_preview_reviewer_m2_2\resp_baseline.js", "w", encoding="utf-8") as f:
    f.write(resp_baseline)

print(f"Formatear Respuesta target == baseline: {resp_target == resp_baseline}")
print(f"Agenda code size: {len(agenda_code)}")
print(f"Formatear Respuesta code size: {len(resp_target)}")
