const fs = require('fs');
const path = require('path');

const jsonPath = 'c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json';
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`Workflow loaded. Total nodes: ${data.nodes.length}`);

data.nodes.forEach((node, idx) => {
  console.log(`\n--- Node [${idx}]: ${node.name} (type: ${node.type}, id: ${node.id}) ---`);
  if (node.parameters) {
    if (node.parameters.jsCode) {
      console.log(`[JS Code]:\n${node.parameters.jsCode}\n`);
    }
    if (node.parameters.options && node.parameters.options.systemMessage) {
      console.log(`[System Message]:\n${node.parameters.options.systemMessage}\n`);
    }
    if (node.parameters.systemMessage) {
      console.log(`[System Message]:\n${node.parameters.systemMessage}\n`);
    }
    if (node.parameters.text) {
      console.log(`[Text]:\n${node.parameters.text}\n`);
    }
  }
});
