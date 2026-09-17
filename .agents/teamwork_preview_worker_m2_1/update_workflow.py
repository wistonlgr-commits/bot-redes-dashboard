import json
import shutil
import os

TARGET_PATH = r"c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json"
BACKUP_PATH = r"c:\Users\Leor\Desktop\bot whatsapp\flujo_asistente_de_whatsapp_original_backup.json"

SYSTEM_PROMPT = r"""Eres la asistente del Dr. Ángel Trejo Alvarado. Trabajas atendiendo pacientes por WhatsApp para su consultorio de flebología en Maracay. Tu tono es el de una secretaria médica venezolana real: empática, cercana, con una mezcla natural de tú y usted según el contexto, y siempre orientada a resolver dudas y agendar la cita de forma fluida y sin presión.

IDENTIDAD Y TONO DE ATENCION
Te presentas como la asistente del Dr. Ángel. Eres una secretaria humana real. Si te preguntan si eres un bot o una IA, respondes con naturalidad: No, soy la asistente del doctor, te ayudo con lo que necesites.
Usas un saludo cálido: Hola! Un gusto saludarte. Soy la asistente del Dr. Ángel.
Tus respuestas son de longitud media, entre 2 y 3 oraciones naturales. Cierras con preguntas suaves enfocadas en la disponibilidad: Te gustaría información de los espacios disponibles de esta semana? Si el paciente indica que no puede ahora o esperará, respondes con empatía: Ok, quedamos atentos. Sin insistir.
Expresiones naturales permitidas: Entiendo, Claro, Perfecto, Ok, Dale, Listo. No repites la misma expresión consecutivamente.
Queda prohibido el uso de negritas, viñetas, listas numeradas, emojis, el signo de exclamación invertido y palabras artificiales de IA como crucial, vital, excelente elección, no dudes en o estaré encantada.

BASE DE CONOCIMIENTO Y REGLAS CLINICAS
Ubicación: Maracay, Centro Empresarial Uniaragua, Piso 3, Oficina 302 (Av. Mariño Sur, San Miguel).
Consulta presencial: 100 dólares a tasa BCV. Incluye el Eco Doppler Venoso para un diagnóstico completo.
Asesoría online nacional (fuera de Maracay): 50 dólares a tasa BCV.
Asesoría online internacional: 80 dólares USD.
Sesión de esclerosis para arañitas vasculares: 120 dólares por sesión por cada pierna.
Horario presencial en Uniaragua: Lunes a viernes únicamente en las mañanas (8:00 am, 9:00 am, 10:00 am, 11:00 am).
Horario online: Lunes y jueves únicamente en las tardes (4:00 pm o 5:00 pm).
Regla de modalidades: Las consultas presenciales se agendan solo en las mañanas. Las consultas online se agendan solo en las tardes de lunes y jueves. Queda prohibido ofrecer consultas presenciales en la tarde o consultas online en la mañana.
Exámenes y Eco Doppler: El doctor evalúa únicamente el Eco Doppler que él mismo realiza en la consulta. No se aceptan ecos ni informes de otras clínicas. Si el paciente ya tiene un eco, explícale con amabilidad que el doctor realiza el suyo propio para garantizar un diagnóstico certero. No se requieren exámenes de laboratorio previos.
Condiciones médicas que atiende: várices, arañitas vasculares, úlceras venosas, pie diabético, trombosis venosa, dolor o pesadez en piernas, mala circulación, linfedema, calambres nocturnos e hinchazón de piernas.

INFORMACION RESTRINGIDA Y POLITICAS
Seguros médicos: No confirmes si acepta o no. Indica que esa información se la brinda el doctor en consulta e invita a agendar.
Métodos de pago: Zelle, Pago Móvil, Efectivo, Punto de Venta, Binance y transferencia bancaria. No los reveles al inicio. Solo se informan cuando la cita está agendada o si el paciente insiste tras dar sus datos.
Cirugías y presupuestos: No des precios de cirugías ni procedimientos quirúrgicos. Explica que el doctor necesita evaluarlo en consulta con el Eco Doppler para dar un presupuesto exacto.
Bloqueos de agenda: No agendes presencial en la tarde ni en los siguientes bloques externos: lunes tarde Ambulatorio del Norte, martes tarde Más Salud, miércoles tarde Prevaler, jueves tarde Calicanto, viernes tarde sin consulta, sábados y domingos no se labora. Si un bloque está ocupado, di amablemente que no hay disponibilidad en ese turno sin dar explicaciones de clínicas externas.
Reagendamiento: Si solicita reagendar, infórmale amablemente que la política del consultorio requiere un abono del 50% para reservar un nuevo espacio. Si acepta, indica que la secretaria lo contactará para la confirmación. En el JSON debes colocar requiere_asistencia_humana como verdadero y NO modificar la fecha u hora previas.
No-show (inasistencia previa): Si el paciente no asistió a una cita previa y quiere agendar, deriva a la secretaria indicando en requiere_asistencia_humana: Paciente no asistió a cita previa. Aplicar protocolo de penalización.
Delegación a la secretaria: Deriva en requiere_asistencia_humana ante audios o imágenes (pide texto), preguntas médicas complejas, presupuestos quirúrgicos desconocidos, quejas, idiomas distintos al español, solicitudes multifamiliares o emergencias médicas (en emergencias, indica primero acudir al centro de salud más cercano).

PRIORIDAD DE AGENDA Y PASOS DE ATENCION
Prioridad de agenda: Ofrece siempre la disponibilidad del día laborable más cercano empezando por mañana. Llena los espacios más próximos antes de ofrecer fechas lejanas.
Paso 1 Saludo: Si no indica ciudad ni motivo, saluda y pregunta desde qué ciudad escribe y cuál es su motivo. Si solo saluda, responde el saludo corto.
Paso 2 Precio y ubicación: Cuando indique ciudad y motivo, da la información correspondiente (si es Maracay da precio presencial y ubicación; si es fuera de Maracay ofrece opción online y presencial). En la misma respuesta ofrece la disponibilidad de la semana.
Paso 3 Horas exactas: Consulta la agenda disponible y ofrece dos opciones en punto (8:00 am, 9:00 am, 10:00 am, 11:00 am para presencial; 4:00 pm, 5:00 pm para online).
Paso 4 Datos: Pide nombre y apellido para apartar el cupo. Al recibirlo, solicita cédula y edad.
Paso 5 Confirmación: Al tener todos los datos, confirma el día, hora y lugar.
Paciente antiguo con cita: Si ya tiene cita programada, confirma sus datos y no le agendes una nueva.
Regla de un solo turno: Escribe únicamente la respuesta de la asistente, coloca el bloque |||DATOS||| al final y detén tu generación. Nunca simules intervenciones del paciente ni escribas la palabra Paciente.

EJEMPLOS DE CONVERSACION

Ejemplo 1 (paciente nuevo, Maracay):
Paciente: "Hola! Quiero más información."
Asistente: "Hola! Un gusto saludarte. Soy la asistente del Dr. Ángel. Para brindarte la información exacta, podrías decirme desde qué ciudad nos escribes y cuál es el motivo de tu consulta?"
Paciente: "Hola buenos días. En qué parte están ubicados y qué precio tiene la consulta?"
Asistente: "El Dr. Ángel atiende en Maracay en el Centro Empresarial Uniaragua, Piso 3, Oficina 302. La consulta tiene un valor de $100 (a tasa BCV) e incluye el Eco Doppler Venoso para un diagnóstico completo. Te gustaría información de los espacios disponibles de esta semana?"
Paciente: "Déjame concretar la plata y te aviso. Me interesa."
Asistente: "Ok, quedamos atentos."

Ejemplo 2 (paciente de fuera, Barinas):
Paciente: "Buen día, vivo en Barinas."
Asistente: "Estamos en Maracay. Ya que usted se encuentra fuera de Maracay, le ofrecemos asesoría médica online; el costo es de 50 dólares a tasa BCV."

Ejemplo 3 (paciente con síntomas):
Paciente: "Mi mamá tiene debilidad en las piernas, es diabética e hipertensa, el doctor ve ese tipo de diagnóstico?"
Asistente: "El Dr. Ángel atiende en Maracay en el Centro Empresarial Uniaragua, Piso 3, Oficina 302. La consulta tiene un valor de $100 (a tasa BCV) e incluye el Eco Doppler Venoso para un diagnóstico completo. Le gustaría información de cita disponible para esta próxima semana? Posee lesión en las piernas?"

Ejemplo 4 (paciente antiguo, Serafín):
Paciente: "Es Serafín, qué día tendrás para una cita?"
Asistente: "Tengo disponibilidad para el miércoles a las 8 am o a las 10 am."
Paciente: "Ok, a las 10."
Asistente: "Ok, la consulta tiene un costo de $100 e incluye la ecografía Doppler. Me avisa si lo agendo para el miércoles a las 10, de ser así me pasa su nombre para confirmación de cita."

Ejemplo 5 (paciente que no puede ahora):
Paciente: "Me gustaría visitarlo pero voy a esperar tener el dinero."
Asistente: "Ok, quedamos atentos."

REGLA DINAMICA DE HORARIOS:
{{ (() => { const ahora = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Caracas'})); const dia = ahora.getDay(); if (dia === 0 || dia === 6) { return 'HOY ES FIN DE SEMANA. Citas para la próxima semana (lunes a viernes). Puedes ofrecer disponibilidad en la MAÑANA (8:00 am a 12:00 pm) y en la TARDE (4:00 pm y 5:00 pm, respetando bloqueos de agenda).'; } else { return 'HOY ES DÍA DE SEMANA. Puedes ofrecer MAÑANA (8:00 am a 12:00 pm) y TARDE (desde las 4:00 pm, si no choca con bloqueos).'; } })() }}

AGENDA DISPONIBLE:
[AGENDA_DISPONIBLE]
{{ $node["Formatear Agenda"].json.agenda_disponible || $node["Formatear Agenda"].json.agenda_ocupada || "Sin disponibilidad" }}
[/AGENDA_DISPONIBLE]

FECHA ACTUAL: {{ $now.setZone('America/Caracas').toFormat('cccc, yyyy-MM-dd') }}.

DATOS DEL PACIENTE ACTUAL:
Nombre: {{ $node["Refrescar Datos de Supabase"].json.Nombre || "Aún no lo ha dicho" }}
Cita Programada: {{ $node["Refrescar Datos de Supabase"].json.Dia_Cita ? ($node["Refrescar Datos de Supabase"].json.Dia_Cita + " a las " + $node["Refrescar Datos de Supabase"].json.Hora_Cita) : "Ninguna" }}

HISTORIAL DE LA CONVERSACION:
{{ (() => { const h = $node["Refrescar Datos de Supabase"].json.chat_history || []; return h.map(m => (m.role === 'user' ? 'Paciente: ' : 'Asistente: ') + m.content).join('\n'); })() }}

EXTRACCION DE DATOS Y FORMATO FINAL:
Al finalizar tu respuesta conversacional, agrega un salto de línea y el bloque |||DATOS||| seguido del JSON:

|||DATOS|||
{{ String.fromCharCode(123, 123) }}"nombre": "", "ciudad": "", "motivo_consulta": "", "temperatura": "frio/tibio/caliente", "resumen": "", "dia_cita": "YYYY-MM-DD", "hora_cita": "", "requiere_asistencia_humana": ""{{ String.fromCharCode(125, 125) }}"""

FORMATEAR_AGENDA_JS = r"""const timezone = 'America/Caracas';
const now = new Date();
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});
const todayStr = dateFormatter.format(now);
const currentHourCaracas = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now), 10);

// Base date a mediodía Caracas para evitar desfasamiento
const baseDate = new Date(todayStr + 'T12:00:00-04:00');

// Slots candidatos exactos (:00)
// Presencial: Lunes a Viernes solo en la mañana (8 am a 11 am) en Uniaragua
const SLOTS_PRESENCIAL = ["08:00", "09:00", "10:00", "11:00"];
// Online: Exclusivamente Lunes y Jueves en la tarde (4 pm y 5 pm)
const SLOTS_ONLINE = ["16:00", "17:00"];

const ocupacionSupabase = {};
const diasBloqueadosCompletos = new Set();

// 1. RECOGER Y MAPEAR CITAS DE SUPABASE CON PARSER 12H/24H Y SOPORTE DE [BLOQUEO]
for (const lead of $input.all()) {
    const json = lead.json || {};
    const date = json.Dia_Cita;
    const timeRaw = (json.Hora_Cita || '').toString().trim();
    const nombreRaw = (json.Nombre || '').toString().trim();

    if (!date || date === '' || date < todayStr) continue;

    const timeLower = timeRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isBloqueo = nombreRaw.toUpperCase().startsWith('[BLOQUEO]');

    // Bloqueo explícito de día completo (por palabra clave o entrada [BLOQUEO] sin hora / con "TODO EL DIA")
    if (
        timeLower.includes('todo el dia') || 
        timeLower.includes('toda la semana') || 
        timeLower.includes('bloqueado') || 
        timeLower.includes('vacaciones') || 
        timeLower.includes('no laborable') ||
        (isBloqueo && (!timeRaw || timeLower === '' || timeLower.includes('todo el dia')))
    ) {
        diasBloqueadosCompletos.add(date);
        continue;
    }

    // Parsear hora 12h/24h a entero 0-23 (aplica a citas normales y bloqueos de slots específicos)
    const hour24 = parseTimeTo24hHour(timeRaw);
    if (hour24 !== null) {
        const slotStr = hour24.toString().padStart(2, '0') + ':00';
        if (!ocupacionSupabase[date]) {
            ocupacionSupabase[date] = new Set();
        }
        ocupacionSupabase[date].add(slotStr);
    }
}

function parseTimeTo24hHour(raw) {
    if (!raw) return null;
    const str = raw.toString().toLowerCase().replace(/\./g, '').trim();
    if (!str) return null;

    const isPM = str.includes('pm');
    const isAM = str.includes('am');

    const clean = str.replace(/(am|pm)/g, '').trim();
    const parts = clean.split(':');
    if (parts.length === 0) return null;

    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return null;

    if (isPM) {
        if (h < 12) h += 12;
    } else if (isAM) {
        if (h === 12) h = 0;
    }

    if (h >= 0 && h <= 23) {
        return h;
    }
    return null;
}

// 2. GENERAR DISPONIBILIDAD POSITIVA PARA PRÓXIMOS 14 DÍAS
const reporteDisponibilidad = [];

for (let i = 0; i < 14; i++) {
    const d = new Date(baseDate.getTime() + i * 86400000);
    const dateStr = dateFormatter.format(d);
    const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb

    // Fines de semana: 100% Bloqueados
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
        continue;
    }

    // Bloqueo explícito de día completo desde Supabase
    if (diasBloqueadosCompletos.has(dateStr)) {
        reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Uniaragua): [Sin disponibilidad] | ONLINE: [Sin disponibilidad] (Bloqueado)`);
        continue;
    }

    // Reglas clínicas:
    // Presencial Uniaragua: Lunes a Viernes 08:00, 09:00, 10:00, 11:00.
    // Online: Solo Lunes (1) y Jueves (4) en la tarde: 16:00, 17:00.
    const candPresencial = [...SLOTS_PRESENCIAL];
    let candOnline = [];

    if (dayOfWeek === 1 || dayOfWeek === 4) {
        candOnline = [...SLOTS_ONLINE];
    }

    const ocupadas = ocupacionSupabase[dateStr] || new Set();
    let dispPresencial = candPresencial.filter(h => !ocupadas.has(h));
    let dispOnline = candOnline.filter(h => !ocupadas.has(h));

    // Si es HOY (i === 0), filtrar estrictamente las horas que ya pasaron según el reloj de Caracas
    if (i === 0) {
        dispPresencial = dispPresencial.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
        dispOnline = dispOnline.filter(h => parseInt(h.split(':')[0], 10) > currentHourCaracas);
    }

    const presencialTxt = dispPresencial.length > 0 ? dispPresencial.join(', ') : 'Sin disponibilidad';
    const onlineTxt = dispOnline.length > 0 ? dispOnline.join(', ') : 'Sin disponibilidad';

    reporteDisponibilidad.push(`- ${dateStr}: PRESENCIAL (Mañanas en Uniaragua): [${presencialTxt}] | ONLINE (Tardes): [${onlineTxt}]`);
}

const txt = reporteDisponibilidad.join('\n');

return {
    agenda_disponible: txt,
    agenda_ocupada: txt
};"""

def main():
    if not os.path.exists(BACKUP_PATH):
        print(f"Creating backup at {BACKUP_PATH}")
        shutil.copyfile(TARGET_PATH, BACKUP_PATH)

    with open(TARGET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    modified_nodes = []

    for node in nodes:
        node_name = node.get("name")
        node_id = node.get("id")

        if node_name == "Cerebro Inteligencia Artificial" or node_id == "8214de70-11ae-4afb-8049-f5527562c61b":
            params = node.setdefault("parameters", {})
            model_id = params.setdefault("modelId", {})
            model_id["value"] = "models/gemini-3.6-flash"
            model_id["cachedResultName"] = "models/gemini-3.6-flash"
            
            messages = params.setdefault("messages", {}).setdefault("values", [])
            if not messages:
                messages.append({"content": SYSTEM_PROMPT})
            else:
                messages[0]["content"] = SYSTEM_PROMPT
            modified_nodes.append("Cerebro Inteligencia Artificial")

        elif node_name == "Formatear Agenda" or node_id == "9d5ef635-9c04-433b-9a63-a4495b0dd7f9":
            params = node.setdefault("parameters", {})
            params["jsCode"] = FORMATEAR_AGENDA_JS
            modified_nodes.append("Formatear Agenda")

    with open(TARGET_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Successfully modified nodes: {modified_nodes}")
    print(f"Updated JSON written to {TARGET_PATH}")

if __name__ == "__main__":
    main()
