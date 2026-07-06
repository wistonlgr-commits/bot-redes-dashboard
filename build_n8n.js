const fs = require('fs');

const rawData = fs.readFileSync('original.json', 'utf8');
const workflow = JSON.parse(rawData);

// Nodes array
const nodes = workflow.nodes;

// Update "Crear Nuevo Paciente" node Fuente logic
const createPatientNode = nodes.find(n => n.name === 'Crear Nuevo Paciente');
if (createPatientNode) {
    const fuenteField = createPatientNode.parameters.fieldsUi.fieldValues.find(f => f.fieldId === 'Fuente');
    if (fuenteField) {
        fuenteField.fieldValue = `={{ $node["Recibir WhatsApp"].json.body.data.message?.extendedTextMessage?.contextInfo?.sourceUrl?.includes('instagram') ? 'instagram' : ($node["Recibir WhatsApp"].json.body.data.message?.extendedTextMessage?.contextInfo?.sourceUrl?.includes('facebook') ? 'facebook' : 'organico') }}`;
    }
}

// Update "Pausa Anti-Spam" to 4 seconds
const waitNode = nodes.find(n => n.name === 'Pausa Anti-Spam');
if (waitNode) {
    waitNode.parameters.amount = 4;
}

// Update "¿El Bot está Autorizado?"
const checkBotNode = nodes.find(n => n.name === '¿El Bot está Autorizado?');
if (checkBotNode) {
    checkBotNode.parameters.conditions.conditions = [
        {
            "id": "conv-abierta",
            "leftValue": "={{ $json.Conversacion_Abierta }}",
            "rightValue": "",
            "operator": { "type": "boolean", "operation": "false", "singleValue": true }
        },
        {
            "id": "bot-active",
            "leftValue": "={{ $('Obtener_Configuracion').first().json.is_active }}",
            "rightValue": "",
            "operator": { "type": "boolean", "operation": "true", "singleValue": true }
        },
        {
            "id": "bot-typing",
            "leftValue": "={{ $json.bot_is_typing || false }}",
            "rightValue": "",
            "operator": { "type": "boolean", "operation": "false", "singleValue": true }
        }
    ];
}

// Generate new nodes
const lockMutexNode = {
    "parameters": {
        "operation": "update",
        "tableId": "leads",
        "filters": {
            "conditions": [{ "keyName": "phone_number", "condition": "eq", "keyValue": "={{ $('Recibir WhatsApp').item.json.body.data.key.remoteJid }}" }]
        },
        "fieldsUi": {
            "fieldValues": [{ "fieldId": "bot_is_typing", "fieldValue": "={{ true }}" }]
        }
    },
    "type": "n8n-nodes-base.supabase",
    "typeVersion": 1,
    "position": [850, -250],
    "id": "mutex-lock",
    "name": "Bloquear Bot (Mutex)",
    "credentials": { "supabaseApi": { "id": "gidwrNK4lcuu0fQR", "name": "Supabase account" } }
};

const checkAgendaNode = {
    "parameters": {
        "operation": "getAll",
        "tableId": "leads",
        "limit": 100,
        "filters": {
            "conditions": [{ "keyName": "Dia_Cita", "condition": "neq", "keyValue": "" }]
        }
    },
    "type": "n8n-nodes-base.supabase",
    "typeVersion": 1,
    "position": [1050, -250],
    "id": "check-agenda",
    "name": "Consultar Agenda Global",
    "credentials": { "supabaseApi": { "id": "gidwrNK4lcuu0fQR", "name": "Supabase account" } }
};

const formatAgendaNode = {
    "parameters": {
        "jsCode": "let occupied = [];\nconst todayStr = new Date(new Date().toLocaleString(\"en-US\", {timeZone: \"America/Caracas\"})).toISOString().split('T')[0];\nfor (const lead of $input.all()) {\n  const date = lead.json.Dia_Cita;\n  const time = lead.json.Hora_Cita || 'Hora no especificada';\n  if (date && date >= todayStr && date !== '') {\n    occupied.push(`- ${date} a las ${time}`);\n  }\n}\nlet txt = occupied.length > 0 ? occupied.join('\\n') : 'Agenda libre';\nreturn { agenda_ocupada: txt };"
    },
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1250, -250],
    "id": "format-agenda",
    "name": "Formatear Agenda"
};

nodes.push(lockMutexNode, checkAgendaNode, formatAgendaNode);

// Update Gemini Node Prompt
const geminiNode = nodes.find(n => n.name === 'Cerebro Inteligencia Artificial');
if (geminiNode) {
    geminiNode.parameters.messages.values[0].content = `=Eres la asistente del Dr. Ángel Trejo Alvarado, especialista en flebología y problemas circulatorios (várices, úlceras, pie diabético, etc.). Tu nombre es "la asistente del Dr. Ángel". Trabajas atendiendo pacientes por WhatsApp.

Tu objetivo es atender al paciente con naturalidad, resolver sus dudas, calificar su necesidad y cerrar agendando una cita. Debes llevarlo paso a paso de forma fluida y conversacional, sin parecer un robot.

BASE DE CONOCIMIENTO (NO INVENTES NADA FUERA DE ESTO):
- Ubicación: Maracay, Centro Empresarial Uniaragua, Piso 3, Oficina 302 (Av. Mariño Sur, San Miguel).
- Consulta presencial: $100 a tasa BCV. Incluye Eco Doppler Venoso.
- Asesoría online: $50 a tasa BCV. Solo para pacientes que están fuera de Maracay y no pueden viajar.
- Sesión de esclerosis (arañitas): $120 por sesión (por cada pierna).
- Horario de trabajo del Doctor: Lunes a Viernes de 8:00 am a 4:00 pm. (NUNCA ofrezcas sábados ni domingos, a menos que el paciente insista mucho, dile que el doctor evalúa el caso para el sábado).
- No se necesitan exámenes de laboratorio previos, el doctor hace todo en consulta.

REGLAS DE AGENDA (CRÍTICO):
A continuación, verás una lista de los horarios que YA ESTÁN OCUPADOS O BLOQUEADOS en el sistema. NUNCA ofrezcas una cita que coincida con estos días y horas.
[AGENDA_OCUPADA]
{{ $node["Formatear Agenda"].json.agenda_ocupada }}
[/AGENDA_OCUPADA]

ESTILO DE ESCRITURA (CRÍTICO - SI ROMPES ESTAS REGLAS EL SISTEMA FALLARÁ):
- EXTREMADAMENTE CORTO. Responde directo al grano.
- TONO HUMANO Y CASUAL: No suenes como un robot de servicio al cliente ("Excelente! Te esperamos."). Escribe relajada. Usa minúsculas a veces. Omite comas no necesarias.
- No uses negritas bajo ninguna circunstancia.
- USA LISTAS (VIÑETAS) con guiones (-) OBLIGATORIAMENTE cuando des la dirección de la clínica y cuando ofrezcas opciones de días/horas.
- No uses ambos signos de exclamación (¡ !). Usa solo el de cierre: "Hola!"
- Nunca uses palabras de IA como: crucial, vital, en resumen, en conclusión.
- El mensaje debe ser continuo hasta el final. Haz UN SOLO salto de línea obligatorio al final ÚNICAMENTE para separar el bloque de datos JSON. (NUNCA uses \\n o \\t visibles).

METODOLOGÍA Y GUIONES OBLIGATORIOS ("Paso a Paso Disimulado"):
Sigue este orden estrictamente, no saltes pasos:

1. SALUDO INICIAL (Si no sabes su ciudad y motivo):
"Hola! Un gusto saludarte. Soy la asistente del Dr. Angel. Para brindarte la información exacta, ¿podrías decirme desde qué ciudad nos escribes y cuál es el motivo de tu consulta?"

2. DAR PRECIO Y UBICACIÓN (Una vez sabes ciudad y motivo):
- Opción A (Paciente en Maracay o dispuesto a viajar): "Excelente. El Dr. Angel atiende en Maracay, en el Centro Empresarial Uniaragua. La consulta tiene un valor de $100 (a tasa BCV) e incluye el Eco Doppler Venoso para un diagnóstico completo."
- Opción B (Paciente fuera de Maracay): "Excelente. Como te encuentras fuera de Maracay, el Dr. Angel ofrece una Asesoría Médica Online que tiene un valor de $50 (a tasa BCV) donde evalúa tu caso detalladamente."
(Si preguntan por arañitas/esclerosis, aclara que cuesta $120 por sesión, por cada pierna).

3. OFRECER "MAÑANA O TARDE" (Solo después de dar el precio):
NUNCA des horas exactas de entrada. Ofrece UN SOLO DÍA (que sea máximo a 2 días de la fecha de hoy, saltando los fines de semana).
Ejemplo: "Tengo disponibilidad para este [Día], ¿te sirve en la mañana o en la tarde?"

4. DAR LAS HORAS EXACTAS (Cuando el paciente ya eligió mañana o tarde):
Elige dos horas disponibles en ese bloque (mañana es 8am-12pm, tarde es 1pm-4pm). Evita chocar con la agenda ocupada. OBLIGATORIO usar formato de lista:
"Perfecto, en la mañana tengo estos espacios libres:
- A las [Hora 1]
- A las [Hora 2]
¿Cuál te queda mejor?"

5. RECOPILAR DATOS (Cuando ya eligió la hora exacta):
NUNCA confirmes la cita de inmediato. Primero pide los datos:
"Excelente elección. Para poder agendarte formalmente en el sistema, por favor indícame tu nombre completo, edad, número de cédula y motivo exacto de la consulta."

6. CONFIRMACIÓN FINAL (Solo cuando el paciente ya te dio todos los datos):
"Confirmación Final! Quedas agendado/a para el día [Día] a las [Hora]. Nos vemos en:
- Centro Empresarial Uniaragua
- Piso 3, Oficina 302
- Maracay"

PACIENTES YA AGENDADOS: Si escriben para confirmar que tienen cita o que ya llegaron, responde amablemente y corta: "Hola! He notado que ya tienes una cita con nosotros. En un momento la secretaria te atenderá personalmente. Un saludo!".

EXTRACCIÓN DE DATOS (CRÍTICO): 
FECHA ACTUAL: {{ $now.setZone('America/Caracas').format('cccc, yyyy-MM-dd') }}. (USA ESTA FECHA PARA TUS CÁLCULOS DE DÍAS).
Al final de CADA respuesta, haz UN SALTO DE LÍNEA y agrega el marcador |||DATOS||| seguido del JSON en texto plano absoluto. El bloque debe empezar con { y terminar con }.

|||DATOS|||
{"nombre": "", "ciudad": "", "motivo_consulta": "", "temperatura": "frio/tibio/caliente", "resumen": "", "dia_cita": "YYYY-MM-DD", "hora_cita": ""}

REGLAS PARA EL JSON:
- dia_cita: DEBE SER YYYY-MM-DD. NUNCA pongas solo el día de la semana. Solo llénalo cuando sea un día DEFINITIVO.
- hora_cita: Solo llénalo cuando el paciente ya eligió la hora exacta.

HISTORIAL ACTUAL DE LA CONVERSACIÓN:
{{ JSON.stringify($node["Refrescar Datos de Supabase"].json.chat_history) }}`;
    geminiNode.position = [1450, -50]; // Move Gemini further right to accommodate the new nodes
}

// Update "Guardar Resumen en Supabase" to unlock mutex
const unlockMutexNode = nodes.find(n => n.name === 'Guardar Resumen en Supabase');
if (unlockMutexNode) {
    unlockMutexNode.parameters.fieldsUi.fieldValues.push({
        "fieldId": "bot_is_typing",
        "fieldValue": "={{ false }}"
    });
}

// Move Formatear Respuesta and HTTP request nodes to the right
const formatResponseNode = nodes.find(n => n.name === 'Formatear Respuesta');
if (formatResponseNode) formatResponseNode.position = [1650, -50];

if (unlockMutexNode) unlockMutexNode.position = [1850, 100];

const httpRequestNode = nodes.find(n => n.name === 'Enviar Mensaje de WhatsApp');
if (httpRequestNode) httpRequestNode.position = [2050, 300];

const gSheetsNode = nodes.find(n => n.name === 'Respaldar en Google Sheets');
if (gSheetsNode) gSheetsNode.position = [1850, -100];

// Re-wire connections
const connections = workflow.connections;
delete connections['¿El Bot está Autorizado?'];

connections['¿El Bot está Autorizado?'] = {
    "main": [[{ "node": "Bloquear Bot (Mutex)", "type": "main", "index": 0 }]]
};
connections['Bloquear Bot (Mutex)'] = {
    "main": [[{ "node": "Consultar Agenda Global", "type": "main", "index": 0 }]]
};
connections['Consultar Agenda Global'] = {
    "main": [[{ "node": "Formatear Agenda", "type": "main", "index": 0 }]]
};
connections['Formatear Agenda'] = {
    "main": [[{ "node": "Mostrar \"Escribiendo...\"", "type": "main", "index": 0 }]]
};

fs.writeFileSync('C:\\Users\\Leor\\Desktop\\bot whatsapp\\n8n_workflow_actualizado.json', JSON.stringify(workflow, null, 2));
console.log("JSON generated successfully!");
