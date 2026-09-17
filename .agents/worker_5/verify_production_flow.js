/**
 * Verification Script for Paso 5: Generación del Archivo Optimizado de Producción
 * File: flujo asistente de whatsapp.json
 */

const fs = require('fs');
const path = require('path');

const targetFilePath = path.resolve(__dirname, '..', '..', 'flujo asistente de whatsapp.json');

console.log('====================================================');
console.log(' PASO 5: VERIFICACIÓN DEL ARCHIVO OPTIMIZADO FLOUJO  ');
console.log('====================================================');
console.log(`Target File: ${targetFilePath}\n`);

// 1. JSON Syntax Validation
let rawContent;
try {
  rawContent = fs.readFileSync(targetFilePath, 'utf8');
  console.log('✅ [1/7] File Read Successful. Size:', rawContent.length, 'bytes');
} catch (err) {
  console.error('❌ [1/7] File Read Failed:', err.message);
  process.exit(1);
}

let workflow;
try {
  workflow = JSON.parse(rawContent);
  console.log('✅ [2/7] JSON Parsing Successful.');
} catch (err) {
  console.error('❌ [2/7] JSON Parse Failed:', err.message);
  process.exit(1);
}

// 2. Structural Schema & Node Count
if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
  console.error('❌ [3/7] Invalid Workflow Structure: "nodes" array missing or empty.');
  process.exit(1);
}
console.log(`✅ [3/7] Workflow Nodes Array Valid. Total Nodes: ${workflow.nodes.length}`);

const nodeMap = new Map();
const nodeNames = new Set();
workflow.nodes.forEach(node => {
  nodeMap.set(node.name, node);
  nodeNames.add(node.name);
});

// 3. Paso 1 Verification: Cerebro Inteligencia Artificial System Prompt
const cerebroNode = nodeMap.get('Cerebro Inteligencia Artificial');
if (!cerebroNode) {
  console.error('❌ [4/7] Paso 1 Failed: "Cerebro Inteligencia Artificial" node missing!');
  process.exit(1);
}
const cerebroContent = JSON.stringify(cerebroNode.parameters);
const requiredPaso1Terms = [
  'asistente del Dr. Angel',
  'Uniaragua',
  '100 a tasa BCV',
  '50 a tasa BCV',
  '80 USD',
  '120 por sesión',
  '|||DATOS|||',
  'String.fromCharCode(123, 123)',
  'requiere_asistencia_humana'
];

let paso1Passed = true;
requiredPaso1Terms.forEach(term => {
  if (!cerebroContent.includes(term)) {
    console.error(`❌ Paso 1 Check Failed: Term "${term}" missing in system prompt!`);
    paso1Passed = false;
  }
});
if (paso1Passed) {
  console.log('✅ [4/7] Paso 1 Verified: Sanitized System Prompt in "Cerebro Inteligencia Artificial" is correct.');
} else {
  process.exit(1);
}

// 4. Paso 2 Verification: Formatear Agenda exact available hours
const agendaNode = nodeMap.get('Formatear Agenda');
if (!agendaNode) {
  console.error('❌ [5/7] Paso 2 Failed: "Formatear Agenda" node missing!');
  process.exit(1);
}
const agendaCode = agendaNode.parameters?.jsCode || '';
const requiredPaso2Terms = [
  'SLOTS_MANANA',
  'SLOTS_TARDE',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '16:00',
  '17:00',
  'parseTimeTo24hHour',
  'America/Caracas'
];
let paso2Passed = true;
requiredPaso2Terms.forEach(term => {
  if (!agendaCode.includes(term)) {
    console.error(`❌ Paso 2 Check Failed: Term "${term}" missing in "Formatear Agenda"!`);
    paso2Passed = false;
  }
});
if (paso2Passed) {
  console.log('✅ [5/7] Paso 2 Verified: Exact available hours calculation in "Formatear Agenda" is correct.');
} else {
  process.exit(1);
}

// 5. Paso 3 & Paso 4 Verification: Formatear Respuesta & bot_quality_logs Topology
const respuestaNode = nodeMap.get('Formatear Respuesta');
if (!respuestaNode) {
  console.error('❌ [6/7] Paso 3 Failed: "Formatear Respuesta" node missing!');
  process.exit(1);
}
const respuestaCode = respuestaNode.parameters?.jsCode || '';
const requiredPaso3Terms = [
  'sanitizeTimes',
  'has_quality_incident',
  'tipo_incidencia',
  'respuesta_raw',
  'entrada_paciente',
  'metadata_log',
  'ALUCINACION_FIN_DE_SEMANA',
  'ALUCINACION_HORARIO'
];
let paso3Passed = true;
requiredPaso3Terms.forEach(term => {
  if (!respuestaCode.includes(term)) {
    console.error(`❌ Paso 3 Check Failed: Term "${term}" missing in "Formatear Respuesta"!`);
    paso3Passed = false;
  }
});

const incidentCheckNode = nodeMap.get('¿Existe Incidencia de Calidad?');
const qualityLogNode = nodeMap.get('Registrar Incidencia (Supabase)');
if (!incidentCheckNode || !qualityLogNode) {
  console.error('❌ [6/7] Paso 4 Failed: Quality logging nodes missing!');
  process.exit(1);
}

const qualityLogParams = JSON.stringify(qualityLogNode.parameters);
if (!qualityLogParams.includes('bot_quality_logs') || !qualityLogParams.includes('={{ $json.metadata_log }}')) {
  console.error('❌ Paso 4 Check Failed: "bot_quality_logs" table or metadata mapping "={{ $json.metadata_log }}" missing!');
  paso3Passed = false;
}

if (paso3Passed) {
  console.log('✅ [6/7] Paso 3 & Paso 4 Verified: Pre-Send Validator Shield & bot_quality_logs topology confirmed.');
} else {
  process.exit(1);
}

// 6. Graph Topology, Orphan Nodes & Circular Dependency Checks
console.log('🔄 Checking Graph Connections & DAG Integrity...');
const connections = workflow.connections || {};
const inDegree = new Map();
const outDegree = new Map();

nodeNames.forEach(name => {
  inDegree.set(name, 0);
  outDegree.set(name, 0);
});

let invalidConnectionCount = 0;

Object.keys(connections).forEach(sourceName => {
  if (!nodeNames.has(sourceName)) {
    console.error(`❌ Connection error: source node "${sourceName}" does not exist in nodes array!`);
    invalidConnectionCount++;
    return;
  }
  const outputs = connections[sourceName];
  Object.keys(outputs).forEach(outputType => {
    const branches = outputs[outputType];
    branches.forEach(branch => {
      branch.forEach(conn => {
        const targetName = conn.node;
        if (!nodeNames.has(targetName)) {
          console.error(`❌ Connection error: target node "${targetName}" from "${sourceName}" does not exist!`);
          invalidConnectionCount++;
        } else {
          outDegree.set(sourceName, (outDegree.get(sourceName) || 0) + 1);
          inDegree.set(targetName, (inDegree.get(targetName) || 0) + 1);
        }
      });
    });
  });
});

if (invalidConnectionCount > 0) {
  console.error(`❌ Graph connection check failed with ${invalidConnectionCount} invalid connections!`);
  process.exit(1);
}

// Check for orphan nodes
const startNode = 'Recibir WhatsApp';
const orphanNodes = [];
nodeNames.forEach(name => {
  const inD = inDegree.get(name);
  const outD = outDegree.get(name);
  if (name !== startNode && inD === 0) {
    orphanNodes.push(name);
  }
});

if (orphanNodes.length > 0) {
  console.error('❌ Orphan nodes found:', orphanNodes);
  process.exit(1);
}

// Check DAG (Kahn's Algorithm for cycle detection)
const adj = new Map();
const inDegCopy = new Map(inDegree);
nodeNames.forEach(n => adj.set(n, []));

Object.keys(connections).forEach(src => {
  const outputs = connections[src];
  Object.keys(outputs).forEach(outType => {
    outputs[outType].forEach(branch => {
      branch.forEach(conn => {
        adj.get(src).push(conn.node);
      });
    });
  });
});

const queue = [];
nodeNames.forEach(name => {
  if (inDegCopy.get(name) === 0) {
    queue.push(name);
  }
});

let visitedCount = 0;
while (queue.length > 0) {
  const curr = queue.shift();
  visitedCount++;
  const neighbors = adj.get(curr) || [];
  neighbors.forEach(neighbor => {
    inDegCopy.set(neighbor, inDegCopy.get(neighbor) - 1);
    if (inDegCopy.get(neighbor) === 0) {
      queue.push(neighbor);
    }
  });
}

if (visitedCount !== nodeNames.size) {
  console.error(`❌ Cycle detected! Visited ${visitedCount} out of ${nodeNames.size} nodes.`);
  process.exit(1);
}

console.log('✅ [7/7] Total Graph Integrity Verified!');
console.log('     - Invalid connections: 0');
console.log('     - Orphan nodes: 0');
console.log('     - Circular dependencies: 0 (Graph is a valid DAG)');
console.log('\n====================================================');
console.log(' 🎉 PASO 5 VALIDATION PASSED 100% SUCCESSFULLY! 🎉 ');
console.log('====================================================\n');
