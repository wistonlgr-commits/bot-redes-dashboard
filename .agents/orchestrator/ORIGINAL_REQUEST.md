# Original User Request

## 2026-07-29T13:09:12Z

<USER_REQUEST>
Reestructuración completa del System Prompt, algoritmo de agenda y modelo de IA del bot de WhatsApp del Dr. Ángel Trejo Alvarado. El bot atiende pacientes por WhatsApp para un consultorio de flebología en Maracay, Venezuela. El archivo maestro es un JSON de workflow de n8n con 23 nodos.

Working directory: c:\Users\Leor\Desktop\bot whatsapp
Integrity mode: development
Target production file: flujo asistente de whatsapp.json

---

## Contexto Crítico

El archivo `flujo asistente de whatsapp.json` contiene un workflow completo de n8n con 23 nodos. El equipo SOLO debe modificar 3 nodos internos sin alterar la estructura, conexiones, IDs, credenciales ni parámetros del resto de nodos. Los 3 nodos a modificar son:

1. **`Cerebro Inteligencia Artificial`** — Contiene el modelo de IA y el System Prompt en `parameters.messages.values[0].content`
2. **`Formatear Agenda`** — Contiene el código JavaScript de cálculo de disponibilidad en `parameters.jsCode`  
3. **`Formatear Respuesta`** — Contiene el Escudo Validador JS en `parameters.jsCode` (solo ajustes menores si es necesario)

**REGLA INQUEBRANTABLE**: La salida final DEBE ser un archivo JSON 100% válido e importable en n8n. Si el JSON está roto o malformado, TODO el trabajo es inútil.

---

## Requirements

### R1. Reescritura del System Prompt — Tono humano con meta de agendar

Reescribir el contenido del System Prompt del nodo `Cerebro Inteligencia Artificial` para que el bot suene como una secretaria médica venezolana real, NO como una IA. La meta invisible sigue siendo guiar al paciente a agendar una cita usando empatía, conocimiento del consultorio y estrategias de confianza.

**Tono objetivo** — Extraído de 7 conversaciones reales del consultorio:
- Mezcla natural de "tú" y "usted" según el contexto (no forzar uno solo)
- Saludo cálido: "Hola! Un gusto saludarte. Soy la asistente del Dr. Ángel."
- Respuestas de longitud media (2-3 oraciones naturales), ni telegráficas ni párrafos
- Frase estándar de precio: "La consulta tiene un valor de $100 (a tasa BCV) e incluye el Eco Doppler Venoso para un diagnóstico completo"
- Cierre suave orientado a agendar: "¿Te gustaría información de los espacios disponibles de esta semana?" — NO "te meto la cita ya"
- Si el paciente dice que no puede ahora: "Ok, quedamos atentos." Sin insistir.
- Indagación médica sutil cuando aplique: "¿Posee lesión en las piernas?"
- Expresiones naturales: "Entiendo", "Claro", "Perfecto", "Ok"
- PROHIBIDO: negritas, viñetas, listas numeradas, emojis, palabras de IA ("crucial", "vital", "excelente elección", "no dudes en", "estaré encantada")
- PROHIBIDO: ambos signos de exclamación (¡!). Solo el de cierre: "Hola!"

**Los siguientes 5 ejemplos de conversaciones reales DEBEN incluirse en el prompt como few-shot para que el modelo imite el tono exacto:**

```
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
```

**Base de conocimiento que DEBE mantenerse íntegra en el prompt** (no eliminar nada de esto):
- Ubicación: Maracay, Centro Empresarial Uniaragua, Piso 3, Oficina 302 (Av. Mariño Sur, San Miguel)
- Precios: Presencial $100, Online Nacional $50, Online Internacional $80 USD, Esclerosis $120/pierna
- Horarios presenciales: Lunes a Viernes solo MAÑANAS (8am-12pm) en Uniaragua
- Horarios online: Solo Lunes y Jueves en la tarde (4pm o 5pm)
- Regla de modalidades: Presencial SOLO mañanas, Online SOLO tardes Lun/Jue
- Bloqueos de clínicas externas (Ambulatorio, Más Salud, Prevaler, Calicanto, Viernes tarde, Fines de semana)
- Condiciones médicas que atiende
- Regla de Eco Doppler propio (no acepta ecos externos)
- Seguros médicos: derivar a consulta
- Métodos de pago: solo revelar cuando ya tiene cita
- Cirugías: no dar precios, derivar a consulta
- Reagendamiento: política del 50%
- Cancelaciones e inasistencias (no-show)
- Delegación humana: cuándo y cómo derivar a la secretaria
- Pacientes antiguos con cita existente
- Regla de prioridad de agenda: llenar los días más cercanos primero
- Regla dinámica de horarios (fin de semana vs día de semana)
- La etiqueta `[AGENDA_DISPONIBLE]` con inyección dinámica desde el nodo Formatear Agenda
- Datos del paciente actual inyectados desde Supabase
- Historial de conversación inyectado desde Supabase
- Extracción de datos JSON con `|||DATOS|||` al final de cada respuesta
- Fecha actual inyectada dinámicamente
- Regla de un solo turno (no inventar respuestas del paciente)

**Reducción de tokens**: El prompt actual tiene ~4,500 tokens. El nuevo prompt debe mantener TODA la información pero reducirse a ~3,500 tokens eliminando redundancias y frases imperativas excesivas ("ESTRICTAMENTE PROHIBIDO", "JAMÁS", "OBLIGATORIO" repetidos). Las reglas deben expresarse una sola vez, no repetirse en 3 secciones diferentes.

### R2. Actualización del modelo de IA

Cambiar el modelo en el nodo `Cerebro Inteligencia Artificial` de `models/gemini-3.1-flash-lite` a `models/gemini-3.6-flash`. Actualizar tanto `parameters.modelId.value` como `parameters.modelId.cachedResultName`.

### R3. Corrección del algoritmo de bloqueos en Formatear Agenda

El nodo `Formatear Agenda` contiene código JavaScript que calcula la disponibilidad. Debe mejorarse para detectar correctamente los bloqueos del dashboard del consultorio:

**Formato de bloqueos en Supabase (tabla `leads`):**
- Nombre: `[BLOQUEO] nombre descriptivo` (prefijo `[BLOQUEO]` en el campo `Nombre`)
- Hora_Cita: puede ser una hora puntual (`10:00`, `13:00`) o `TODO EL DIA`
- Dia_Cita: fecha en formato `YYYY-MM-DD`

**Lo que debe hacer el algoritmo:**
- Si `Nombre` empieza con `[BLOQUEO]` y `Hora_Cita` es `TODO EL DIA` → bloquear todo el día (ya funciona)
- Si `Nombre` empieza con `[BLOQUEO]` y `Hora_Cita` es una hora específica → bloquear esa hora específica como ocupada (ya funciona por coincidencia, formalizar)
- Los registros normales (sin prefijo `[BLOQUEO]`) se tratan como citas y bloquean su hora correspondiente (ya funciona)

**Lógica existente que DEBE preservarse:**
- Separación estricta: PRESENCIAL slots `[08:00, 09:00, 10:00, 11:00]` vs ONLINE slots `[16:00, 17:00]` solo Lun/Jue
- Filtro de horas pasadas del día actual (`currentHourCaracas`)
- Detección de `todo el dia`, `bloqueado`, `vacaciones`, `no laborable` en Hora_Cita
- Generación de 14 días de disponibilidad con etiquetas separadas PRESENCIAL/ONLINE
- Fines de semana marcados como NO LABORABLE
- Parser de hora 12h/24h (`parseTimeTo24hHour`)

### R4. Preservación de todos los sistemas de protección existentes

El nodo `Formatear Respuesta` (Escudo Validador) DEBE mantenerse 100% intacto con todas sus protecciones:
- sanitizeTimes() para interceptar alucinaciones de minutos (:30, :15, :45 → :00)
- Validación de horas permitidas: solo [8, 9, 10, 11, 16, 17]
- Validación de fechas: no pasadas, no fines de semana, formato YYYY-MM-DD
- Validación contra la agenda disponible: la hora debe aparecer en [AGENDA_DISPONIBLE]
- Validación de nombre: no agendar sin nombre del paciente
- Detección y registro de incidencias para `bot_quality_logs`
- Campos de salida: `has_quality_incident`, `tipo_incidencia`, `respuesta_raw`, `entrada_paciente`, `metadata_log`

Otros nodos que NO deben modificarse:
- `Recibir WhatsApp` (webhook)
- `¿Es mensaje válido?` (filtro de eventos)
- `Obtener_Configuracion` (lee bot_config)
- `¿Lo envió el paciente?` (detección fromMe)
- `Apagar Bot (Silenciador)` (Conversacion_Abierta = true)
- `Buscar Paciente (Supabase)`, `¿El Paciente Existe?`, `Crear Nuevo Paciente`
- `Actualizar Última Interacción`, `Pausa Anti-Spam`
- `Refrescar Datos de Supabase`, `¿El Bot está Autorizado?`
- `Bloquear Bot (Mutex)`, `Consultar Agenda Global`
- `Mostrar "Escribiendo..."`, `Enviar Mensaje de WhatsApp`
- `Guardar Resumen en Supabase`, `Respaldar en Google Sheets`
- `¿Existe Incidencia de Calidad?`, `Registrar Incidencia (Supabase)`
- El detector de Facebook/Instagram Ads en `Crear Nuevo Paciente` (campo `Fuente`)

## Acceptance Criteria

### Validez del JSON
- [ ] El archivo de salida `flujo asistente de whatsapp.json` es JSON 100% válido (parseable con `json.load()`)
- [ ] Contiene exactamente 23 nodos
- [ ] Todas las conexiones entre nodos son idénticas al archivo original
- [ ] Todos los IDs de nodos, credenciales y webhookId son idénticos al archivo original

### Modelo actualizado
- [ ] `parameters.modelId.value` del nodo `Cerebro Inteligencia Artificial` es `models/gemini-3.6-flash`
- [ ] `parameters.modelId.cachedResultName` es `models/gemini-3.6-flash`

### System Prompt — Contenido
- [ ] Contiene los 5 ejemplos de conversación few-shot con el tono exacto de las conversaciones reales
- [ ] Contiene TODA la base de conocimiento pública (ubicación, precios, horarios, condiciones, reglas)
- [ ] Contiene el bloque de extracción JSON con `|||DATOS|||`
- [ ] Contiene la inyección dinámica de `[AGENDA_DISPONIBLE]` desde el nodo Formatear Agenda
- [ ] Contiene la inyección de datos del paciente desde Supabase
- [ ] Contiene la inyección de historial de conversación
- [ ] Contiene la fecha actual dinámica
- [ ] Contiene las reglas de reagendamiento, cancelación, delegación humana
- [ ] Contiene la regla de modalidades (presencial solo mañanas, online solo tardes Lun/Jue)
- [ ] Contiene la regla de prioridad de agenda cercana

### System Prompt — Tono
- [ ] NO contiene la palabra "OBLIGATORIO" más de 2 veces en todo el prompt
- [ ] NO contiene la palabra "ESTRICTAMENTE" más de 1 vez
- [ ] NO contiene frases plantilla rígidas como "Revisando la agenda tengo espacios para este [día]"
- [ ] Contiene al menos 4 ejemplos few-shot de conversaciones reales
- [ ] El prompt total tiene menos de 4,000 tokens (medido con tiktoken o estimación de palabras/4)

### Formatear Agenda — Bloqueos
- [ ] Detecta registros con `Nombre` que empiece con `[BLOQUEO]` y los trata como bloqueos
- [ ] Detecta `Hora_Cita` con valor `TODO EL DIA` (case-insensitive) y bloquea el día completo
- [ ] Los slots presenciales siguen siendo exactamente `[08:00, 09:00, 10:00, 11:00]`
- [ ] Los slots online siguen siendo exactamente `[16:00, 17:00]` solo para Lunes y Jueves
- [ ] El filtro de horas pasadas (`currentHourCaracas`) sigue funcionando
- [ ] La salida separa explícitamente `PRESENCIAL (Mañanas en Uniaragua)` y `ONLINE (Tardes)`

### Escudo Validador (Formatear Respuesta)
- [ ] La función `sanitizeTimes()` existe y funciona
- [ ] Las validaciones de hora (solo [8,9,10,11,16,17]), fecha, nombre y agenda siguen intactas
- [ ] Los campos de salida para `bot_quality_logs` siguen presentes

### Nodos no modificados
- [ ] Los 20 nodos restantes (fuera de Cerebro IA, Formatear Agenda, y Formatear Respuesta) tienen parámetros IDÉNTICOS al archivo original

## Verification

Crear un script Python `verify_flow.py` que:
1. Cargue el JSON generado con `json.load()` y confirme que es válido
2. Cuente exactamente 23 nodos
3. Verifique que las conexiones son idénticas al archivo original
4. Verifique que el modelo es `models/gemini-3.6-flash`
5. Verifique que el prompt contiene las palabras clave de los ejemplos few-shot ("Un gusto saludarte", "quedamos atentos", "Eco Doppler Venoso para un diagnóstico completo")
6. Verifique que el prompt contiene `|||DATOS|||` y el template JSON
7. Verifique que el prompt contiene `[AGENDA_DISPONIBLE]`
8. Cuente las ocurrencias de "OBLIGATORIO" y "ESTRICTAMENTE" y falle si exceden los límites
9. Verifique que el código de Formatear Agenda contiene `[BLOQUEO]`, `SLOTS_PRESENCIAL`, `SLOTS_ONLINE`, `currentHourCaracas`
10. Verifique que Formatear Respuesta contiene `sanitizeTimes`, `has_quality_incident`
11. Compare los 20 nodos no modificados contra el original y falle si hay diferencias en sus parámetros
</USER_REQUEST>
