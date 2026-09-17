import json
import sys
import os

workflow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

with open(workflow_path, 'r', encoding='utf-8') as f:
    workflow = json.load(f)

nodes = workflow.get('nodes', [])
connections = workflow.get('connections', {})

print(f"Total nodes: {len(nodes)}")
print(f"Connection keys: {len(connections)}")

target_node_names = ["Formatear Respuesta", "¿Existe Incidencia de Calidad?", "Registrar Incidencia (Supabase)"]

for node in nodes:
    name = node.get('name')
    if name in target_node_names or "Incidencia" in name or "Formatear" in name or "Respuesta" in name:
        print("\n--- NODE ---")
        print("Name:", name)
        print("Type:", node.get('type'))
        print("TypeVersion:", node.get('typeVersion'))
        print("onError:", node.get('onError'))
        print("Parameters:", json.dumps(node.get('parameters', {}), indent=2))

