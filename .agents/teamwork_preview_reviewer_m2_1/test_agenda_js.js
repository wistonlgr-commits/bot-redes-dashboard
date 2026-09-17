const fs = require('fs');

const jsonContent = fs.readFileSync('flujo asistente de whatsapp.json', 'utf8');
const data = JSON.parse(jsonContent);
const agendaNode = data.nodes.find(n => n.name === 'Formatear Agenda');
const jsCode = agendaNode.parameters.jsCode;

// Create a simulation environment
const mockInputAll = [
    { json: { Dia_Cita: '2026-08-01', Hora_Cita: '09:00', Nombre: 'Juan Perez' } },
    { json: { Dia_Cita: '2026-08-03', Hora_Cita: 'TODO EL DIA', Nombre: '[BLOQUEO] Mantenimiento' } },
    { json: { Dia_Cita: '2026-08-04', Hora_Cita: '16:00', Nombre: '[BLOQUEO] Reunion Online' } },
];

const runFunction = new Function('$input', jsCode);

try {
    const result = runFunction({ all: () => mockInputAll });
    console.log("=== JS EXECUTION SUCCESS ===");
    console.log(result.agenda_disponible);
} catch (e) {
    console.error("=== JS EXECUTION ERROR ===", e);
}
