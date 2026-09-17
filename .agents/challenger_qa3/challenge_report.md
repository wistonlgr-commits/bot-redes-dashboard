# REPASO QA 3: Simulación Integral de Escenarios y Casos Borde
**Proyecto**: n8n Dr. Trejo Workflow Optimization  
**Archivo Evaluado**: `flujo asistente de whatsapp.json`  
**Agente**: Challenger QA 3 (`teamwork_preview_challenger`)  
**Fecha**: 2026-07-27  

---

## 1. RESUMEN EJECUTIVO Y VEREDICTO FINAL

| Escenario / Caso Borde | Estado | Nodos Involucrados | Hallazgos y Comportamiento |
|---|---|---|---|
| **Caso (a)**: Mensaje en domingo solicitando cita por la tarde | **PASS (con Advertencia)** | `Formatear Agenda`, `Cerebro IA`, `Formatear Respuesta` | Lógica de fechas en domingo genera correctamente agenda para la próxima semana (lunes-viernes). Bloqueos de tarde en lunes, martes y viernes son respetados. `Formatear Respuesta` contiene escudo determinista que intercepta cualquier intento de agendamiento en sábado/domingo o en horarios/días sin disponibilidad en `agenda_disponible`. |
| **Caso (b)**: Solicitud de cita a las 12:30 | **PASS** | `Formatear Agenda`, `Cerebro IA`, `Formatear Respuesta` | `Formatear Agenda` genera únicamente franjas en punto (`:00`). El prompt de `Cerebro IA` prohíbe explícitamente franjas de media hora (`:30`). `Formatear Respuesta` sanitiza `:30` a `:00` mediante `sanitizeTimes` y valida la hora contra `validHours` `[8, 9, 10, 11, 16, 17]`. La hora `12:00` no pertenece a `validHours`, por lo que cualquier alucinación a las 12:30 es interceptada a costo cero de tokens. |
| **Caso (c)**: Paciente antiguo con cita ya programada | **FAIL (FALLO CRÍTICO DE ESTADO)** | `Buscar Paciente`, `Refrescar Datos`, `Cerebro IA`, `Formatear Respuesta`, `Guardar Resumen en Supabase` | **VULNERABILIDAD CRÍTICA**: En `Formatear Respuesta`, la asignación `dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "")` asigna `""` cuando el JSON del IA contiene `"dia_cita": ""`. Al consultar al bot sin agendar (ej. pedir dirección, confirmar cita o hacer una pregunta), el bot emite `"dia_cita": ""` y Supabase **BORRA** la cita activa (`Dia_Cita` y `Hora_Cita`), corrompiendo la persistencia de la agenda. |

### VEREDICTO FINAL: FAIL
El flujo falla la simulación integral debido a la **Vulnerabilidad de Borrado Accidental de Citas Activas en Pacientes Antiguos (Caso c)**.

---

## 2. TRAZA DETALLADA DE CASOS Y SIMULACIÓN DE FLUJO DE DATOS

### CASO (a): Paciente en domingo pidiendo cita por la tarde ("Paciente en domingo pidiendo cita por la tarde")

#### 1. Traza en `Formatear Agenda` (Nodo ID: `9d5ef635-9c04-433b-9a63-a4495b0dd7f9`)
- **Cálculo de Fecha en Domingo**:
  - `todayStr` se obtiene con `Intl.DateTimeFormat` en la zona horaria `'America/Caracas'`. Para el domingo 2026-07-26, `todayStr = "2026-07-26"`.
  - `baseDate = new Date('2026-07-26T12:00:00-04:00')`.
  - Para `i = 0` (Domingo 2026-07-26): `dayOfWeek = 0`. La condición `dayOfWeek === 0 || dayOfWeek === 6` se evalúa como `true`.
  - Salida producida en `reporteDisponibilidad`:
    `- 2026-07-26 (Fin de semana): NO LABORABLE`
- **Generación de Franjas para la Próxima Semana**:
  - **Lunes (`i=1`)**: Mañana `[08:00, 09:00, 10:00, 11:00]`, Tarde `[Sin disponibilidad]` (Ambulatorio del Norte).
  - **Martes (`i=2`)**: Mañana `[08:00, 09:00, 10:00, 11:00]`, Tarde `[Sin disponibilidad]` (Más Salud).
  - **Miércoles (`i=3`)**: Mañana `[08:00, 09:00, 10:00, 11:00]`, Tarde `[16:00, 17:00]` (Prevaler finaliza bloqueo a las 16:00).
  - **Jueves (`i=4`)**: Mañana `[08:00, 09:00, 10:00, 11:00]`, Tarde `[16:00, 17:00]` (Calicanto/Turmero finaliza bloqueo a las 16:00).
  - **Viernes (`i=5`)**: Mañana `[08:00, 09:00, 10:00, 11:00]`, Tarde `[Sin disponibilidad]` (Viernes tarde no laborable).

#### 2. Traza en `Cerebro Inteligencia Artificial` (Nodo ID: `8214de70-11ae-4afb-8049-f5527562c61b`)
- **Regla Dinámica de Horarios Inyectada**:
  `HOY ES FIN DE SEMANA. Citas para la próxima semana (lunes a viernes). Puedes ofrecer disponibilidad en la MAÑANA (8:00 am a 12:00 pm) y en la TARDE (4:00 pm y 5:00 pm, respetando bloqueos de agenda).`
- **Comportamiento del Prompt**:
  - Si el paciente solicita la tarde, el IA evalúa `AGENDA_DISPONIBLE`. Detecta que lunes y martes por la tarde no tienen cupo.
  - Redirecciona al primer día laborable con disponibilidad por la tarde (Miércoles o Jueves a las 4:00 pm o 5:00 pm), o sugiere primero la mañana del lunes según la Regla de Prioridad de Agenda ("OBLIGATORIO - LLENAR ESPACIOS CERCANOS").

#### 3. Traza en `Formatear Respuesta` (Escudo Validador Pre-envío)
- **Validación de Fin de Semana**:
  ```javascript
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    if (!alerta_final) alerta_final = "Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo).";
    if (!detectedIncidentType) detectedIncidentType = "ALUCINACION_FIN_DE_SEMANA";
    dia_final = ""; hora_final = "";
    botMsg = botMsg.replace(/\b(este\s+|el\s+)?(sábado|sabado|domingo)\b/gi, 'el lunes');
  }
  ```
- **Validación Contra `agenda_disponible`**:
  - Si el IA intenta agendar para el Lunes en la tarde (`2026-07-27` a las `16:00`), la línea de agenda para `2026-07-27` indica `TARDE DISPONIBLE: [Sin disponibilidad]`.
  - La verificación `dayLine.includes("16:00")` retorna `false`.
  - Se activa el interceptor: `alerta_final = "Hora 16:00 no disponible para el 2026-07-27."`, `detectedIncidentType = "FECHA_NO_DISPONIBLE"`, anulando `dia_final` y `hora_final`.

---

### CASO (b): Paciente pidiendo cita a las 12:30 ("Paciente pidiendo cita a las 12:30")

#### 1. Traza en `Formatear Agenda`
- Franjas candidatas configuradas:
  `SLOTS_MANANA = ["08:00", "09:00", "10:00", "11:00"]`
  `SLOTS_TARDE = ["16:00", "17:00"]`
- Las horas intermedias con minutos (`:30`) no forman parte del universo de franjas válidas.

#### 2. Traza en `Cerebro Inteligencia Artificial`
- **Instrucción Estricta en Prompt**:
  `Da DOS opciones de horas disponibles. OBLIGATORIO: Las consultas duran 1 hora y debes ofrecer únicamente "HORAS EN PUNTO" (ej. 8:00 am, 9:00 am, 10:00 am, 11:00 am, 4:00 pm, 5:00 pm). ESTÁ ESTRICTAMENTE PROHIBIDO ofrecer horas intermedias con minutos...`

#### 3. Traza en `Formatear Respuesta` (Escudo Validador Pre-envío)
- **Fase A: Sanitización de Texto (`sanitizeTimes`)**:
  - Si `botMsg` menciona "12:30 pm" o "12 y media", la función `sanitizeTimes` lo transforma determinísticamente a "12:00 pm".
- **Fase B: Validación Numérica de `hora_final`**:
  - `hora_final` sanitizada = `"12:00"`.
  - Extracción de hora de 24 horas: `hour24 = 12`.
  - Verificación contra lista permitida: `validHours = [8, 9, 10, 11, 16, 17]`.
  - Evaluando `validHours.includes(12)` -> **`FALSE`** (La consulta cierra a las 12:00 pm, no se agendan citas que inicien a las 12:00 pm ni a las 12:30 pm).
- **Resultado del Interceptor**:
  - `alerta_final` = `"Horario no permitido detectado (12:00 pm). Cita anulada para verificación manual."`
  - `detectedIncidentType` = `"ALUCINACION_HORARIO"`
  - `dia_final` = `""`
  - `hora_final` = `""`
  - `has_quality_incident` = `true` -> Notifica a Supabase `bot_quality_logs`.

---

### CASO (c): Paciente antiguo con cita ya programada ("Paciente antiguo con cita ya programada")

#### 1. Traza de Contexto del Paciente en Nodos Previos
- `Buscar Paciente (Supabase)` encuentra el registro en `leads`.
- `Refrescar Datos de Supabase` extrae los campos existentes:
  - `Nombre`: `"Carlos Rodriguez"`
  - `Dia_Cita`: `"2026-07-29"`
  - `Hora_Cita`: `"09:00"`
- `Cerebro Inteligencia Artificial` recibe el contexto inyectado:
  `DATOS DEL PACIENTE ACTUAL:`
  `Nombre: Carlos Rodriguez`
  `Cita Programada: 2026-07-29 a las 09:00`
  `REGLA DE ORO SI YA TIENE CITA: Si el paciente ya tiene Cita Programada (que no sea Ninguna), ESA HORA ES SUYA. No le digas que está ocupada. No le agendes una nueva.`

#### 2. ANÁLISIS DE LA VULNERABILIDAD CRÍTICA EN `Formatear Respuesta`
En el nodo `Formatear Respuesta` (línea 274 del script del nodo / 337 del archivo):
```javascript
let dia_final = datosExtraidos.dia_cita !== undefined ? datosExtraidos.dia_cita : (prevData.Dia_Cita || "");
let hora_final = datosExtraidos.hora_cita !== undefined ? datosExtraidos.hora_cita : (prevData.Hora_Cita || "");
```

**Mecanismo de Falla Paso a Paso**:
1. Cuando el paciente escribe para consultar la dirección ("¿Dónde están ubicados?") o para hacer cualquier pregunta no relacionada con agendar una nueva cita:
2. El modelo IA genera la respuesta de texto y adjunta el bloque JSON de acuerdo a la instrucción: `- dia_cita: YYYY-MM-DD. Solo cuando el paciente CONFIRME el día Y ya tengas su nombre, motivo y ciudad. NO LLENAR SI FALTAN DATOS.`
3. El JSON emitido por el IA contiene: `{"nombre": "Carlos Rodriguez", ..., "dia_cita": "", "hora_cita": ""}`.
4. El parser de `Formatear Respuesta` asigna: `datosExtraidos.dia_cita = ""`.
5. Como `"dia_cita"` existe en el JSON, la condición `datosExtraidos.dia_cita !== undefined` es **`TRUE`**.
6. Por lo tanto, `dia_final` se evalúa como **`""`** en lugar de preservar `prevData.Dia_Cita` (`"2026-07-29"`).
7. En el siguiente nodo, `Guardar Resumen en Supabase` (`ca9bf834-c7cd-4976-a364-c4148ffe2287`), se ejecuta el UPDATE en la tabla `leads`:
   - `Dia_Cita` = `""`
   - `Hora_Cita` = `""`
8. **CONSECUENCIA GRAVE**: La cita de Carlos Rodriguez queda **BORRADA** de la base de datos Supabase.
9. En la siguiente ejecución de `Consultar Agenda Global`, la franja del `2026-07-29 09:00` aparece como vacía en `Formatear Agenda`, permitiendo sobreagendamiento / duplicidad de citas.

---

## 3. PROPUESTA DE CORRECCIÓN PARA EL CASO (c)

Para corregir la vulnerabilidad en `Formatear Respuesta`, se debe modificar la lógica de preservación de estado para que solo sobrescriba `Dia_Cita` y `Hora_Cita` cuando el IA intencionalmente envíe una nueva fecha válida o cuando exista una cancelación explícita en la interacción:

### Código Corregido (Parche para `Formatear Respuesta`):
```javascript
// Preservación Correcta de Cita Existente
let dia_final = (datosExtraidos.dia_cita && datosExtraidos.dia_cita.trim() !== "") 
  ? datosExtraidos.dia_cita 
  : (prevData.Dia_Cita || "");

let hora_final = (datosExtraidos.hora_cita && datosExtraidos.hora_cita.trim() !== "") 
  ? datosExtraidos.hora_cita 
  : (prevData.Hora_Cita || "");

// Si el paciente cancela explícitamente (detectado por el IA o resumen)
if (datosExtraidos.resumen && datosExtraidos.resumen.toLowerCase().includes('cancela')) {
  dia_final = "";
  hora_final = "";
}
```

---

## 4. RESULTADOS DE MATRIZ DE PRUEBAS DE ESTRÉS

| Escenario de Estrés | Comportamiento Esperado | Comportamiento Obtenido | Resultado |
|---|---|---|---|
| Paciente solicita cita domingo 4:00 pm | Bloqueo fin de semana y oferta lunes/miércoles | Escudo borra cita de domingo y reemplaza menciones por "el lunes". Agenda muestra domingo como NO LABORABLE. | **PASS** |
| Paciente solicita 12:30 pm en lunes | Rechazo por horario inválido | `sanitizeTimes` convierte a 12:00, `validHours` rechaza 12:00. Interceptado con incident `ALUCINACION_HORARIO`. | **PASS** |
| Paciente con cita envía "¿dónde quedan?" | Responde dirección y conserva la cita | Responde dirección pero `dia_final` se vuelve `""` y borra la cita en Supabase. | **FAIL** |
| Paciente solicita reagendamiento | Pide 50% abono y deriva a humana | Solicita abono y emite `requiere_asistencia_humana: "true"`. | **PASS** |

---

## 5. CONCLUSIÓN Y RECOMENDACIÓN

El flujo `flujo asistente de whatsapp.json` ha demostrado una arquitectura sólida en cuanto a formateo dinámico de agenda (Caso a) y escudo validador local de cero tokens para franjas horarias inválidas (Caso b).

Sin embargo, el veredicto es **FAIL** debido al fallo crítico en la gestión de estado de pacientes antiguos (Caso c), donde cualquier interacción casual de un paciente con cita agendada borra sus datos de agendamiento en Supabase. Se requiere aplicar el parche en el nodo `Formatear Respuesta` antes de su pase definitivo a producción.
