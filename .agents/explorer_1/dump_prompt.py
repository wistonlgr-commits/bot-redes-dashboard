import json

with open('flujo asistente de whatsapp.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for n in data.get('nodes', []):
    if n.get('name') == 'Cerebro Inteligencia Artificial':
        params = n.get('parameters', {})
        # Write json representation of parameters to file
        with open('.agents/explorer_1/cerebro_params.json', 'w', encoding='utf-8') as out:
            json.dump(params, out, indent=2, ensure_ascii=False)
            
        # Also extract prompt / text from parameters
        prompt_text = ""
        messages = params.get('messages', {}).get('messageValues', [])
        for idx, msg in enumerate(messages):
            prompt_text += f"--- Message {idx} ({msg.get('messageType', 'unknown')}) ---\n"
            prompt_text += str(msg.get('message', '')) + "\n\n"
            
        if 'prompt' in params:
            prompt_text += "--- Root Prompt parameter ---\n"
            prompt_text += str(params['prompt']) + "\n\n"
            
        with open('.agents/explorer_1/extracted_node_prompt.txt', 'w', encoding='utf-8') as out:
            out.write(prompt_text)
            
        print("Saved cerebro_params.json and extracted_node_prompt.txt. Total length of extracted text:", len(prompt_text))
