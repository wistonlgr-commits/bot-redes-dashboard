const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'flujo asistente de whatsapp.json');

console.log('Loading file:', filePath);
let rawData;
try {
  rawData = fs.readFileSync(filePath, 'utf8');
  console.log('File loaded successfully, size:', rawData.length, 'bytes');
} catch (err) {
  console.error('Failed to read file:', err);
  process.exit(1);
}

let workflow;
try {
  workflow = JSON.parse(rawData);
  console.log('JSON.parse successful!');
} catch (err) {
  console.error('JSON parse error:', err.message);
  process.exit(1);
}

console.log('\n--- WORKFLOW METADATA ---');
console.log('Top-level keys:', Object.keys(workflow));
console.log('Nodes count:', workflow.nodes ? workflow.nodes.length : 0);
console.log('Connections count:', workflow.connections ? Object.keys(workflow.connections).length : 0);

// Print all node names and types
console.log('\n--- NODES LIST ---');
if (workflow.nodes) {
  workflow.nodes.forEach((n, i) => {
    console.log(`[${i + 1}] ID: "${n.id}", Name: "${n.name}", Type: "${n.type}", Position: ${JSON.stringify(n.position)}`);
  });
}

// Check specifically for nodes of interest
const cerebroNode = workflow.nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');
const formatearAgendaNode = workflow.nodes.find(n => n.name === 'Formatear Agenda');
const formatearRespuestaNode = workflow.nodes.find(n => n.name === 'Formatear Respuesta');
const botQualityLogsNode = workflow.nodes.find(n => n.name === 'bot_quality_logs' || n.name.includes('bot_quality_logs') || n.name.includes('quality'));

console.log('\n--- CHECK PASO 1: Cerebro Inteligencia Artificial ---');
if (cerebroNode) {
  console.log('Found node:', cerebroNode.name);
  console.log('Type:', cerebroNode.type);
  console.log('Parameters:', JSON.stringify(cerebroNode.parameters, null, 2).slice(0, 1000));
} else {
  console.log('CRITICAL: Cerebro Inteligencia Artificial node NOT found!');
}

console.log('\n--- CHECK PASO 2: Formatear Agenda ---');
if (formatearAgendaNode) {
  console.log('Found node:', formatearAgendaNode.name);
  console.log('Type:', formatearAgendaNode.type);
  console.log('Parameters:', JSON.stringify(formatearAgendaNode.parameters, null, 2));
} else {
  console.log('CRITICAL: Formatear Agenda node NOT found!');
}

console.log('\n--- CHECK PASO 3: Formatear Respuesta ---');
if (formatearRespuestaNode) {
  console.log('Found node:', formatearRespuestaNode.name);
  console.log('Type:', formatearRespuestaNode.type);
  console.log('Parameters:', JSON.stringify(formatearRespuestaNode.parameters, null, 2));
} else {
  console.log('CRITICAL: Formatear Respuesta node NOT found!');
}

console.log('\n--- CHECK PASO 4: bot_quality_logs ---');
const qualityNodes = workflow.nodes.filter(n => n.name.toLowerCase().includes('quality') || n.name.toLowerCase().includes('log') || (n.parameters && JSON.stringify(n.parameters).includes('bot_quality_logs')));
console.log('Quality/log nodes found:', qualityNodes.map(n => n.name));
qualityNodes.forEach(n => {
  console.log(`Node "${n.name}" details:`, JSON.stringify(n.parameters, null, 2));
});
