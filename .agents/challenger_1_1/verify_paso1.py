import json
import os
import re

json_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

print(f"Loading JSON from {json_path}...")
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"JSON parsed successfully! Top-level type: {type(data)}")

# If n8n workflow format: 'nodes' array
nodes = data.get('nodes', []) if isinstance(data, dict) else []
print(f"Total nodes: {len(nodes)}")

node_9 = None
for i, node in enumerate(nodes):
    node_name = node.get('name', '')
    node_id = node.get('id', '')
    # Check if node index or id or name matches 9 or "Paso 1"
    print(f"Node index {i}: id={node_id}, name={node_name}, type={node.get('type')}")
    if str(node_id) == '9' or '9' in str(node_id) or 'Paso 1' in node_name or i == 9:
        node_9 = node

print("\n--- Inspecting Node #9 candidates ---")
for i, node in enumerate(nodes):
    # Search inside parameters for prompt or system prompt
    params = node.get('parameters', {})
    prompt_str = json.dumps(params, ensure_ascii=False)
    if 'Paso 1' in prompt_str or 'system' in prompt_str.lower() or node.get('id') == '9' or i == 8 or i == 9:
        print(f"\nNode Index {i}: ID='{node.get('id')}', Name='{node.get('name')}', Type='{node.get('type')}'")

