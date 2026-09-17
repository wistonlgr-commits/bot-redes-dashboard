const fs = require('fs');

const data = JSON.parse(fs.readFileSync('DrTrejo Ajuste.json', 'utf8'));

// 1. Fix Crear Nuevo Paciente
const createNode = data.nodes.find(n => n.name === 'Crear Nuevo Paciente');
if (createNode) {
    if (!createNode.parameters.fieldsUi.fieldValues.some(f => f.fieldId === 'Conversacion_Abierta')) {
        createNode.parameters.fieldsUi.fieldValues.push({
            'fieldId': 'Conversacion_Abierta',
            'fieldValue': '={{ false }}'
        });
    }
    if (!createNode.parameters.fieldsUi.fieldValues.some(f => f.fieldId === 'bot_is_typing')) {
        createNode.parameters.fieldsUi.fieldValues.push({
            'fieldId': 'bot_is_typing',
            'fieldValue': '={{ false }}'
        });
    }
}

// 2. Ensure Guardar Resumen en Supabase maps requiere_asistencia_humana
const saveNode = data.nodes.find(n => n.name === 'Guardar Resumen en Supabase');
if (saveNode && !saveNode.parameters.fieldsUi.fieldValues.some(f => f.fieldId === 'requiere_asistencia_humana')) {
    saveNode.parameters.fieldsUi.fieldValues.push({
        'fieldId': 'requiere_asistencia_humana',
        'fieldValue': '={{ $json.requiere_asistencia_humana || "" }}'
    });
}

fs.writeFileSync('n8n_FINAL_AVANZADO.json', JSON.stringify(data, null, 2));
console.log('Created n8n_FINAL_AVANZADO.json with all fixes.');
