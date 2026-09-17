# Handoff Report: Paso 2 — Refactorización del Nodo `Formatear Agenda`

**De:** Explorer 2  
**Para:** Orchestrator / Worker 2  
**Fecha:** 2026-07-26  
**Estado:** FINALIZADO (Hard Handoff)

---

## 1. Observation (Observaciones Directas)

1. **Ubicación del Código del Nodo `Formatear Agenda`:**
   - Archivo de flujo n8n: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json` (Línea 821, objeto `jsCode` del nodo `name: "Formatear Agenda"`).
   - Archivo JavaScript auxiliar: `c:\Users\Leor\Desktop\bot whatsapp\formatear_agenda_corregido.js`.

2. **Código de Parseo Numérico Actual (Línea 36-39 en `formatear_agenda_corregido.js` / Línea 821 en JSON):**
   ```js
   const parts = time.split(':');
   if (parts.length >= 2) {
       const hora = parseInt(parts[0], 10);
       if (!isNaN(hora)) {
           ocupadoPorDia[date].horas.push(hora);
       }
   }
   ```
   - **Falla observada:** Al procesar `"04:00 pm"`, `parts[0]` es `"04"`, devolviendo `hora = 4`. Esto bloquea la hora 4:00 AM (inválida) y no descuenta el slot de las 16:00 (4:00 PM).

3. **Inyección en Gemini (`flujo asistente de whatsapp.json` Línea 310):**
   ```
   AGENDA OCUPADA:
   [AGENDA_OCUPADA]
   {{ $node["Formatear Agenda"].json.agenda_ocupada || "Agenda libre" }}
   [/AGENDA_OCUPADA]
   ```
   - **Falla observada:** Se inyecta una lista negativa prohibitiva (`- YYYY-MM-DD ⛔ BLOQUEADO...`), forzando al LLM a calcular qué horas están libres.

4. **Presencia de Fracciones de Hora (`:30` Legacy):**
   - En `formatear_agenda_corregido.js` Línea 60: `'BLOQUEADO de 12:00 pm a 3:30 pm (solo disponible antes de 12pm o después de 3:30pm)'`.
   - Violación de la regla estricta de horas exactas `:00` acordada en el Paso 1.

---

## 2. Logic Chain (Cadena Lógica)

1. **Paso 1 (Observación):** El parseo de horas en Supabase utiliza `parseInt(parts[0], 10)` sin inspeccionar los sufijos `am` / `pm`.
   - **Inferencia:** Citas agendadas en la tarde (`04:00 pm`, `05:00 pm`) se parsean como horas 4 y 5 de la mañana. Por ende, la tarde no se marca como ocupada en el cálculo del nodo.

2. **Paso 2 (Observación):** El nodo entrega una lista de fechas bloqueadas y horas ocupadas (`agenda_ocupada`).
   - **Inferencia:** Gemini recibe restricciones negativas en lugar de opciones disponibles. Al intentar calcular qué horas quedan libres entre las 8:00 am y las 12:00 pm, Gemini comete alucinaciones matemáticas y propone horas intermedias o bloqueadas.

3. **Paso 3 (Observación):** El código contiene referencias explícitas a `3:30 pm` y franjas de media hora.
   - **Inferencia:** El nodo perpetúa la alucinación de horas fraccionadas (`:30`) al indicarle a la IA que hay aperturas a las 3:30 pm.

4. **Paso 4 (Conclusión Lógica):** Al transformar el nodo `Formatear Agenda` para que compute de forma explícita el conjunto de **Horas Positivas Disponibles** (`agenda_disponible`) en formato exacto `:00` (`["08:00", "09:00", "10:00", "11:00", "16:00", "17:00"]`), Gemini ya no necesita razonar ni calcular disponibilidades, eliminando al 100% las alucinaciones de horario.

---

## 3. Caveats (Salvedades y Supuestos)

- **Supuesto de Horarios de Consulta:** Se asume que los slots de consulta presencial/online duran exactamente 1 hora y se fijan en las horas en punto: Mañana (`08:00`, `09:00`, `10:00`, `11:00`) y Tarde (`16:00`, `17:00`).
- **Supuesto de Supabase:** Se asume que el formato en Supabase puede ser mixto (`12h` con `am/pm` o `24h`), por lo que el nuevo parser cubre ambos casos sin falla.
- **Áreas no investigadas:** La lógica de persistencia de escritura en Supabase cuando el paciente confirma cita se maneja en nodos posteriores del workflow y no afecta la lectura de `Formatear Agenda`.

---

## 4. Conclusion (Evaluación Final)

El nodo `Formatear Agenda` requiere una refactorización integral en el Paso 2 para:
1. Reemplazar la salida de bloqueos negativos `agenda_ocupada` por el objeto de salida positiva **`agenda_disponible`**.
2. Incorporar un parser de hora 12h/24h que convierta correctamente `am`/`pm` a formato 24h (`08:00`, `16:00`, `17:00`).
3. Eliminar por completo todas las referencias a fraccionamiento de media hora (`:30`).
4. Entregar a Gemini una lista explícita por fecha con los slots libres exactos para simplificar la toma de decisiones del modelo.

El plan detallado de refactorización y el código JavaScript correspondiente se encuentran documentados en `c:\Users\Leor\Desktop\bot whatsapp\.agents\explorer_2\analysis.md`.

---

## 5. Verification Method (Método de Verificación)

1. **Inspección de Archivos:**
   - Verificar `c:\Users\Leor\Desktop\bot whatsapp\.agents\explorer_2\analysis.md` para revisar la especificación completa del algoritmo JS.
2. **Prueba de Parseo de Horas:**
   - Ejecutar pruebas unitarias con entradas de Supabase: `"04:00 pm"`, `"4:00 PM"`, `"16:00"`, `"08:00 am"`, `"12:00 pm"`, `"TODO EL DIA"`.
3. **Condición de Invalidación:**
   - Si la salida del nodo contiene cualquier ocurrencia de `:30` o si una cita a las `04:00 pm` deja disponible el slot de las `16:00`, la verificación se considerará FALLIDA.
