const fs = require('fs');

const data = JSON.parse(fs.readFileSync('n8n_FINAL_AVANZADO.json', 'utf8'));
const geminiNode = data.nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');

if (geminiNode) {
    let prompt = geminiNode.parameters.messages.values[0].content;
    
    // The previous script turned '{' into '{{' in plain text, which breaks n8n's expression parser.
    // We need to revert it and use `{{ "{{" }}` to output `{{` safely.
    prompt = prompt.replace('{{\\"nombre\\":', '{{ "{{" }}\\"nombre\\":');
    prompt = prompt.replace('\\"\\"}}', '\\"\\"{{ "}}" }}');

    geminiNode.parameters.messages.values[0].content = prompt;
    
    fs.writeFileSync('n8n_FINAL_AVANZADO.json', JSON.stringify(data, null, 2));
    console.log('Fixed n8n expression syntax issue');
} else {
    console.log('Gemini node not found');
}
