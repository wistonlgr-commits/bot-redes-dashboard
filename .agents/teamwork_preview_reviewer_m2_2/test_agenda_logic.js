const fs = require('fs');

const code = fs.readFileSync('c:/Users/Leor/Desktop/bot whatsapp/.agents/teamwork_preview_reviewer_m2_2/agenda_code.js', 'utf8');

function runAgendaTest(inputData) {
    const $input = {
        all: () => inputData.map(item => ({ json: item }))
    };

    // Execute script logic in function context
    const fn = new Function('$input', `
        ${code}
    `);
    return fn($input);
}

// Test cases
const testData = [
    { Nombre: '[BLOQUEO] Conferencia', Hora_Cita: 'TODO EL DIA', Dia_Cita: '2026-08-03' }, // Mon
    { Nombre: '[BLOQUEO] Cita Odontologica', Hora_Cita: '10:00 am', Dia_Cita: '2026-08-04' }, // Tue
    { Nombre: 'Maria Gomez', Hora_Cita: '08:00', Dia_Cita: '2026-08-04' }, // Tue
    { Nombre: '[BLOQUEO] Mantenimiento', Hora_Cita: '', Dia_Cita: '2026-08-05' }, // Wed
];

console.log("Running Agenda Code Test...");
try {
    const result = runAgendaTest(testData);
    console.log("Result received successfully:");
    console.log(result.agenda_disponible);
} catch (e) {
    console.error("Execution failed:", e);
}
