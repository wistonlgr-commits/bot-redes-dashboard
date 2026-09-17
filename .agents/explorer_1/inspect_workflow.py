import json
import os

files_to_check = [
    'flujo asistente de whatsapp.json',
    'flujo que consume muchos tokens.json',
    'flujo_optimizado.json',
    'DrTrejo ooptimizado que estaba en curso.json',
    'n8n_activo.json',
    'old_n8n.json'
]

for filename in files_to_check:
    if not os.path.exists(filename):
        continue
    print(f"=== File: {filename} ===")
    with open(filename, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            nodes = data.get('nodes', [])
            print(f"Total nodes: {len(nodes)}")
            for idx, n in enumerate(nodes):
                name = n.get('name', '')
                ntype = n.get('type', '')
                if any(k in name.lower() for k in ['cerebro', 'inteligencia', 'gemini', 'agente', 'ai']) or \
                   any(k in ntype.lower() for k in ['gemini', 'agent', 'chain', 'ai']):
                    print(f"  Node [{idx}]: name='{name}', type='{ntype}'")
        except Exception as e:
            print(f"  Error reading {filename}: {e}")
    print()
