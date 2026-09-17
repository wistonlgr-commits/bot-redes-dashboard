import json
import sys
import os

flow_path = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"

def verify_json_and_structure():
    print("=== 1. JSON & n8n Structure Validation ===")
    try:
        with open(flow_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print("[PASS] JSON syntax is valid.")
    except Exception as e:
        print(f"[FAIL] Invalid JSON syntax: {e}")
        return False

    nodes = data.get("nodes", [])
    connections = data.get("connections", {})
    
    print(f"Total nodes: {len(nodes)}")
    print(f"Total connection sources: {len(connections)}")
    
    node_names = {n.get("name"): n for n in nodes}
    node_ids = {n.get("id"): n for n in nodes}
    
    # Check duplicate names or IDs
    if len(node_names) != len(nodes):
        print("[WARN] Duplicate node names detected!")
    else:
        print("[PASS] All node names are unique.")
        
    if len(node_ids) != len(nodes):
        print("[FAIL] Duplicate node IDs detected!")
    else:
        print("[PASS] All node IDs are unique.")
        
    # Check broken connections
    broken_connections = []
    for src_name, conn_data in connections.items():
        if src_name not in node_names:
            broken_connections.append(f"Source node '{src_name}' not in nodes list")
        for output_type, conn_list in conn_data.items():
            for target_group in conn_list:
                for target_item in target_group:
                    target_name = target_item.get("node")
                    if target_name not in node_names:
                        broken_connections.append(f"Target node '{target_name}' (from '{src_name}') not in nodes list")
                        
    if broken_connections:
        print("[FAIL] Broken connections found:")
        for bc in broken_connections:
            print("  -", bc)
    else:
        print("[PASS] All connections reference valid nodes.")

    # Locate required nodes
    target_node_name = "Formatear Respuesta"
    ds_nodes = ["Guardar Resumen en Supabase", "Respaldar en Google Sheets", "Enviar Mensaje de WhatsApp"]
    
    if target_node_name in node_names:
        print(f"[PASS] Found target node '{target_node_name}'.")
    else:
        print(f"[FAIL] Target node '{target_node_name}' missing.")
        
    for dsn in ds_nodes:
        if dsn in node_names:
            print(f"[PASS] Found downstream node '{dsn}'.")
        else:
            print(f"[FAIL] Downstream node '{dsn}' missing.")

    return True

if __name__ == "__main__":
    verify_json_and_structure()
