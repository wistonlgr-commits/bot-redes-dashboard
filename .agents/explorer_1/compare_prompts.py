import os
import json

prompt_files = [
    'prompt_agente.md',
    'prompt_agente_v2.md',
    'prompt_corregido.txt',
    'prompt_dump.txt',
    'prompt_limpio_n8n.txt',
    'promt_actual_produccion.json',
    'promt_actual_produccion_nuevo.json'
]

for pf in prompt_files:
    if os.path.exists(pf):
        size = os.path.getsize(pf)
        print(f"File: {pf} | Size: {size} bytes")
        with open(pf, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            print(f"   Line count: {len(content.splitlines())}, Char count: {len(content)}")
