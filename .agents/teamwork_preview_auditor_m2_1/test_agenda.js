const fs = require('fs');

const flow = JSON.parse(fs.readFileSync('flujo asistente de whatsapp.json', 'utf8'));
const agendaNode = flow.nodes.find(n => n.name === 'Formatear Agenda');
const code = agendaNode.parameters.jsCode;

function runAgenda(mockInput) {
    const $input = { all: () => mockInput.map(json => ({ json })) };
    const fn = new Function('$input', code);
    return fn($input);
}

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

console.log(`\n--- TEST 3b: [BLOQUEO] slot 09:00 on tomorrow (${tomorrowStr}) ---`);
const res3b = runAgenda([{ Dia_Cita: tomorrowStr, Nombre: '[BLOQUEO] Reunión', Hora_Cita: '09:00 am' }]);
console.log(res3b.agenda_disponible.split('\n').filter(l => l.includes(tomorrowStr)).join('\n'));
