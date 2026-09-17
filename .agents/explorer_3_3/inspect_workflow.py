import json

file_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("=== NODES ===")
for n in data.get("nodes", []):
    print(f"ID: {n.get('id')} | Name: '{n.get('name')}' | Type: {n.get('type')} | TypeVersion: {n.get('typeVersion')}")

print("\n=== CONNECTIONS ===")
for src, conn in data.get("connections", {}).items():
    print(f"From: '{src}':")
    for output_type, outputs in conn.items():
        for i, main_out in enumerate(outputs):
            for dst in main_out:
                print(f"  [{output_type} idx {i}] -> '{dst.get('node')}' (type: {dst.get('type')}, idx: {dst.get('index')})")
