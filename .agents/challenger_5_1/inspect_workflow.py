import json
import sys

def inspect_workflow(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data.get('nodes', [])
    connections = data.get('connections', {})

    print(f"Total nodes: {len(nodes)}")
    node_names = set(node['name'] for node in nodes)
    print(f"Node names count: {len(node_names)}")
    
    print("\n--- NODES LIST ---")
    for i, node in enumerate(nodes, 1):
        print(f"{i:02d}. [{node.get('type')}] {node.get('name')} (ID: {node.get('id')})")

    print("\n--- CONNECTIONS MAP ---")
    edge_count = 0
    for src, conn_types in connections.items():
        for conn_type, outputs in conn_types.items():
            for out_idx, target_list in enumerate(outputs):
                for target in target_list:
                    dest = target.get('node')
                    print(f"  {src} -> [{conn_type}:{out_idx}] -> {dest}")
                    edge_count += 1
    print(f"Total directed edges: {edge_count}")

if __name__ == '__main__':
    inspect_workflow(r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json")
