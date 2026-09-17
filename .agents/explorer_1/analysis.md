# Reporte de Análisis: Saneamiento y Robustecimiento del System Prompt (Paso 1)

**Proyecto:** Optimización del Flujo n8n Dr. Trejo WhatsApp  
**Nodo Analizado:** `Cerebro Inteligencia Artificial`  
**Archivo Principal:** `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`  
**Fecha:** 2026-07-26  
**Investigador:** Explorer 1  

---

## 1. Identificación del Nodo y Extracción del System Prompt

### 1.1 Ubicación en el Flujo n8n
- **Archivo:** `flujo asistente de whatsapp.json`
- **Índice del Nodo:** Nodo #9 (de un total de 21 nodos).
- **Nombre del Nodo:** `Cerebro Inteligencia Artificial`
- **Tipo de Nodo n8n:** `@n8n/n8n-nodes-langchain.googleGemini`
- **Modelo Configurado:** `models/gemini-3.1-flash-lite` (parámetro `modelId.value`)
- **Ubicación Interna del Prompt:** `parameters.messages.values[0].content`

### 1.2 Métricas de Tamaño y Tokens
- **Longitud total en caracteres:** 14,951 caracteres (~15 KB)
- **Conteo de palabras:** 2,395 palabras
- **Estimación de Tokens (Español, ~3.8 caracteres/token):** ~3,934 tokens por ejecución/mensaje.

---

## 2. Identificación de Secciones Duplicadas y Contradictorias ("Paso 4" y otros)

### 2.1 Duplicación Exacta del "Paso 4" (Líneas 95-103)
En el bloque `FLUJO DE VENTAS (Paso a Paso)`, se encuentran dos pasos numerados con el índice `4.` de forma consecutiva e inconsistente:

**Primer Paso 4 (Líneas 95-98):**
```text
4. HORAS EXACTAS (Cuando eligió mañana o tarde):
Da DOS opciones de horas disponibles. OBLIGATORIO: Las consultas duran 1 hora y debes ofrecer únicamente "HORAS EN PUNTO" (ej. 8:00 am, 9:00 am, 10:00 am). 
ESTÁ PROHIBIDO ofrecer horas intermedias como 8:30 o 9:30. Evita chocar con la agenda ocupada. Si a las 9:00 am hay una cita, solo puedes ofrecer las 8:00 am, 10:00 am u 11:00 am.
"Para ese día me queda un espacio a las [Hora en punto 1] y otro a las [Hora en punto 2], cuál te queda mejor?"
```

**Segundo Paso 4 (Líneas 100-103):**
```text
4. DAR HORAS EXACTAS (Cuando eligió mañana o tarde):
ANTES de ofrecer cualquier hora, ES OBLIGATORIO LEER LA [AGENDA_OCUPADA]. 
Da DOS opciones de horas EN PUNTO (ej. 8:00 am, 9:00 am). 
ESTÁ ESTRICTAMENTE PROHIBIDO ofrecer una hora si ya aparece ocupada en ese día, o si el día dice "TODO EL DIA" bloqueado. Si el día está bloqueado o lleno, discúlpate y ofrece el siguiente día hábil.
```

#### Problemas Detectados:
1. **Doble Encabezado:** El LLM recibe dos directivas separadas para el Paso 4 (`4. HORAS EXACTAS` vs `4. DAR HORAS EXACTAS`).
2. **Instrucciones Fragmentadas:** El primer bloque especifica la duración (1 hora), prohíbe medias horas (`8:30`, `9:30`) y da la plantilla conversacional. El segundo bloque impone la lectura obligatoria de `[AGENDA_OCUPADA]` y el manejo de días bloqueados ("TODO EL DIA").
3. **Efecto en el Modelo:** La fragmentación causa que la IA a veces aplique la plantilla sin validar la agenda ocupada, o valide la agenda pero olvide la prohibición de medias horas.

### 2.2 Otras Duplicaciones y Contradicciones Críticas en el Prompt
1. **Regla de Exámenes Previos Duplicada (Línea 27 vs Línea 76):**
   - El párrafo que prohíbe revisar ecos externos y exige Eco Doppler propio en consulta se repite textual e idéntico de 4 líneas tanto en `BASE DE CONOCIMIENTO PÚBLICA` (Línea 27) como al inicio del `FLUJO DE VENTAS` (Línea 76).
2. **Inconsistencia en Reagendamiento (Líneas 44-47 vs Línea 120):**
   - En Líneas 44-47 (`BLOQUEOS DE AGENDA`), se establece una política estricta del 50% de abono para reagendar y obliga a pasar a asistente humano (`requiere_asistencia_humana: "true"`).
   - En Línea 120 (`CANCELACIONES E INASISTENCIAS`), se indica: `- Cancelar o reagendar: responde amable, ofrece reagendar. Anota en resumen.`, contradiciendo la delegación obligatoria y el cobro del 50%.

---

## 3. Análisis de Especificación de Horarios (Horas en Punto `:00` vs Medias Horas `:30`)

### 3.1 Ocurrencias en el Prompt
- **Horas en Punto (`:00`):**
  - Línea 23: `Horario presencial: Lunes a Viernes de 8:00 am a 12:00 pm`.
  - Líneas 96, 102: Directiva obligatoria de `HORAS EN PUNTO (ej. 8:00 am, 9:00 am, 10:00 am)`.
- **Medias Horas (`:30`):**
  - Línea 24: `Horario online: EXCLUSIVAMENTE Lunes y Jueves en la tarde (después de las 3:30 pm).`
  - Línea 40: `Miércoles desde las 12:00 pm hasta las 3:30 pm: Prevaler.`
  - Línea 41: `Jueves desde las 12:00 pm hasta las 3:30 pm: Calicanto / Policlínica de Turmero.`
  - Línea 50: `REGLA DINÁMICA DE HORARIOS`: `...TARDE (desde 3:30pm, si no choca con bloqueos).`
  - Línea 97: Prohibición explícita de `8:30` o `9:30`.

### 3.2 Conflicto del Horario `3:30 pm`
- El prompt indica que las consultas duran 1 hora y deben ser **exclusivamente horas en punto** (`:00`). Prohíbe expressamente `8:30` y `9:30`.
- Sin embargo, para la jornada de la tarde u online, el prompt fija el inicio o fin de bloqueos a las `3:30 pm`.
- Si el bloqueo finaliza a las `3:30 pm` o la consulta online empieza "después de las `3:30 pm`", el modelo interpreta erróneamente que la primera cita de la tarde es a las **3:30 pm** o **4:30 pm**, violando su propia regla de `:00`.

### 3.3 Estrategia de Solución Estricta
1. **Estandarizar todas las referencias vespertinas a `:00`**:
   - Cambiar el horario online y de tarde a **"a partir de las 4:00 pm"** (ej. 4:00 pm, 5:00 pm).
   - Ajustar los bloqueos de miércoles y jueves para indicar que el doctor atiende presencial/online de tarde únicamente desde las 4:00 pm.
2. **Redactar la Regla Unificada de Horarios**:
   - *"Regla Estricta de Horas: TODAS las citas se agendan EXCLUSIVAMENTE en horas exactas en punto (8:00 am, 9:00 am, 10:00 am, 11:00 am para la mañana; 4:00 pm, 5:00 pm para la tarde). Queda ESTRICTAMENTE PROHIBIDO ofrecer o aceptar minutos/medias horas (tales como :15, :30, :45)."*

---

## 4. Análisis de la Lógica de Fin de Semana (Sábado y Domingo)

### 4.1 Estado Actual del Prompt (Líneas 43, 49-50, 93, 127)
- **Línea 43:** `- Sábados y Domingos: NO se agendan citas para fines de semana.`
- **Línea 49-50 (Código JS incrustado):**
  ```javascript
  if (dia === 0 || dia === 6) { 
    return 'HOY ES FIN DE SEMANA. Solo puedes ofrecer citas para la MAÑANA (8:00 am a 12:00 pm) de la próxima semana (lunes a viernes). Si el paciente INSISTE en la TARDE, NO se la des. Dile: Para el turno de la tarde necesitamos verificar disponibilidad, el lunes a primera hora nos comunicamos contigo para gestionarlo. Cuando hagas esto, llena requiere_asistencia_humana.'; 
  }
  ```
- **Línea 93:** `Si es fin de semana: NO ofrezcas tarde. Solo mañana.`
- **Línea 127:** `- Cita en la tarde durante fin de semana.` (exige delegación humana).

### 4.2 Evaluación de Problemas en Fin de Semana
1. **Falso Bloqueo de la Tarde:** Cuando un paciente escribe un sábado o domingo solicitando cita para la tarde de la semana entrante (ej. miércoles a las 4:00 pm), el bot se niega a agendar y dispara `requiere_asistencia_humana = "true"`.
2. **Innecesaria Carga Humana:** Dado que la variable `[AGENDA_OCUPADA]` contiene la disponibilidad real de la semana entrante, el bot TIENE la información necesaria para agendar turnos de tarde válidos (ej. lunes o jueves en la tarde). Mandar a estos pacientes a espera hasta el lunes genera fricción y riesgo de abandono.
3. **Confusión entre "Día de Cita" y "Día de Mensaje":** La regla original se diseñó para evitar agendar citas *el mismo fin de semana*, pero se implementó prohibiendo al bot agendar *turnos de tarde* cuando la interacción ocurre en fin de semana.

### 4.3 Propuesta de Lógica de Fin de Semana Robusta
- **Permitir Agendamiento Completo para la Semana Siguiente:** Durante el fin de semana (sábado/domingo), el bot puede ofrecer y agendar citas para la semana entrante (lunes a viernes) TANTO en la mañana (8:00 am - 12:00 pm) COMO en la tarde (4:00 pm - 6:00 pm en días permitidos).
- **Mantener Prohibición de Citas Fines de Semana:** No agendar consultas los días sábado o domingo.
- **Delegación Humana:** Solo requerir asistencia humana si el paciente exige una consulta de emergencia en fin de semana o si no hay disponibilidad en la agenda.

---

## 5. Token Usage, Tamaño del Prompt y Reducción de Redundancias

### 5.1 Desglose de Redundancias
| Elemento Redundante | Ubicación | Impacto Aprox. | Solución |
|---|---|---|---|
| **Doble Paso 4** | Líneas 95-98 y 100-103 | ~500 caracteres (~130 tokens) | Fusionar en un único Paso 4 claro. |
| **Doble Exámenes Previos** | Líneas 27 y 76 | ~350 caracteres (~90 tokens) | Mantener solo en Base de Conocimiento. |
| **Explicaciones Largas de Modales** | Líneas 34-35, 60-64 | ~1,200 caracteres (~310 tokens) | Condensar reglas estilo/disponibilidad. |
| **Plantillas de Reagendamiento** | Líneas 44-47 | ~450 caracteres (~120 tokens) | Simplificar directiva de abono 50%. |
| **Formateo JSON n8n complejo** | Líneas 140-143 | ~300 caracteres (~80 tokens) | Simplificar bloque |||DATOS|||. |

### 5.2 Potencial de Compactación
- **Prompt Actual:** 14,951 caracteres (~3,934 tokens).
- **Prompt Optimizado Estimado:** ~6,500 caracteres (~1,750 tokens).
- **Ahorro Estimado:** **~55% de tokens por petición**, reduciendo latencia y costos de API de Gemini, además de prevenir desvíos de instrucciones (instruction drift).

---

## 6. Conclusión y Recomendaciones para la Fase de Implementación (Paso 1)

1. **Unificar Paso 4:** Crear una sección `4. HORAS EXACTAS` que combine la validación de `[AGENDA_OCUPADA]`, el ofrecimiento de 2 opciones de horas en punto y la prohibición estricta de minutos/medias horas.
2. **Eliminar `:30` del Prompt:** Reemplazar todas las menciones a `3:30 pm` por `4:00 pm` para los turnos vespertinos.
3. **Liberar Agendamiento Vespertino en Fin de Semana:** Permitir que los pacientes que escriben sábados y domingos agenden citas para la tarde de la semana entrante según disponibilidad en `AGENDA_OCUPADA`.
4. **Compactar Prompt:** Eliminar párrafos duplicados y simplificar reglas de estilo para reducir el consumo a ~1,750 tokens manteniendo un tono humano cálido y profesional.
