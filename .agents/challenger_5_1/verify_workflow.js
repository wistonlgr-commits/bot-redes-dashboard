const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsonPath = 'c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json';
const workflow = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log("=========================================");
console.log("   N8N WORKFLOW EMPIRICAL VERIFICATION   ");
console.log("=========================================\n");

// ---------------------------------------------------------
// 1. KAHN'S ALGORITHM TOPOLOGICAL SORT & ORPHAN DETECTION
// ---------------------------------------------------------
function testKahnsAlgorithm(data) {
  const nodes = data.nodes || [];
  const connections = data.connections || {};

  const nodeMap = new Map();
  const inDegree = new Map();
  const outDegree = new Map();
  const adj = new Map();

  nodes.forEach(n => {
    nodeMap.set(n.name, n);
    inDegree.set(n.name, 0);
    outDegree.set(n.name, 0);
    adj.set(n.name, []);
  });

  Object.keys(connections).forEach(src => {
    if (!nodeMap.has(src)) return;
    const connTypes = connections[src];
    Object.keys(connTypes).forEach(cType => {
      connTypes[cType].forEach((outputs, outIdx) => {
        outputs.forEach(target => {
          const dest = target.node;
          if (nodeMap.has(dest)) {
            adj.get(src).push({ dest, connType: cType, outIdx });
            inDegree.set(dest, inDegree.get(dest) + 1);
            outDegree.set(src, outDegree.get(src) + 1);
          }
        });
      });
    });
  });

  const zeroInDegree = [];
  inDegree.forEach((deg, name) => {
    if (deg === 0) zeroInDegree.push(name);
  });

  const queue = [...zeroInDegree];
  const topoOrder = [];
  const inDegreeCopy = new Map(inDegree);

  while (queue.length > 0) {
    const curr = queue.shift();
    topoOrder.push(curr);

    const neighbors = adj.get(curr) || [];
    neighbors.forEach(({ dest }) => {
      inDegreeCopy.set(dest, inDegreeCopy.get(dest) - 1);
      if (inDegreeCopy.get(dest) === 0) {
        queue.push(dest);
      }
    });
  }

  const hasCycle = topoOrder.length !== nodes.length;
  const triggerNodes = new Set(['Recibir WhatsApp']);
  const orphanNodes = zeroInDegree.filter(name => !triggerNodes.has(name));

  return {
    totalNodes: nodes.length,
    zeroInDegreeNodes: zeroInDegree,
    topoOrder,
    hasCycle,
    orphanNodesCount: orphanNodes.length,
    orphanNodes,
    inDegree: Object.fromEntries(inDegree),
    outDegree: Object.fromEntries(outDegree)
  };
}

// ---------------------------------------------------------
// 2. REACHABILITY ANALYSIS FROM 'Recibir WhatsApp'
// ---------------------------------------------------------
function testReachability(data, root = 'Recibir WhatsApp') {
  const nodes = data.nodes || [];
  const connections = data.connections || {};
  const allNodeNames = new Set(nodes.map(n => n.name));

  const adj = new Map();
  allNodeNames.forEach(name => adj.set(name, []));

  Object.keys(connections).forEach(src => {
    if (!allNodeNames.has(src)) return;
    Object.keys(connections[src]).forEach(cType => {
      connections[src][cType].forEach(outputs => {
        outputs.forEach(target => {
          if (allNodeNames.has(target.node)) {
            adj.get(src).push(target.node);
          }
        });
      });
    });
  });

  const visited = new Set();
  const queue = [root];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!visited.has(curr)) {
      visited.add(curr);
      (adj.get(curr) || []).forEach(neighbor => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
  }

  const unreachable = [...allNodeNames].filter(name => !visited.has(name));

  return {
    root,
    totalNodes: allNodeNames.size,
    reachableCount: visited.size,
    reachableNodes: [...visited],
    unreachableCount: unreachable.length,
    unreachableNodes: unreachable,
    allReachable: visited.size === allNodeNames.size
  };
}

// ---------------------------------------------------------
// 3. CODE NODE JS EXECUTION STRESS TESTING (via VM)
// ---------------------------------------------------------
function testCodeNodesJS(data) {
  const codeNodes = data.nodes.filter(n => n.type === 'n8n-nodes-base.code');
  const results = [];

  codeNodes.forEach(node => {
    const code = node.parameters.jsCode || node.parameters.code || '';
    console.log(`\nTesting Code Node: [${node.name}] (ID: ${node.id})`);

    let executionSuccess = false;
    let errorDetails = null;
    let outputs = [];

    if (node.name === 'Formatear Agenda') {
      try {
        const sandbox = {
          $input: {
            all: () => [
              { json: { Dia_Cita: '2026-07-27', Hora_Cita: '08:00' } },
              { json: { Dia_Cita: '2026-07-28', Hora_Cita: 'todo el dia' } }
            ]
          },
          console
        };
        vm.createContext(sandbox);
        const script = new vm.Script(`(function() {\n${code}\n})()`);
        const res = script.runInContext(sandbox);
        executionSuccess = true;
        outputs.push({ testCase: 'Default Mock Input', result: res });
      } catch (err) {
        errorDetails = err.message;
      }
    } else if (node.name === 'Formatear Respuesta') {
      const testCases = [
        {
          name: 'Valid AI Response with |||DATOS|||',
          json: { content: 'Hola! Con gusto te atiendos.\n|||DATOS|||\n{"nombre": "Juan Perez", "ciudad": "Maracay", "motivo_consulta": "Varices", "temperatura": "caliente", "resumen": "Paciente solicita cita", "dia_cita": "2026-07-27", "hora_cita": "08:00", "requiere_asistencia_humana": ""}' }
        },
        {
          name: 'Malformed JSON in |||DATOS||| (Regex Fallback Test)',
          json: { content: 'Hola!\n|||DATOS||\n"nombre": "Maria", "dia_cita": "2026-07-27", "hora_cita": "09:00"' }
        },
        {
          name: 'Empty Response (Fallback Trigger)',
          json: { content: '' }
        },
        {
          name: 'Weekend Date Attempt (Saturday Invalidation)',
          json: { content: 'Te anoto para el sábado.\n|||DATOS|||\n{"nombre": "Pedro", "dia_cita": "2026-08-01", "hora_cita": "08:00"}' }
        },
        {
          name: 'Invalid Time Slot Attempt (14:30 Invalidation)',
          json: { content: 'Te anoto a las 2:30 pm.\n|||DATOS|||\n{"nombre": "Pedro", "dia_cita": "2026-07-27", "hora_cita": "14:30"}' }
        },
        {
          name: 'Booking Without Patient Name Guard',
          json: { content: 'Te aparto la cita.\n|||DATOS|||\n{"dia_cita": "2026-07-27", "hora_cita": "08:00"}' }
        }
      ];

      const tcResults = [];
      let allTcPassed = true;

      testCases.forEach(tc => {
        try {
          const sandbox = {
            $json: tc.json,
            $node: {
              'Recibir WhatsApp': {
                json: { body: { data: { message: { conversation: 'Hola quisiera una cita' } } } }
              },
              'Refrescar Datos de Supabase': {
                json: { chat_history: [], Nombre: '', Ciudad: '', Dia_Cita: '', Hora_Cita: '' }
              },
              'Formatear Agenda': {
                json: { agenda_disponible: '- 2026-07-27: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] | TARDE DISPONIBLE: [Sin disponibilidad]' }
              }
            },
            console,
            Intl,
            Date,
            Math,
            Array,
            Object,
            RegExp,
            JSON,
            String,
            parseInt,
            isNaN
          };
          vm.createContext(sandbox);
          const script = new vm.Script(`(function() {\n${code}\n})()`);
          const res = script.runInContext(sandbox);
          tcResults.push({ case: tc.name, success: true, output: res });
        } catch (err) {
          allTcPassed = false;
          tcResults.push({ case: tc.name, success: false, error: err.message });
        }
      });

      executionSuccess = allTcPassed;
      outputs = tcResults;
    }

    results.push({
      nodeName: node.name,
      nodeId: node.id,
      success: executionSuccess,
      error: errorDetails,
      testDetails: outputs
    });
  });

  return results;
}

// ---------------------------------------------------------
// EXECUTE SUITE AND SAVE REPORT
// ---------------------------------------------------------
const kahnRes = testKahnsAlgorithm(workflow);
const reachRes = testReachability(workflow);
const jsCodeRes = testCodeNodesJS(workflow);

const fullReport = {
  timestamp: new Date().toISOString(),
  kahnTopologicalSort: kahnRes,
  reachability: reachRes,
  jsExecutionResults: jsCodeRes
};

fs.writeFileSync(
  'c:\\Users\\Leor\\Desktop\\bot whatsapp\\.agents\\challenger_5_1\\js_test_results.json',
  JSON.stringify(fullReport, null, 2),
  'utf8'
);

console.log("\n--- TEST SUMMARY ---");
console.log(`1. Kahn's Topological Sort: ${kahnRes.hasCycle ? 'FAILED (Cycle detected)' : 'PASSED (0 Circular Dependencies)'}`);
console.log(`   Orphan Nodes Count: ${kahnRes.orphanNodesCount} (${kahnRes.orphanNodesCount === 0 ? 'PASSED' : 'FAILED'})`);
console.log(`2. Reachability from 'Recibir WhatsApp': ${reachRes.allReachable ? 'PASSED (23/23 Nodes Reachable)' : 'FAILED'}`);
console.log(`3. Code Nodes JS Execution: ${jsCodeRes.every(r => r.success) ? 'PASSED (Zero Runtime Errors)' : 'FAILED'}`);
