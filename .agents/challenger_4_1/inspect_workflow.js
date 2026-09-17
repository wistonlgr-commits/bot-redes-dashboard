const fs = require('fs');

const workflowPath = 'c:/Users/Leor/Desktop/bot whatsapp/flujo asistente de whatsapp.json';
const data = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

console.log('Workflow Name:', data.name);
console.log('Total Nodes:', data.nodes.length);

console.log('\n--- NODE LIST ---');
data.nodes.forEach((node, idx) => {
  console.log(`${idx + 1}. [${node.id}] "${node.name}" (${node.type})`);
});

console.log('\n--- CONNECTIONS ---');
console.log(JSON.stringify(data.connections, null, 2));
