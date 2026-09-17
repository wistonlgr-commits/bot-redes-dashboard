const fs = require('fs');
const path = require('path');

const targetFilePath = 'c:\\Users\\Leor\\Desktop\\bot whatsapp\\flujo asistente de whatsapp.json';

console.log(`--- QA2 Empirical Verification Script ---`);
console.log(`Target File: ${targetFilePath}`);

let fileStats;
try {
  fileStats = fs.statSync(targetFilePath);
  console.log(`[PASS] File exists. Size: ${fileStats.size} bytes (${(fileStats.size / 1024).toFixed(2)} KB)`);
} catch (err) {
  console.error(`[FAIL] File error: ${err.message}`);
  process.exit(1);
}

const rawContent = fs.readFileSync(targetFilePath, 'utf8');
console.log(`File length in characters: ${rawContent.length}`);

let json;
try {
  json = JSON.parse(rawContent);
  console.log(`[PASS] Valid JSON syntax.`);
} catch (err) {
  console.error(`[FAIL] Invalid JSON syntax: ${err.message}`);
  process.exit(1);
}

const nodes = json.nodes || [];
console.log(`Total nodes in workflow: ${nodes.length}`);

// Inspect node names
console.log('\nNode List:');
nodes.forEach((n, idx) => {
  console.log(`  ${idx + 1}. [${n.type}] "${n.name}" (id: ${n.id})`);
});

// Search for "Cerebro Inteligencia Artificial"
const cerebroNode = nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');
if (cerebroNode) {
  console.log(`\n[PASS] Found node "Cerebro Inteligencia Artificial"`);
  console.log(`Node Type: ${cerebroNode.type}`);
  console.log(`Node Parameters:`, JSON.stringify(cerebroNode.parameters, null, 2));
} else {
  console.error(`\n[FAIL] Node "Cerebro Inteligencia Artificial" not found!`);
}

// Inspect all {{ ... }} expressions in all nodes
console.log('\n--- Auditing {{ ... }} Expressions Across All Nodes ---');
let totalExpressionsFound = 0;
let expressionErrors = 0;
const nodeExpressionReport = [];

function findExpressions(obj, nodeName, jsonPath = '') {
  if (typeof obj === 'string') {
    const matches = obj.match(/\{\{[\s\S]*?\}\}/g);
    if (matches) {
      matches.forEach(expr => {
        totalExpressionsFound++;
        // Check brace symmetry inside match
        const inner = expr.slice(2, -2);
        // check for nested or unclosed braces within inner
        const openBraces = (inner.match(/\{/g) || []).length;
        const closeBraces = (inner.match(/\}/g) || []).length;
        
        let hasError = false;
        let errorMsg = '';
        if (openBraces !== closeBraces) {
          hasError = true;
          errorMsg = `Mismatched braces inside expression (open: ${openBraces}, close: ${closeBraces})`;
        }
        
        // Also check if string outside matches has single { or }
        const stripped = obj.replace(/\{\{[\s\S]*?\}\}/g, '');
        if (stripped.includes('{') || stripped.includes('}')) {
          hasError = true;
          errorMsg = `Orphaned braces found outside template expression in field: "${stripped}"`;
        }

        if (hasError) {
          expressionErrors++;
          console.error(`[EXPR ERROR] Node "${nodeName}" @ ${jsonPath}: ${errorMsg}`);
          console.error(`   Expr: ${expr}`);
        } else {
          nodeExpressionReport.push({ nodeName, jsonPath, expr });
        }
      });
    } else {
      // Check for standalone single braces { or } without {{ }}
      if ((obj.includes('{') || obj.includes('}')) && !obj.includes('{{')) {
        console.warn(`[EXPR WARNING] Standalone brace found in Node "${nodeName}" @ ${jsonPath}: "${obj}"`);
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => findExpressions(item, nodeName, `${jsonPath}[${i}]`));
  } else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach(key => findExpressions(obj[key], nodeName, `${jsonPath}.${key}`));
  }
}

nodes.forEach(n => {
  findExpressions(n.parameters, n.name, 'parameters');
});

console.log(`Total {{ ... }} expressions evaluated: ${totalExpressionsFound}`);
console.log(`Total Expression Errors: ${expressionErrors}`);

