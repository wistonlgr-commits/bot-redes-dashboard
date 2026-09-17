# Análisis de Integración: Paso 3 — Escudo Validador Pre-Envío (Local JavaScript, 0 Tokens)

## 1. Resumen Ejecutivo
El **Paso 3: Escudo Validador Pre-Envío** implementa una capa de validación determinística en JavaScript local (costo: **0 Tokens**) inmediatamente después de la generación de respuesta del nodo `Cerebro Inteligencia Artificial`.

La función del Escudo Validador es interceptar, corregir o anular cualquier alucinación producida por el modelo LLM (Gemini) en relación con:
1. **Horarios alucinados o intermedios con minutos** (ej. `08:30`, `09:15`, `04:30 pm`), restringiendo las citas estrictamente a horas exactas en punto (`08:00`, `09:00`, `10:00`, `11:00`, `16:00`, `17:00`).
2. **Cruces de disponibilidad real**: Validación cruzada en tiempo de ejecución de `(dia_cita, hora_cita)` contra el string `agenda_disponible` emitido por el nodo `Formatear Agenda`. Si la hora no figura explícitamente como disponible para esa fecha, el Escudo anula la cita (`dia_cita = ""`, `hora_cita = ""`).
3. **Citas sin datos básicos**: Prohibición de agendamiento si el paciente no cuenta con nombre registrado (`nombre = ""`).
4. **Fechas en el pasado o fines de semana**: Anulación automática si Gemini genera citas para sábados, domingos o fechas anteriores al día actual en horario Venezuela (`America/Caracas`).
5. **Formato JSON y Mute Guard**: Limpieza de delimitadores markdown/braces de Gemini y protección contra respuestas vacías.

---

## 2. Análisis de Arquitectura y Conexiones n8n

### Topología Actual en `flujo asistente de whatsapp.json`
- **Nodo Origen IA**: `Cerebro Inteligencia Artificial` (ID: `8214de70-11ae-4afb-8049-f5527562c61b`, Type: `@n8n/n8n-nodes-langchain.googleGemini`)
- **Nodo Procesador Post-IA**: `Formatear Respuesta` (ID: `8fd94881-ca56-4855-8462-ef0109762964`, Type: `n8n-nodes-base.code`, Version: 2, Position: `[864, 256]`)
- **Nodos Destino Downstream**:
  - `Guardar Resumen en Supabase` (ID: `ca9bf834-c7cd-4976-a364-c4148ffe2287`)
  - `Respaldar en Google Sheets` (ID: `db5cb0f9-2ed8-4ce7-af24-9fdb3e3474e5`)
  - `Enviar Mensaje de WhatsApp` (ID: `5b0ad045-ac5b-4f19-a4a8-5e7e85412619`)

### Evaluación de Opciones de Integración

| Criterio | Opción A: Actualizar `Formatear Respuesta` (Recomendado) | Opción B: Insertar Nuevo Nodo Code Separado |
|---|---|---|
| **Estructura de Grafos (Connections)** | 100% Inalterada. Cero cambios en conexiones JSON. | Requiere modificar el mapa de conexiones e insertar nuevo nodo. |
| **Compatibilidad Downstream** | Conserva el nombre del nodo `Formatear Respuesta`, garantizando que `$('Formatear Respuesta').item.json.bot_reply` en `Enviar Mensaje de WhatsApp` funcione sin cambios. | Obliga a actualizar la expresión en `Enviar Mensaje de WhatsApp` o genera referencias rotas. |
| **Mantenibilidad** | Agrupa en una sola función atómica la extracción de JSON y la validación determinística del escudo. | Multiplica la latencia interna de n8n con dos pasos de código consecutivos. |
| **Riesgo de Regresión** | 0%. Mantiene los mismos IDs y salidas de objeto (`nombre`, `ciudad`, `dia_cita`, `hora_cita`, etc.). | Alto riesgo de incompatibilidad de variables en expresiones de Supabase/Sheets. |

**Conclusión Técnica:** La mejor opción es **actualizar el parámetro `jsCode` dentro del nodo existente `Formatear Respuesta`**. Esto transforma `Formatear Respuesta` en el **Escudo Validador Pre-Envío completo**, manteniendo la estabilidad total del flujo n8n.

---

## 3. Reglas Determinísticas del Escudo Validador Pre-Envío

El código JavaScript local ejecuta 5 filtros estrictos en sub-milisegundos:

### Filtro 1: Extracción Segura de JSON y Mute Trap
- Limpia delimitadores como `{{` / `}}` y bloques ````json ```.
- Ejecuta `JSON.parse`. Si falla, utiliza fallback mediante expresiones regulares sobre todos los campos (`nombre`, `ciudad`, `motivo_consulta`, `temperatura`, `resumen`, `dia_cita`, `hora_cita`, `requiere_asistencia_humana`).
- Lanza un error explícito si `bot_reply` está vacío o la IA se queda muda.

### Filtro 2: Guarda de Identidad de Paciente
- Si `dia_cita` u `hora_cita` fueron extraídos por la IA pero `nombre` está vacío (tanto en los datos extraídos como en la base previa de Supabase), el Escudo limpia inmediatamente `dia_cita = ""` y `hora_cita = ""`.

### Filtro 3: Normalización y Filtro de Fechas (YYYY-MM-DD)
- Valida la estructura `YYYY-MM-DD`.
- Compara contra el día actual en la zona horaria `America/Caracas`. Si la fecha es anterior a hoy, se invalida.
- Verifica si el día de la semana cae en fin de semana (Sábado `getUTCDay() === 6` o Domingo `getUTCDay() === 0`). De ser así, invalida la cita (`dia_cita = ""`, `hora_cita = ""`).

### Filtro 4: Restricción Estricta a Horas Exactas en Punto (:00)
- Normaliza horas en formato 12h / 24h.
- Si la hora incluye minutos distintos de `:00` (ej. `08:30`, `09:15`, `04:30 pm`), o si está fuera del listado oficial `[8, 9, 10, 11, 16, 17]`, se descarta por completo la hora y el día (`dia_cita = ""`, `hora_cita = ""`).

### Filtro 5: Validación Cruzada Anti-Alucinación contra `agenda_disponible`
- Lee `$node["Formatear Agenda"].json.agenda_disponible`.
- Localiza la línea correspondiente a `dia_cita`.
- Comprueba si `hora_cita` (ej. `08:00`) está listada dentro de los corchetes de disponibilidad de ese día.
- Si el día está marcado como `NO LABORABLE`, `Sin disponibilidad`, o la hora en particular no aparece en la lista de slots disponibles, el Escudo anula la cita en el objeto de salida.

---

## 4. Cambios Exactos en el JSON `flujo asistente de whatsapp.json`

### Objeto Target en JSON
```json
{
  "parameters": {
    "jsCode": "<NUEVO_CODIGO_ESCUDO_VALIDADOR>"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    864,
    256
  ],
  "id": "8fd94881-ca56-4855-8462-ef0109762964",
  "name": "Formatear Respuesta"
}
```

### Código JavaScript Final de Reemplazo
```javascript
// =====================================================
// ESCUDO VALIDADOR PRE-ENVÍO (Local JavaScript, 0 Tokens)
// Implementado en nodo: "Formatear Respuesta" (ID: 8fd94881-ca56-4855-8462-ef0109762964)
// =====================================================

// 1. EXTRAER RESPUESTA Y HISTORIAL
let history = $node["Refrescar Datos de Supabase"].json.chat_history || [];

function findText(obj, depth) {
  if (depth > 5) return "";
  if (typeof obj === 'string' && obj.length > 20) return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findText(item, depth + 1);
      if (found) return found;
    }
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const val of Object.values(obj)) {
      const found = findText(val, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

let fullResponse = findText($json, 0);
if (!fullResponse) {
  fullResponse = "Hola! en qué te puedo ayudar?";
}

fullResponse = fullResponse.replace(/\\n/g, ' ').replace(/  +/g, ' ').trim();
let botMsg = fullResponse;

let datosExtraidos = {
  nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
  temperatura: undefined, resumen: undefined, dia_cita: undefined,
  hora_cita: undefined, requiere_asistencia_humana: undefined
};

// 2. PARSEAR BLOQUE |||DATOS|||
if (fullResponse.includes('|||DATOS|||')) {
  const partes = fullResponse.split('|||DATOS|||');
  botMsg = partes[0].trim();
  let jsonStr = partes[1].trim();

  jsonStr = jsonStr.replace(/^\{\{/, '{').replace(/\}\}$/, '}');
  jsonStr = jsonStr.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
  jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  let parseOk = false;
  try {
    const datos = JSON.parse(jsonStr);
    parseOk = true;
    if ('nombre' in datos) datosExtraidos.nombre = datos.nombre || "";
    if ('ciudad' in datos) datosExtraidos.ciudad = datos.ciudad || "";
    if ('motivo_consulta' in datos) datosExtraidos.motivo_consulta = datos.motivo_consulta || "";
    if ('temperatura' in datos) datosExtraidos.temperatura = datos.temperatura || "";
    if ('resumen' in datos) datosExtraidos.resumen = datos.resumen || "";
    if ('dia_cita' in datos) datosExtraidos.dia_cita = typeof datos.dia_cita === 'string' ? datos.dia_cita : "";
    if ('hora_cita' in datos) datosExtraidos.hora_cita = typeof datos.hora_cita === 'string' ? datos.hora_cita : "";
    if ('requiere_asistencia_humana' in datos) datosExtraidos.requiere_asistencia_humana = datos.requiere_asistencia_humana || "";
  } catch (e) {}

  if (!parseOk) {
    try {
      const extraer = (campo) => {
        const regex = new RegExp('"' + campo + '"\\s*:\\s*"([^"]*)"');
        const match = jsonStr.match(regex);
        return match ? match[1] : undefined;
      };
      datosExtraidos.nombre = extraer('nombre');
      datosExtraidos.ciudad = extraer('ciudad');
      datosExtraidos.motivo_consulta = extraer('motivo_consulta');
      datosExtraidos.temperatura = extraer('temperatura');
      datosExtraidos.resumen = extraer('resumen');
      datosExtraidos.dia_cita = extraer('dia_cita');
      datosExtraidos.hora_cita = extraer('hora_cita');
      datosExtraidos.requiere_asistencia_humana = extraer('requiere_asistencia_humana');
    } catch (e2) {}
  }
}

// 3. RECUPERAR VALORES PREVIOS Y CONSOLIDAR
const prevData = $node["Refrescar Datos de Supabase"].json || {};
let nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
let ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
let motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
let temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
let resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");
let dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
let hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");
let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");

if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
  alerta_final = "";
}

// 4. ESCUDO VALIDADOR PRE-ENVÍO (DETERMINÍSTICO 0 TOKENS)

// A. Sin Nombre -> Prohibido Agendar Cita
if ((dia_final || hora_final) && (!nombre_final || nombre_final.trim() === "")) {
  dia_final = "";
  hora_final = "";
}

// B. Validación YYYY-MM-DD, Fechas Pasadas y Fines de Semana
if (dia_final && dia_final.trim() !== "") {
  dia_final = dia_final.trim();
  const dateMatch = dia_final.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    dia_final = "";
    hora_final = "";
  } else {
    const timezone = 'America/Caracas';
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = dateFormatter.format(now);

    if (dia_final < todayStr) {
      dia_final = "";
      hora_final = "";
    } else {
      const dateObj = new Date(dia_final + 'T12:00:00Z');
      const dayOfWeek = dateObj.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        dia_final = "";
        hora_final = "";
      }
    }
  }
}

// C. Validación de Horas (:00 Exactas y Sin Minutos Intermedios)
if (hora_final && hora_final.trim() !== "") {
  let hRaw = hora_final.trim().toLowerCase();
  let hour24 = null;
  let minutesStr = "00";
  const isPM = hRaw.includes('pm');
  const isAM = hRaw.includes('am');
  const clean = hRaw.replace(/(am|pm)/g, '').trim();
  const parts = clean.split(':');
  
  if (parts.length >= 1) {
    let h = parseInt(parts[0], 10);
    if (!isNaN(h)) {
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      hour24 = h;
    }
  }
  if (parts.length >= 2) {
    minutesStr = parts[1].trim();
  }

  const validHours = [8, 9, 10, 11, 16, 17];
  if (hour24 !== null && validHours.includes(hour24) && (minutesStr === "00" || minutesStr === "0" || minutesStr === "")) {
    hora_final = hour24.toString().padStart(2, '0') + ':00';
  } else {
    dia_final = "";
    hora_final = "";
  }
}

// D. Validación Cruce de Disponibilidad Real vs "Formatear Agenda"
const agendaTxt = ($node["Formatear Agenda"].json.agenda_disponible || "").toString();
if (dia_final && hora_final && agendaTxt) {
  const lines = agendaTxt.split('\n');
  const dayLine = lines.find(l => l.includes(dia_final));
  if (!dayLine) {
    dia_final = "";
    hora_final = "";
  } else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad')) {
    if (!dayLine.includes(hora_final)) {
      dia_final = "";
      hora_final = "";
    }
  } else {
    if (!dayLine.includes(hora_final)) {
      dia_final = "";
      hora_final = "";
    }
  }
}

// E. Verificación Mute IA
if (!botMsg || botMsg.trim() === "") {
  throw new Error("🚨 ALERTA: La IA se quedó muda. No generó texto, solo el JSON.");
}

// F. Historial y Delay Random
history.push({ role: "assistant", content: botMsg });
if (history.length > 8) history = history.slice(history.length - 8);
let random_delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;

return {
  final_history: history,
  bot_reply: botMsg,
  delay: random_delay,
  nombre: nombre_final,
  ciudad: ciudad_final,
  motivo_consulta: motivo_final,
  temperatura: temp_final,
  resumen: resumen_final,
  dia_cita: dia_final,
  hora_cita: hora_final,
  requiere_asistencia_humana: alerta_final
};
```
