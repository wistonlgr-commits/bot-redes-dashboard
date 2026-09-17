const fs = require('fs');
const path = require('path');

// Load workflow JSON
const workflowPath = path.join(__dirname, '..', '..', 'flujo asistente de whatsapp.json');
const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const node15 = workflowJson.nodes.find(n => n.name === 'Formatear Agenda');
const codeFromWorkflow = node15.parameters.jsCode;

const standaloneCode = fs.readFileSync(path.join(__dirname, '..', '..', 'formatear_agenda_corregido.js'), 'utf8');

console.log('Workflow Node #15 present:', !!node15);
console.log('Code matches standalone file exactly:', codeFromWorkflow.trim() === standaloneCode.trim());

// Function to simulate running Node #15 code with given inputs and mock $input.all()
function runNode15(jsCode, mockInputArray, mockNowDate) {
    // Wrap code in a function body
    // Mock $input.all() and Date
    const wrapped = `
        const $input = {
            all: () => ${JSON.stringify(mockInputArray)}
        };
        const DateOriginal = Date;
        ${mockNowDate ? `
        const FixedDate = function(...args) {
            if (args.length === 0) return new DateOriginal('${mockNowDate}');
            return new DateOriginal(...args);
        };
        FixedDate.now = () => new DateOriginal('${mockNowDate}').getTime();
        FixedDate.parse = DateOriginal.parse;
        FixedDate.UTC = DateOriginal.UTC;
        // Keep prototype
        FixedDate.prototype = DateOriginal.prototype;
        ` : ''}
        
        ${jsCode}
    `;

    try {
        const evalFunc = new Function('$input', wrapped);
        return evalFunc(mockInputArray);
    } catch (e) {
        return { error: e.message, stack: e.stack };
    }
}

// Test cases execution harness
console.log('\n--- Running Test Harness ---');
