const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKFLOW_PATH = path.join(__dirname, '..', '..', 'flujo asistente de whatsapp.json');

console.log(`[*] Loading workflow from ${WORKFLOW_PATH}...`);
const wfRaw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const wf = JSON.parse(wfRaw);

console.log(`[*] Workflow Name: "${wf.name}"`);
console.log(`[*] Total Nodes: ${wf.nodes.length}`);

let failCount = 0;
let passCount = 0;

// 1. Verify JavaScript Syntax in Code Nodes using Node.js 'vm' module
wf.nodes.forEach((node) => {
  if (node.type === 'n8n-nodes-base.code') {
    const jsCode = node.parameters?.jsCode;
    if (jsCode) {
      try {
        new vm.Script(jsCode);
        console.log(`[PASS] Node '${node.name}' JS Syntax OK.`);
        passCount++;
      } catch (err) {
        console.error(`[FAIL] Node '${node.name}' JS Syntax Error:`, err.message);
        failCount++;
      }
    }
  }
});

// 2. Verify IF Node expressions and conditions
wf.nodes.forEach((node) => {
  if (node.type === 'n8n-nodes-base.if') {
    const conditions = node.parameters?.conditions?.conditions || [];
    conditions.forEach((cond, idx) => {
      const expr = cond.leftValue;
      if (typeof expr === 'string' && expr.startsWith('=')) {
        // Check for common syntax flaws
        if (expr.includes('$now') && expr.includes('.format(')) {
          console.error(`[FAIL] Node '${node.name}' Condition #${idx+1} uses invalid Luxon call '$now...format()'`);
          failCount++;
        } else {
          console.log(`[PASS] Node '${node.name}' Condition #${idx+1} expression format OK.`);
          passCount++;
        }
      }
    });
  }
});

console.log(`\nNode.js Verification Finished: ${passCount} Passed, ${failCount} Failed.`);
