const fs = require('fs');

const data = JSON.parse(fs.readFileSync('n8n_FINAL_AVANZADO.json', 'utf8'));

const geminiNode = data.nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');

if (geminiNode) {
    let prompt = geminiNode.parameters.messages.values[0].content;
    
    // Escape JSON format braces
    prompt = prompt.replace('{\\"nombre\\":', '{{\\"nombre\\":');
    prompt = prompt.replace('\\"\\"}', '\\"\\"}}');
    
    // Escape chat history braces
    prompt = prompt.replace('JSON.stringify($node[\\"Refrescar Datos de Supabase\\"].json.chat_history)', 
                            'JSON.stringify($node[\\"Refrescar Datos de Supabase\\"].json.chat_history || []).replace(/{/g, \\"{{\\").replace(/}/g, \\"}}\\\")');

    geminiNode.parameters.messages.values[0].content = prompt;
    
    fs.writeFileSync('n8n_FINAL_AVANZADO.json', JSON.stringify(data, null, 2));
    console.log('Fixed LangChain curly braces issue');
} else {
    console.log('Gemini node not found');
}
