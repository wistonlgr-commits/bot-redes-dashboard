import json
import re
import sys

filepath = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

with open(filepath, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total nodes: {len(data.get('nodes', []))}")

gemini_nodes = []
for node in data.get('nodes', []):
    node_type = node.get('type', '')
    node_name = node.get('name', '')
    # check parameters for prompt or system prompt
    params = node.get('parameters', {})
    params_str = json.dumps(params, ensure_ascii=False)
    if 'gemini' in node_type.lower() or 'agent' in node_type.lower() or 'lm' in node_type.lower() or 'prompt' in params_str.lower() or 'system' in params_str.lower():
        gemini_nodes.append((node_name, node_type, params))

print(f"Found {len(gemini_nodes)} candidate prompt nodes.")
for name, ntype, params in gemini_nodes:
    print(f"\n--- Node: {name} (Type: {ntype}) ---")
    # print keys in params
    print("Params keys:", list(params.keys()))
    if 'options' in params:
        print("Options keys:", list(params['options'].keys()) if isinstance(params['options'], dict) else params['options'])
        if isinstance(params['options'], dict) and 'systemMessage' in params['options']:
            print("System Message length:", len(params['options']['systemMessage']))
            print("System Message snippet:", repr(params['options']['systemMessage'][:150]))
    if 'prompt' in params:
        print("Prompt snippet:", repr(str(params['prompt'])[:150]))
