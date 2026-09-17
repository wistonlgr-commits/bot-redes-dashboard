# Reporte de Análisis: Paso 4 — Estructuración del Ciclo de Autoaprendizaje Asincrónico (`bot_quality_logs`)

## 1. Resumen Ejecutivo
El **Paso 4: Estructuración del Ciclo de Autoaprendizaje Asincrónico** define la arquitectura de telemetría y registro de calidad en tiempo de ejecución para el asistente de WhatsApp del Dr. Trejo. 

El objetivo primordial es capturar todas las incidencias de calidad, alertas de asistencia humana, fallbacks y correcciones determinísticas de horarios sin incurrir en **ningún costo de tokens de IA en tiempo real** (**0 Real-Time AI Tokens**) y **sin incrementar la latencia** de respuesta al paciente.

Toda la detección de incidencias se realiza de manera **determinística en JavaScript local** (dentro del nodo `Formatear Respuesta` / Escudo Validador Pre-Envío y en el flujo del `Silenciador`). Los eventos detectados se persisten de forma asíncrona y no bloqueante en la tabla Supabase `bot_quality_logs`. Posteriormente, un ciclo de aprendizaje por lotes (batch/nocturno) analiza estos registros para refinar continuamente el System Prompt y reducir alucinaciones futuros.

---

## 2. Identificación de Puntos de Registro de Incidencias en el Flujo n8n

Al inspeccionar `flujo asistente de whatsapp.json`, se identifican **5 puntos/escenarios principales** donde ocurren eventos de calidad y anomalías:

### Escenario A: Alerta de Asistencia Humana (`ALERTA_ASISTENCIA_HUMANA`)
- **Ubicación en el Flujo**: Nodo `Formatear Respuesta` (Post-`Cerebro Inteligencia Artificial`).
- **Detonador**: Gemini devuelve `requiere_asistencia_humana: true` (o string `"true"`), o la consulta del paciente coincide con emergencias médicas, estado emocional alterado o solicitud explícita de un humano.
- **Impacto de Calidad**: Alto. Requiere transferencia del control del chat a un operador humano y análisis de contexto para ajustar los límites del bot.

### Escenario B: Corrección de Horario / Intervención del Escudo Validador (`HORARIO_ALUCINADO_CORREGIDO`, `FECHA_PASADA_O_FIN_DE_SEMANA`, `CITA_SIN_NOMBRE_PACIENTE`, `HORARIO_NO_DISPONIBLE`)
- **Ubicación en el Flujo**: Nodo `Formatear Respuesta` (Escudo Validador Pre-Envío).
- **Detonador**: Gemini intenta agendar o proponer una cita (`datosExtraidos.dia_cita` o `datosExtraidos.hora_cita`), pero el Escudo Validador anula o ajusta los valores por alguno de los siguientes motivos:
  1. **Minutos intermedios alucinados** (ej. `08:30`, `09:15` en lugar de horas exactas `:00`).
  2. **Hora fuera de rango clínico** (ej. `14:00`, `12:00` fuera de `[8, 9, 10, 11, 16, 17]`).
  3. **Fecha pasada o fin de semana** (Sábado/Domingo o fecha anterior al día actual en `America/Caracas`).
  4. **Intento de agendamiento sin nombre** (`nombre` del paciente está vacío).
  5. **Cruce de disponibilidad fallido** (la hora no figura en el string `agenda_disponible` de `Formatear Agenda`).
- **Impacto de Calidad**: Medio-Alto. Representa una alucinación interceptada localmente antes de llegar al paciente.

### Escenario C: Fallback de Parseo JSON o Mute de la IA (`PARSEO_JSON_FALLIDO`, `MUTE_IA`)
- **Ubicación en el Flujo**: Nodo `Formatear Respuesta`.
- **Detonador**:
  - `PARSEO_JSON_FALLIDO`: El bloque `|||DATOS|||` emitido por Gemini tiene un formato JSON inválido y requirió extracción por Expresiones Regulares.
  - `MUTE_IA`: Gemini no generó respuesta de texto (`botMsg` vacío), activando el mensaje por defecto.
- **Impacto de Calidad**: Crítico/Alto. Falla estructural de salida del modelo.

### Escenario D: Desactivación por Intervención del Doctor / Silenciador (`TAKEOVER_DOCTOR`)
- **Ubicación en el Flujo**: Salida 1 (Falsa/Doctor) de `¿Lo envió el paciente?` -> `Apagar Bot (Silenciador)`.
- **Detonador**: El médico o personal de recepción envía un mensaje directamente desde el teléfono de la clínica. El flujo desactiva el bot (`activo = false`).
- **Impacto de Calidad**: Informativo/Medio. Indica intervención manual en el hilo de conversación.

### Escenario E: Desestimación por Bot Desautorizado (`BOT_DESAUTORIZADO`)
- **Ubicación en el Flujo**: Salida 1 (Falsa) de `¿El Bot está Autorizado?`.
- **Detonador**: Llega un mensaje pero el paciente tiene `activo = false`. El bot no procesa la IA.
- **Impacto de Calidad**: Informativo. Confirma la vigencia del silenciador.

---

## 3. Arquitectura de Registro Asincrónico (0 Real-Time AI Tokens)

Para garantizar **0 costo en tokens de IA** en tiempo real y **cero latencia adicional** en el envío de WhatsApp, se establece el siguiente diseño arquitectónico:

```
                          [ Cerebro Inteligencia Artificial ]
                                         │
                                         ▼
                             [ Formatear Respuesta ]
                   (Escudo Validador + Detector Determinístico JS)
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
   [ Guardar Resumen Supabase ]  [ Respaldar Google Sheets ]  [ ¿Hay Incidencia? ] (IF Node)
                 │                                               │ (True)
                 ▼                                               ▼
   [ Enviar Mensaje WhatsApp ]                       [ Registrar bot_quality_logs ]
      (Experiencia Paciente)                             (Telemetría Asíncrona)
```

### Principios Fundamentales:
1. **Detección Determinística Local (0 Tokens)**: El cálculo de `incidencia_detectada`, `tipo_incidencia`, `nivel_gravedad` y `motivo_correccion` se ejecuta en milisegundos mediante código JavaScript en `Formatear Respuesta`. No se invoca ningún prompt de evaluación ni LLM en tiempo real.
2. **Ejecución Paralela No Bloqueante en n8n**: Mediante el branching nativo de n8n desde `Formatear Respuesta`, la rama de WhatsApp (`Guardar Resumen en Supabase` -> `Enviar Mensaje de WhatsApp`) se ejecuta en paralelo con la rama de telemetría (`¿Hay Incidencia?` -> `Registrar bot_quality_logs`). Si la base de datos de telemetría experimentara micro-latencias, la entrega del mensaje por WhatsApp no se ve afectada.
3. **Escritura Selectiva (Filtrado Previerte I/O innecesario)**: El nodo IF `¿Hay Incidencia?` evalúa `quality_log.incidencia_detectada === true`. Solo los eventos que representen una anomalía, corrección de horario, alerta humana o falla de parseo generan un INSERT en Supabase.

---

## 4. Diseño del Esquema de Base de Datos (`bot_quality_logs`)

Se define la tabla `bot_quality_logs` en Supabase con soporte para consultas de autoaprendizaje por lotes e índices de alto rendimiento:

```sql
-- Tabla de Telemetría e Incidencias de Calidad para Autoaprendizaje Asincrónico
CREATE TABLE IF NOT EXISTS public.bot_quality_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    telefono TEXT NOT NULL,
    tipo_incidencia TEXT NOT NULL,
    nivel_gravedad TEXT NOT NULL DEFAULT 'MEDIUM',
    entrada_paciente TEXT,
    respuesta_raw_ia TEXT,
    respuesta_saneada TEXT,
    datos_solicitados_raw JSONB,
    datos_finales_saneados JSONB,
    motivo_correccion TEXT,
    agenda_disponible_snapshot TEXT,
    revisado_batch BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices de Rendimiento y Filtrado Batch
CREATE INDEX IF NOT EXISTS idx_bot_quality_logs_fecha ON public.bot_quality_logs (fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_bot_quality_logs_tipo ON public.bot_quality_logs (tipo_incidencia);
CREATE INDEX IF NOT EXISTS idx_bot_quality_logs_revisado ON public.bot_quality_logs (revisado_batch) WHERE revisado_batch = FALSE;
CREATE INDEX IF NOT EXISTS idx_bot_quality_logs_telefono ON public.bot_quality_logs (telefono);
```

### Descripción de Campos Clave:
- `tipo_incidencia`: Valores estandarizados (`ALERTA_ASISTENCIA_HUMANA`, `HORARIO_ALUCINADO_CORREGIDO`, `FECHA_PASADA_O_FIN_DE_SEMANA`, `CITA_SIN_NOMBRE_PACIENTE`, `HORARIO_NO_DISPONIBLE`, `PARSEO_JSON_FALLIDO`, `MUTE_IA`, `TAKEOVER_DOCTOR`).
- `nivel_gravedad`: Clasificación del impacto (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `entrada_paciente`: Mensaje exacto enviado por el paciente.
- `respuesta_raw_ia`: Respuesta bruta de Gemini antes de pasar por el Escudo Validador.
- `datos_solicitados_raw`: Objeto JSON original extraído de Gemini (contiene la cita alucinada o fallida).
- `datos_finales_saneados`: Objeto JSON saneado resultante aplicado por el Escudo.
- `motivo_correccion`: Razón explicable de la intervención local.
- `agenda_disponible_snapshot`: Copia textual de las horas disponibles entregadas a la IA durante la inferencia.
- `revisado_batch`: Booleano para control de consumo del proceso nocturno de autoaprendizaje.

---

## 5. Lógica de Detección e Integración JS en `Formatear Respuesta`

Dentro de `Formatear Respuesta`, se extiende la lógica para construir el objeto `quality_log` determinísticamente:

```javascript
// =====================================================
// EXTENSIÓN DE TELEMETRÍA Y CALIDAD (0 TOKENS)
// =====================================================

let motivos = [];
let tipoIncidencia = "NINGUNA";
let nivelGravedad = "LOW";
let tieneIncidencia = false;

// 1. Detección de Mute
if (!botMsg || botMsg.trim() === "") {
  tieneIncidencia = true;
  tipoIncidencia = "MUTE_IA";
  nivelGravedad = "CRITICAL";
  motivos.push("Gemini emitio respuesta vacia/muda");
}

// 2. Detección de Falla de Parseo JSON
if (fullResponse.includes('|||DATOS|||') && !parseOk) {
  tieneIncidencia = true;
  if (tipoIncidencia === "NINGUNA") tipoIncidencia = "PARSEO_JSON_FALLIDO";
  if (nivelGravedad !== "CRITICAL") nivelGravedad = "HIGH";
  motivos.push("Falla de parseo JSON. Se utilizo extraccion por Expresiones Regulares");
}

// 3. Detección de Alerta de Asistencia Humana
if (alerta_final === 'true' || alerta_final === true || datosExtraidos.requiere_asistencia_humana === 'true') {
  tieneIncidencia = true;
  if (tipoIncidencia === "NINGUNA") tipoIncidencia = "ALERTA_ASISTENCIA_HUMANA";
  if (nivelGravedad !== "CRITICAL") nivelGravedad = "HIGH";
  motivos.push("Solicitud o necesidad de asistencia humana detectada por la IA");
}

// 4. Detección de Correcciones de Horario / Citas Interceptadas
const intentoDiaRaw = datosExtraidos.dia_cita || "";
const intentoHoraRaw = datosExtraidos.hora_cita || "";

if ((intentoDiaRaw || intentoHoraRaw) && (!dia_final || !hora_final)) {
  tieneIncidencia = true;
  if (tipoIncidencia === "NINGUNA") tipoIncidencia = "HORARIO_ALUCINADO_CORREGIDO";
  if (nivelGravedad === "LOW") nivelGravedad = "MEDIUM";

  if ((intentoDiaRaw || intentoHoraRaw) && (!nombre_final || nombre_final.trim() === "")) {
    motivos.push("Intento de agendar sin nombre de paciente registrado");
  }
  if (intentoHoraRaw && (!hora_final || hora_final === "")) {
    motivos.push(`Hora alucinada '${intentoHoraRaw}' no es hora exacta en punto :00 o fuera de rango [8,9,10,11,16,17]`);
  }
  if (intentoDiaRaw && (!dia_final || dia_final === "")) {
    motivos.push(`Fecha '${intentoDiaRaw}' es pasada, fin de semana o formato YYYY-MM-DD invalido`);
  }
  if (agendaTxt && intentoDiaRaw && intentoHoraRaw && (!dia_final || !hora_final)) {
    motivos.push(`Horario '${intentoDiaRaw} ${intentoHoraRaw}' no disponible en el snapshot de agenda_disponible`);
  }
}

// Extraer último mensaje del paciente desde el historial
let ultimoMensajePaciente = "";
if (Array.isArray(history) && history.length > 0) {
  const userMsgs = history.filter(m => m.role === "user");
  if (userMsgs.length > 0) {
    ultimoMensajePaciente = userMsgs[userMsgs.length - 1].content || "";
  }
}

// Retorno consolidado con sub-objeto quality_log
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
  requiere_asistencia_humana: alerta_final,
  quality_log: {
    incidencia_detectada: tieneIncidencia,
    tipo_incidencia: tipoIncidencia,
    nivel_gravedad: nivelGravedad,
    motivo_correccion: motivos.join('; '),
    entrada_paciente: ultimoMensajePaciente,
    respuesta_raw_ia: fullResponse,
    respuesta_saneada: botMsg,
    datos_solicitados_raw: datosExtraidos,
    datos_finales_saneados: {
      nombre: nombre_final,
      dia_cita: dia_final,
      hora_cita: hora_final,
      requiere_asistencia_humana: alerta_final
    },
    agenda_disponible_snapshot: agendaTxt
  }
};
```

---

## 6. Configuración Topológica de Nodos en n8n

Para implementar el Paso 4 en la estructura del workflow JSON:

1. **Salidas del nodo `Formatear Respuesta`**:
   - Conexión 0: `Guardar Resumen en Supabase`
   - Conexión 1: `Respaldar en Google Sheets`
   - Conexión 2: `¿Hay Incidencia de Calidad?` (Nuevo nodo IF de filtrado)

2. **Nodo `¿Hay Incidencia de Calidad?` (IF Node)**:
   - Condición: `{{ $json.quality_log.incidencia_detectada }} === true`
   - Output True -> Conecta a `Registrar en bot_quality_logs` (Nodo Supabase Insert).
   - Output False -> Fin de rama (no ejecuta I/O).

3. **Nodo `Registrar en bot_quality_logs` (Supabase Insert)**:
   - Tabla: `bot_quality_logs`
   - Mapeo de Campos:
     - `telefono`: `={{ $('Refrescar Datos de Supabase').item.json.Telefono }}`
     - `tipo_incidencia`: `={{ $json.quality_log.tipo_incidencia }}`
     - `nivel_gravedad`: `={{ $json.quality_log.nivel_gravedad }}`
     - `entrada_paciente`: `={{ $json.quality_log.entrada_paciente }}`
     - `respuesta_raw_ia`: `={{ $json.quality_log.respuesta_raw_ia }}`
     - `respuesta_saneada`: `={{ $json.quality_log.respuesta_saneada }}`
     - `datos_solicitados_raw`: `={{ JSON.stringify($json.quality_log.datos_solicitados_raw) }}`
     - `datos_finales_saneados`: `={{ JSON.stringify($json.quality_log.datos_finales_saneados) }}`
     - `motivo_correccion`: `={{ $json.quality_log.motivo_correccion }}`
     - `agenda_disponible_snapshot`: `={{ $json.quality_log.agenda_disponible_snapshot }}`
     - `revisado_batch`: `false`

4. **Rama del Silenciador (`Apagar Bot`)**:
   - Tras el nodo `Apagar Bot (Silenciador) `, se puede conectar opcionalmente un nodo Supabase Insert `Registrar Takeover en Quality Logs` que inserta `tipo_incidencia = 'TAKEOVER_DOCTOR'`.

---

## 7. Diseño del Ciclo de Autoaprendizaje Asincrónico Nocturno (Batch Auto-Learning)

El ciclo de autoaprendizaje opera fuera del flujo en tiempo real (ej. mediante un cronjob nocturno a las 02:00 AM o un flujo n8n programado):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CICLO NOCTURNO DE AUTOAPRENDIZAJE                    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
 1. EXTRAER INCIDENCIAS        SELECT * FROM bot_quality_logs 
    NO PROCESADAS              WHERE revisado_batch = FALSE;
                                    │
                                    ▼
 2. EVALUACIÓN Y AGRUPACIÓN    Agrupar por `tipo_incidencia` y frecuencia.
    POR TIPO                   Identificar patrones repetitivos de alucinación.
                                    │
                                    ▼
 3. ANÁLISIS LLM FUERA DE      Enviar lote a modelo avanzado (ej. Claude / Gemini Pro)
    LÍNEA (BATCH EVALUATION)   con prompt de meta-evaluación para sugerir ajustes
                               al System Prompt o pocos ejemplos (few-shot cases).
                                    │
                                    ▼
 4. ACTUALIZACIÓN Y CIERRE     - Generar reporte diario de calidad.
                               - UPDATE bot_quality_logs SET revisado_batch = TRUE.
```

### Ventajas Estratégicas:
- **0 Latencia y 0 Costo durante la interacción con el paciente**.
- **Máxima calidad de refinamiento**: El análisis nocturno tiene contexto completo y tiempo illimitado para evaluar las causas raíz de cada alucinación.
- **Métricas operacionales claras**: Cuadro de mando con tasa de alucinaciones por día, intervenciones humanas y correcciones de horario interceptadas.
