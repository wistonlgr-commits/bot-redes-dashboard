# Análisis del Escudo Validador Pre-Envío (Paso 3)

**Fecha**: 2026-07-26  
**Agente**: Explorer 3_1  
**Flujo Objetivo**: `flujo asistente de whatsapp.json`  

---

## 1. Identificación de Nodos Posteriores a "Cerebro Inteligencia Artificial"

Tras examinar el archivo `flujo asistente de whatsapp.json`, la secuencia de nodos posterior al nodo Gemini (`Cerebro Inteligencia Artificial`, ID `8214de70-11ae-4afb-8049-f5527562c61b`) es la siguiente:

```
[Cerebro Inteligencia Artificial]
               │
               ▼
      [Formatear Respuesta] (Código JS)
               │
       ┌───────┴────────┐
       ▼                ▼
[Respaldar en    [Guardar Resumen
Google Sheets]    en Supabase]
                        │
                        ▼
               [Enviar Mensaje
                 de WhatsApp]
```

### Detalle de Nodos:

1. **`Cerebro Inteligencia Artificial`** (Tipo: `@n8n/n8n-nodes-langchain.googleGemini`, ID: `8214de70-11ae-4afb-8049-f5527562c61b`):
   - **Entrada**: Viene del nodo `Mostrar "Escribiendo..."`.
   - **Salida**: Genera una cadena JSON en el campo `$json.content` que contiene el mensaje conversacional al usuario seguido de `|||DATOS|||` y un bloque JSON con los metadatos de la cita/paciente.

2. **`Formatear Respuesta`** (Tipo: `n8n-nodes-base.code`, ID: `8fd94881-ca56-4855-8462-ef0109762964`):
   - **Posición**: `[864, 256]`.
   - **Función actual**: Extrae el texto conversacional (`botMsg`), parsea el bloque `|||DATOS|||` (`jsonStr`), fusiona los datos con la base de datos previa (`Refrescar Datos de Supabase`), actualiza el historial de conversación (`final_history`) y calcula un retraso aleatorio (`delay`).

3. **`Respaldar en Google Sheets`** (Tipo: `n8n-nodes-base.googleSheets`, ID: `db5cb0f9-2ed8-4ce7-af24-9fdb3e3474e5`):
   - **Posición**: `[1056, 208]`.
   - **Entrada**: Conectado directamente a la salida de `Formatear Respuesta`.
   - **Función**: Registra/actualiza en la hoja de cálculo los campos: `Telefono`, `Nombre`, `Ciudad`, `Motivo_Consulta`, `Temperatura`, `Ultima_Interaccion`, `Resumen`, `Dia_Cita`, `Hora_Cita`.

4. **`Guardar Resumen en Supabase`** (Tipo: `n8n-nodes-base.supabase`, ID: `ca9bf834-c7cd-4976-a364-c4148ffe2287`):
   - **Posición**: `[1056, 416]`.
   - **Entrada**: Conectado a la salida de `Formatear Respuesta`.
   - **Función**: Actualiza la tabla `leads` con `chat_history`, `Nombre`, `Ciudad`, `Motivo_Consulta`, `Temperatura`, `Resumen`, `Dia_Cita`, `Hora_Cita`, `Ultima_Interaccion`, `bot_is_typing` (=false), y `requiere_asistencia_humana`.

5. **`Enviar Mensaje de WhatsApp`** (Tipo: `n8n-nodes-base.httpRequest`, ID: `5b0ad045-ac5b-4f19-a4a8-5e7e85412619`):
   - **Posición**: `[1264, 608]`.
   - **Entrada**: Conectado a la salida de `Guardar Resumen en Supabase`.
   - **Parámetro clave**: `text: =$('Formatear Respuesta').item.json.bot_reply`.
   - **Función**: Realiza una petición POST HTTP a Evolution API (`/message/sendText/BotRedes`) para enviar el texto final al WhatsApp del paciente.

---

## 2. Flujo Completo de Datos y Mensajes de Gemini a WhatsApp

1. **Respuesta Cruda de Gemini**:
   Gemini genera un texto en bruto que combina mensaje libre y bloque de metadatos:
   ```text
   Hola! Claro, te puedo ofrecer cita para el lunes a las 8:30 am o a las 9:30 am, ¿cuál te queda mejor?
   |||DATOS|||
   {"nombre": "", "ciudad": "", "motivo_consulta": "", "temperatura": "frio", "resumen": "Ofreció horarios", "dia_cita": "2026-07-27", "hora_cita": "08:30", "requiere_asistencia_humana": ""}
   ```

2. **Procesamiento en `Formatear Respuesta`**:
   - `findText($json, 0)` busca el texto recursivamente.
   - Separa por el delimitador `|||DATOS|||`.
   - `partes[0]` se convierte en `botMsg`.
   - `partes[1]` se parsea como JSON a `datosExtraidos`.
   - Fusiona `datosExtraidos` con el objeto previo en Supabase (`Refrescar Datos de Supabase`).
   - Retorna un objeto con: `bot_reply`, `final_history`, `nombre`, `ciudad`, `motivo_consulta`, `temperatura`, `resumen`, `dia_cita`, `hora_cita`, `requiere_asistencia_humana`.

3. **Consumo por Nodos Descendentes**:
   - `Respaldar en Google Sheets` guarda `$json.hora_cita` (ej. `"08:30"`).
   - `Guardar Resumen en Supabase` guarda `$json.hora_cita` en la base de datos de citas.
   - `Enviar Mensaje de WhatsApp` toma directamente `$('Formatear Respuesta').item.json.bot_reply` e instruye a Evolution API enviar dicho texto al teléfono del paciente.

---

## 3. Puntos Vulnerables Detectados en el Flujo Actual

1. **Vulnerabilidad de Horarios Ilegales en `:30` (Texto Conversacional)**:
   - A pesar de las instrucciones en el prompt del sistema, Gemini ocasionalmente alucina e incluye horarios en media hora (ej. `8:30 am`, `9:30 am`, `4:30 pm`, `8:30`, `16:30`).
   - **Consecuencia**: El paciente recibe en WhatsApp una propuesta de cita en un horario no permitido por la clínica.

2. **Vulnerabilidad de Horarios Ilegales en JSON (`hora_cita`)**:
   - Si el paciente acepta un horario distorsionado o si la IA emite `"hora_cita": "08:30"`, este valor se registra directamente en Supabase y Google Sheets.
   - **Consecuencia**: Corrupción de la agenda global y solapamiento de citas.

3. **Residuos de Formato y Basura de IA**:
   - Gemini a veces incluye bloques markdown (` ```json `), llaves dobles (`{{ }}`), etiquetas `|||DATOS|||` duplicadas o saltos de línea descontrolados (`\n\n\n`).
   - En casos extremos donde la IA lanza una excepción o se queda muda (`botMsg === ""`), el código actual ejecuta `throw new Error(...)`, lo que detiene el workflow y deja colgado al usuario.

4. **Consumo de Tokens Innecesario en Reintentos**:
   - Resolver estos errores volviendo a llamar a la API de Gemini (reintentos o nodos de corrección con IA) incrementa exponencialmente los costos de tokens y la latencia del webhook.
   - **Solución requerida**: Un escudo de validación **local en JavaScript (0 tokens adicionales)**.

---

## 4. Diseño del Escudo Validador Pre-Envío (Pre-Send Validator Shield)

El Escudo Validador Pre-Envío se integra dentro del nodo de procesamiento JS `Formatear Respuesta` (o como nodo intermedio `Escudo Validador Pre-Envío`) garantizando que ninguna respuesta salga hacia WhatsApp o la base de datos sin antes ser saneada de forma totalmente determinista.

### Arquitectura y Módulos del Escudo Validador:

```
                  ┌───────────────────────────────────────────┐
                  │      Respuesta Cruda de Gemini (IA)       │
                  └─────────────────────┬─────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ESCUDO VALIDADOR PRE-ENVÍO (JS Local)                     │
│                                                                              │
│  1. Limpieza Estructural: Extraer botMsg + jsonStr, remover {{ }}, ```json  │
│  2. Saneador de Horarios (:30 -> :00): Convierte 8:30 -> 8:00, 16:30 -> 16:00│
│  3. Saneador de JSON (hora_cita): Corrige hora_cita ilegal a horas exactas   │
│  4. Filtro Anti-Fugas: Remueve cualquier tag |||DATOS||| residual           │
│  5. Fallback Determinista (0 Tokens): Asigna respuesta humana si botMsg es ""│
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
            [Guardar Resumen en Supabase]   [Respaldar en Google Sheets]
                         │
                         ▼
            [Enviar Mensaje de WhatsApp]
```

### Reglas de Corrección de Horarios (:30 -> :00):
- **Patrón 12 Horas con AM/PM**:  
  `8:30 am` ➔ `8:00 am`  
  `9:30 am` ➔ `9:00 am`  
  `10:30 am` ➔ `10:00 am`  
  `11:30 am` ➔ `11:00 am`  
  `4:30 pm` ➔ `4:00 pm`  
  `5:30 pm` ➔ `5:00 pm`  

- **Patrón 24 Horas / Numérico**:  
  `08:30` ➔ `08:00`  
  `09:30` ➔ `09:00`  
  `10:30` ➔ `10:00`  
  `11:30` ➔ `11:00`  
  `16:30` ➔ `16:00`  
  `17:30` ➔ `17:00`  

- **Campo `hora_cita` en JSON**:  
  Si contiene `:30` (ej: `"08:30"` o `"8:30 am"`), se normaliza a hora exacta (`"08:00"` o `"8:00 am"`).

---

## 5. Código JavaScript Propuesto para el Escudo Validador

A continuación se presenta el código completo listo para reemplazar en el nodo `Formatear Respuesta`:

```javascript
// =====================================================
// ESCUDO VALIDADOR PRE-ENVÍO (JavaScript Local, 0 Tokens)
// N8N Code Node: Formatear Respuesta + Escudo Validador
// =====================================================

// Módulo 1: Función de desinfección de horarios en media hora (:30 -> :00)
function sanitizeTimes(text) {
  if (!text || typeof text !== 'string') return text;
  
  // 1. Reemplazar horas con :30 seguidas de am/pm (ej: 8:30 am -> 8:00 am, 4:30 pm -> 4:00 pm)
  let cleaned = text.replace(/(\b(?:1[0-2]|0?[1-9])):30(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '$1:00$2');
  
  // 2. Reemplazar horas con :30 en formato 24h o simple (ej: 08:30 -> 08:00, 16:30 -> 16:00)
  cleaned = cleaned.replace(/(\b(?:[01]?\d|2[0-3])):30\b(?![\d:])/g, '$1:00');
  
  return cleaned;
}

// Módulo 2: Búsqueda recursiva de texto en respuesta de n8n
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

let history = $node["Refrescar Datos de Supabase"].json.chat_history || [];
let fullResponse = findText($json, 0);

// Fallback determinista inicial si la IA no generó salida
if (!fullResponse || fullResponse.trim() === "") {
  fullResponse = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
}

// Limpieza básica de saltos de línea escapados y espacios múltiples
fullResponse = fullResponse.replace(/\\\\n/g, ' ').replace(/\\n/g, ' ').replace(/  +/g, ' ').trim();

let botMsg = fullResponse;
let datosExtraidos = {
  nombre: undefined, ciudad: undefined, motivo_consulta: undefined,
  temperatura: undefined, resumen: undefined, dia_cita: undefined,
  hora_cita: undefined, requiere_asistencia_humana: undefined
};

// Módulo 3: Extracción y Limpieza de Bloque |||DATOS|||
if (fullResponse.includes('|||DATOS|||')) {
  const partes = fullResponse.split('|||DATOS|||');
  botMsg = partes[0].trim();
  let jsonStr = partes[1].trim();

  // Limpieza de plantillas y markdown
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
    // Si JSON.parse falla, usar fallback con Expresiones Regulares
  }

  if (!parseOk) {
    try {
      const extraer = (campo) => {
        const regex = new RegExp('"' + campo + '"\\s*:\\s*"([^"]*)"');
        const match = jsonStr.match(regex);
        return match ? match[1] : undefined;
      };
      const nombre = extraer('nombre');
      const ciudad = extraer('ciudad');
      const motivo = extraer('motivo_consulta');
      const temp = extraer('temperatura');
      const resumen = extraer('resumen');
      const dia = extraer('dia_cita');
      const hora = extraer('hora_cita');
      const alerta = extraer('requiere_asistencia_humana');

      if (nombre !== undefined) datosExtraidos.nombre = nombre;
      if (ciudad !== undefined) datosExtraidos.ciudad = ciudad;
      if (motivo !== undefined) datosExtraidos.motivo_consulta = motivo;
      if (temp !== undefined) datosExtraidos.temperatura = temp;
      if (resumen !== undefined) datosExtraidos.resumen = resumen;
      if (dia !== undefined) datosExtraidos.dia_cita = dia;
      if (hora !== undefined) datosExtraidos.hora_cita = hora;
      if (alerta !== undefined) datosExtraidos.requiere_asistencia_humana = alerta;
    } catch (e2) {}
  }
}

// =====================================================
// APLICACIÓN DEL ESCUDO VALIDADOR PRE-ENVÍO
// =====================================================

// 1. Saneamiento de Horarios Ilegales (:30 -> :00) en el Texto Conversacional
botMsg = sanitizeTimes(botMsg);

// 2. Saneamiento del Campo hora_cita en JSON Metadata
if (datosExtraidos.hora_cita) {
  datosExtraidos.hora_cita = sanitizeTimes(datosExtraidos.hora_cita);
}

// 3. Eliminación Estricta de Fugas de Etiqueta DATOS
botMsg = botMsg.replace(/\|\|\|DATOS\|\|\|.*/gs, '').trim();

// 4. Mantenimiento de Fallback Determinista Si botMsg Quedó Vacío (0 Tokens Extra)
if (!botMsg || botMsg.trim() === "") {
  botMsg = "Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?";
  if (!datosExtraidos.requiere_asistencia_humana) {
    datosExtraidos.requiere_asistencia_humana = "Respuesta de IA vacía - Fallback activado";
  }
}

// 5. Consolidación con Datos Previos de Supabase
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

// 6. Actualización del Historial de Chat (Máximo 8 mensajes)
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

## 6. Verificación de Beneficios y Consumo de Tokens

| Métrica / Aspecto | Sin Escudo Validador | Con Escudo Validador Pre-Envío |
|---|---|---|
| **Consumo de Tokens Extra** | Alto (requería reintentos o llamadas suplementarias a LLM) | **0 Tokens (100% JS Local)** |
| **Respuesta ante Horario :30** | Envía hora ilegal al paciente e ignora regla de negocio | **Corrige a hora exacta en punto (:00)** |
| **Respuesta ante IA Muda / Vacía** | Lanza excepción no capturada y aborta el flujo | **Aplica fallback determinista amigable** |
| **Fugas de JSON a WhatsApp** | Posible si la IA no respeta el delimitador exacto | **Filtra y remueve residuos de tags** |
| **Latencia Adicional** | Ninguna (ejecución síncrona en microsegundos) | **< 1 ms** |
