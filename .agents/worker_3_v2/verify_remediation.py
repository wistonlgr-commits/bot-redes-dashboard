import json
import re

def main():
    json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    target = None
    for n in nodes:
        if n.get("id") == "8fd94881-ca56-4855-8462-ef0109762964":
            target = n
            break

    assert target is not None, "Node 8fd94881-ca56-4855-8462-ef0109762964 not found!"
    js_code = target.get("parameters", {}).get("jsCode", "")

    print("[PASS] JSON loaded successfully. Target node found.")
    print("[PASS] jsCode length:", len(js_code))

    # Verify Key Fixes in Code text
    assert "depth > 10" in js_code, "depth > 10 fix missing!"
    assert "obj.trim().length > 0" in js_code, "obj.trim().length > 0 fix missing!"
    assert "$json?.content" in js_code or "$json.content" in js_code, "direct $json.content check missing!"
    assert "Array.isArray($node[\"Refrescar Datos de Supabase\"]?.json?.chat_history)" in js_code, "Array.isArray check missing!"
    assert "dayLine.toUpperCase().includes('NO LABORABLE')" in js_code or "dayLine.includes('NO LABORABLE')" in js_code, "NO LABORABLE check missing!"
    assert "Sin disponibilidad" not in js_code.split("NO LABORABLE")[1].split("}")[0], "Sin disponibilidad improperly coupled with NO LABORABLE!"

    print("[PASS] All structural code assertions passed!")

if __name__ == "__main__":
    main()
