import json

file_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

connections = data.get("connections", {})

print("=== ALL CONNECTIONS IN JSON ===")
for src, conn in connections.items():
    print(f"{src}:")
    for output_type, outputs in conn.items():
        for i, main_out in enumerate(outputs):
            targets = [f"{dst['node']} (idx {dst.get('index', 0)})" for dst in main_out]
            print(f"  [{output_type} {i}] -> {', '.join(targets)}")
