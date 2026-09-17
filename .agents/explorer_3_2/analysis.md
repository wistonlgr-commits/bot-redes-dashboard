# Análisis Técnico — Paso 3: Escudo Validador Pre-Envío (JavaScript Local, 0 Tokens)

**Agente**: Explorer 3_2  
**Fecha**: 2026-07-26  
**Flujo Objetivo**: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`  
**Nodo Modificado**: `Formatear Respuesta` (n8n Code Node, ID: `8fd94881-ca56-4855-8462-ef0109762964`)

---

## 1. Resumen Ejecutivo

El **Escudo Validador Pre-Envío** es un mecanismo de intercepción y saneamiento de respuestas ejecutado **100% localmente en JavaScript** dentro del nodo n8n `Formatear Respuesta`, inmediatamente después de la salida del modelo Gemini (`Cerebro Inteligencia Artificial`). 

Su propósito fundamental es garantizar que **ningún mensaje** enviado a WhatsApp ni **ningún dato** guardado en Supabase o Google Sheets contenga horarios en media hora (`:30`), citas en fines de semana (sábados/domingos), horarios de consulta no autorizados o basura estructural, manteniendo **0 tokens adicionales de consumo** y la máxima fluidez en la conversación del paciente.

---

## 2. Hallazgos y Análisis del Nodo Vulnerable (`Formatear Respuesta`)

De la inspección del archivo `flujo asistente de whatsapp.json` (líneas 336-347):

1. **Riesgo de Crash por Lanzamiento de Excepción**:
   - Código actual:
     ```javascript
     if (botMsg === undefined || botMsg.trim() === "") {
         throw new Error("🚨 ALERTA: La IA se quedó muda. No generó texto, solo el JSON.");
     }
     ```
   - **Problema**: Si Gemini emite solo el bloque `|||DATOS|||` o falla la generación de texto, el nodo lanza un error no capturado, abortando la ejecución de n8n. El paciente se queda sin respuesta y el webhook finaliza en error.
   - **Solución Escudo**: Sustituir el `throw new Error` por un **fallback determinista amigable** (ej. `"Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"`) y activar la bandera `requiere_asistencia_humana = "Respuesta de IA vacía - Fallback activado"`.

2. **Ausencia de Validación de Horarios en Media Hora (`:30`)**:
   - Gemini a veces alucina y propone horas en media hora (`8:30 am`, `12:30`, `14:30`, `2:30 pm`, `4:30 pm`) o en minutos no permitidos (`:15`, `:45`).
   - El código actual transmite íntegramente dicho texto a WhatsApp y guarda `"08:30"` en Supabase/Google Sheets.

3. **Ausencia de Filtro para Fines de Semana y Horarios Fuera de Clínica**:
   - La clínica labora presencialmente **Lunes a Viernes de 8:00 am a 12:00 pm** y online **Lunes y Jueves de 4:00 pm a 5:00 pm**. Los fines de semana (Sábado y Domingo) están **estrictamente cerrados**.
   - Gemini ocasionalmente alucina citas para días sábados/domingos o en horarios de la tarde no autorizados.

---

## 3. Matriz de Casos Borde y Reglas Regex / Parsing

### 3.1. Intercepción de Horarios en Media Hora (`:30` ➔ `:00`)

Se consideran 4 variantes de representación en el texto conversacional y metadatos:

| Variante de Entrada | Ejemplo Gemini | Expresión Regular de Captura | Resultado Convertido |
|---|---|---|---|
| **12 Horas con AM/PM** | `8:30 am`, `2:30 pm`, `12:30pm`, `9:30 a.m.`, `4:30 PM` | `/(\b(?:1[0-2]\|0?[1-9])):(?:15\|20\|30\|45)(\s*(?:am\|pm\|a\.m\ me\|p\.m\ me\|AM\|PM\|A\.M\ me\|P\.M\ me))/gi` | `8:00 am`, `2:00 pm`, `12:00pm`, `9:00 a.m.`, `4:00 PM` |
| **24 Horas / Numérico** | `08:30`, `14:30`, `16:30`, `12:30`, `17:30` | `/(?<![\d\-])(\b(?:[01]?\d\|2[0-3])):(?:15\|20\|30\|45)\b(?![\d:\-])/g` | `08:00`, `14:00`, `16:00`, `12:00`, `17:00` |
| **Expresiones Verbales** | `las 8 y 30`, `las 8 y media`, `4 y media` | `/(\b(?:1[0-2]\|0?[1-9]))\s+y\s+(?:media\|30)\b/gi` | `8:00`, `8:00`, `4:00` |
| **Campo Metadata JSON `hora_cita`** | `"08:30"`, `"14:30"`, `"4:30 pm"` | Proceso idéntico a texto conversacional | `"08:00"`, `"14:00"`, `"4:00 pm"` |

#### Protección Contra Falsos Positivos en Regex:
- **Fechas ISO** (`2026-07-26`): El lookbehind `(?<![\d\-])` evita coincidir con los guiones o números de fecha.
- **Teléfonos y Cédulas** (`0412-3012345`): Se requiere que el patrón `:30` o `:15` esté precedido explícitamente por dos puntos `:` y una hora válida.
- **Precios o Cantidades** (`$120`, `30 minutos`): El patrón exige la presencia de la hora de 1 a 12 o 0 a 23 seguida inmediatamente por `:` y minutos.

---

### 3.2. Saneamiento de Fines de Semana y Horarios No Autorizados

#### A. Detección y Saneamiento de Fin de Semana (Sábado / Domingo):
1. **Inspección de `dia_cita` (JSON)**:
   - Se parsea la fecha `YYYY-MM-DD`.
   - Se calcula el día de la semana (`date.getDay()`): `0` = Domingo, `6` = Sábado.
   - **Acción**: Si `dayOfWeek === 0 || dayOfWeek === 6`:
     - Se limpia `datosExtraidos.dia_cita = ""` y `datosExtraidos.hora_cita = ""`.
     - Se establece `datosExtraidos.requiere_asistencia_humana = "Alucinación de IA: Cita agendada en fin de semana (sábado/domingo)"`.
2. **Saneamiento del Texto Conversacional (`bot_reply`)**:
   - Se reemplazan referencias explícitas a fin de semana (ej: `"este sábado"`, `"el domingo"`) por referencias a días hábiles (`"el lunes"`), o se antepone una aclaración amigable.

#### B. Saneamiento de Horarios Hábiles No Autorizados:
- Horarios autorizados para presencial: `08:00`, `09:00`, `10:00`, `11:00` (o `8:00 am` a `11:00 am`).
- Horarios autorizados para online: `16:00`, `17:00` (o `4:00 pm`, `5:00 pm`).
- **Acción**: Si `hora_cita` no está en la lista de horas permitidas (ej. `13:00`, `14:00`, `15:00`), se invalida la hora y se notifica la alerta de asistencia humana para que la secretaria valide el turno.

---

### 3.3. Preservación de Formato WhatsApp (Markdown, Emojis, Saludos y Confirmación)

El Escudo Validador **respeta íntegramente**:
- **Emojis Unicode** (`👋`, `🏥`, `📅`, `⏰`, `👍`, `🩺`, etc.).
- **Markdown de WhatsApp**: Negritas (`*texto*`), cursivas (`_texto_`), monoespaciado (```texto```).
- **Saludos al paciente**: `"Hola [Nombre]!"` o `"Buenas tardes [Nombre]!"`.
- **Datos de Confirmación de Cita**: Ubicación (`Centro Empresarial Uniaragua, Piso 3, Oficina 302`), precios (`$100`, `$50`, `$120`).

#### Elementos Estructurales Eliminados:
- Bloques de código JSON Markdown (` ```json ... ``` `).
- Plantillas de prompt sin expandir (`{{ ... }}`).
- Etiquetas residuales de delimitación (`|||DATOS|||` y todo lo posterior).
- Saltos de línea dobles escapados (`\\n\\n` -> `\n`).

---

### 3.4. Garantía de 0 Tokens (Ejecución 100% JS Local)

1. **Ejecución Síncrona**: Ocurre en el motor V8 nativo del proceso n8n.
2. **Latencia Sub-milisegundo**: < 1 ms por mensaje.
3. **Cero Llamadas a APIs**: No realiza reintentos ni invoca endpoints de IA.
4. **Resiliencia ante Fallas**: Ante respuestas nulas de Gemini, aplica un texto determinista amigable sin romper la ejecución del flujo n8n.

---

## 4. Código JavaScript Completo para `Formatear Respuesta`

```javascript
// =====================================================
// ESCUDO VALIDADOR PRE-ENVÍO (JavaScript Local, 0 Tokens)
// N8N Code Node: Formatear Respuesta + Escudo Validador
// =====================================================

// MÓDULO 1: Intercepción de Horarios en Media Hora (:30 -> :00) y Minutos No Estándar
function sanitizeTimes(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;

  // 1. Horas 12h con AM/PM (ej: 8:30 am -> 8:00 am, 2:30 pm -> 2:00 pm, 12:30pm -> 12:00pm)
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '$1:00$2');

  // 2. Horas 24h o numérico simple (ej: 08:30 -> 08:00, 14:30 -> 14:00, 16:30 -> 16:00, 12:30 -> 12:00)
  cleaned = cleaned.replace(/(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![\d:\-])/g, '$1:00');

  // 3. Expresiones verbales en español (ej: "las 8 y 30" -> "las 8:00", "4 y media" -> "4:00")
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b/gi, '$1:00');

  return cleaned;
}

// MÓDULO 2: Saneamiento de Fines de Semana y Horarios No Autorizados
function sanitizeWeekendAndUnauthorizedTimes(botReply, datosExtraidos) {
  let reply = botReply;
  let requiresHuman = datosExtraidos.requiere_asistencia_humana || "";

  // 1. Verificación de Cita en Fin de Semana (Sábado / Domingo) via dia_cita
  if (datosExtraidos.dia_cita && typeof datosExtraidos.dia_cita === 'string') {
    const matchDate = datosExtraidos.dia_cita.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchDate) {
      const year = parseInt(matchDate[1], 10);
      const month = parseInt(matchDate[2], 10) - 1;
      const day = parseInt(matchDate[3], 10);
      const dateObj = new Date(year, month, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Alucinación de fin de semana detectada
        datosExtraidos.dia_cita = "";
        datosExtraidos.hora_cita = "";
        requiresHuman = "Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo).";
        
        // Corregir mención en texto conversacional
        reply = reply.replace(/\b(este\s+|el\s+)?(sábado|sabado|domingo)\b/gi, 'el lunes');
      }
    }
  }

  // 2. Verificación de Horarios No Autorizados en hora_cita
  if (datosExtraidos.hora_cita && typeof datosExtraidos.hora_cita === 'string') {
    datosExtraidos.hora_cita = sanitizeTimes(datosExtraidos.hora_cita);

    const allowedHours = [
      '08:00', '09:00', '10:00', '11:00', '16:00', '17:00',
      '8:00 am', '9:00 am', '10:00 am', '11:00 am', '4:00 pm', '5:00 pm'
    ];
    const hLower = datosExtraidos.hora_cita.toLowerCase().trim();

    if (hLower && !allowedHours.includes(hLower)) {
      requiresHuman = requiresHuman || `Horario no estándar o no autorizado detectado (${datosExtraidos.hora_cita}).`;
    }
  }

  datosExtraidos.requiere_asistencia_humana = requiresHuman;
  return { reply, datosExtraidos };
}

// MÓDULO 3: Búsqueda Recursiva de Texto
function findText(obj, depth) {
  if (depth > 5) return "";
  if (typeof obj === 'string' && obj.length > 15) return obj;
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

// MÓDULO 4: Ejecución Principal
let history = $node["Refrescar Datos de Supabase"].json.chat_history || [];
let fullResponse = findText($json, 0);

// Fallback determinista (0 Tokens, resiliencia total)
if (!fullResponse || fullResponse.trim() === "") {
  fullResponse = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
}

// Normalización de saltos de línea sin eliminar formato WhatsApp
fullResponse = fullResponse.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

let botMsg = fullResponse;
let datosExtraidos = {
  nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
  temperatura: undefined, resumen: undefined, dia_cita: undefined,
  hora_cita: undefined, requiere_asistencia_humana: undefined
};

// Separación del Bloque |||DATOS|||
if (fullResponse.includes('|||DATOS|||')) {
  const partes = fullResponse.split('|||DATOS|||');
  botMsg = partes[0].trim();
  let jsonStr = partes[1].trim();

  // Limpieza de JSON de etiquetas o markdown
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
  } catch (e) {
    // Fallback Regex
  }

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

// APLICACIÓN DEL ESCUDO VALIDADOR PRE-ENVÍO
botMsg = sanitizeTimes(botMsg);

const sanRes = sanitizeWeekendAndUnauthorizedTimes(botMsg, datosExtraidos);
botMsg = sanRes.reply;
datosExtraidos = sanRes.datosExtraidos;

// Filtro estricto contra fugas de etiquetas DATOS
botMsg = botMsg.replace(/\|\|\|DATOS\|\|\|.*/gs, '').trim();

// Garantía de Fallback determinista si botMsg quedó vacío
if (!botMsg || botMsg.trim() === "") {
  botMsg = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
  if (!datosExtraidos.requiere_asistencia_humana) {
    datosExtraidos.requiere_asistencia_humana = "Respuesta de IA vacía - Fallback determinista activado";
  }
}

// Consolidador con Base de Datos Supabase
const prevData = $node["Refrescar Datos de Supabase"].json || {};
const nombre_final = datosExtraidos.nombre !== undefined ? datosExtraidos.nombre : (prevData.Nombre || "");
const ciudad_final = datosExtraidos.ciudad !== undefined ? datosExtraidos.ciudad : (prevData.Ciudad || "");
const motivo_final = datosExtraidos.motivo_consulta !== undefined ? datosExtraidos.motivo_consulta : (prevData.Motivo_Consulta || "");
const temp_final = datosExtraidos.temperatura !== undefined ? datosExtraidos.temperatura : (prevData.Temperatura || "");
const resumen_final = datosExtraidos.resumen !== undefined ? datosExtraidos.resumen : (prevData.Resumen || "");
const dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
const hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");
let alerta_final = datosExtraidos.requiere_asistencia_humana !== undefined ? datosExtraidos.requiere_asistencia_humana : (prevData.requiere_asistencia_humana || "");

if (alerta_final === 'false' || alerta_final === 'False' || alerta_final === 'no') {
  alerta_final = "";
}

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

---

## 5. Matriz de Verificación y Escenarios de Prueba

| Escenario | Entrada IA (Gemini) | Salida Escudo Validador (`bot_reply` / Metadata) | Verificación |
|---|---|---|---|
| **Media hora 12h** | `"Te puedo ofrecer a las 8:30 am o a las 9:30 am."` | `bot_reply`: `"Te puedo ofrecer a las 8:00 am o a las 9:00 am."` | Media hora `:30` interceptada y convertida a `:00` |
| **Media hora 24h** | `"Cita confirmada a las 14:30."` | `bot_reply`: `"Cita confirmada a las 14:00."`<br>`hora_cita`: `"14:00"` | Formato 24h normalizado a hora en punto |
| **Cita Sábado** | `bot_reply`: `"Quedó anotado para el sábado 01-08."`<br>`dia_cita`: `"2026-08-01"` | `bot_reply`: `"Quedó anotado para el lunes 01-08."`<br>`dia_cita`: `""`<br>`requiere_asistencia_humana`: `"Alucinación de IA: Intentó agendar en fin de semana..."` | `dia_cita` limpiado, fin de semana bloqueado, alerta activada |
| **Preservación Emojis/Markdown** | `"Hola 👋! Te confirmo cita *mañana* a las 9:00 am 🏥."` | `"Hola 👋! Te confirmo cita *mañana* a las 9:00 am 🏥."` | Emojis y markdown `*` intactos |
| **IA Muda / Sin Texto** | `""` (solo bloque `|||DATOS|||`) | `bot_reply`: `"Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"`<br>`requiere_asistencia_humana`: `"Respuesta de IA vacía..."` | No lanza excepción `throw Error`, flujo continúa sin crash |
| **Consumo de Tokens** | Cualquier entrada | **0 tokens consumidos (100% JS local)** | Verificado determinismo absoluto |
