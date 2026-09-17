# Handoff Report: Paso 4 — Estructuración del Ciclo de Autoaprendizaje Asincrónico (`bot_quality_logs`)

## 1. Observation
- **Workflow File**: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`
- **Key Nodes Examined**:
  - `Recibir WhatsApp` (Line 17)
  - `¿Lo envió el paciente?` (Line 714) -> `Apagar Bot (Silenciador)` (Line 745)
  - `Refrescar Datos de Supabase` (Line 262)
  - `¿El Bot está Autorizado?` (Line 659)
  - `Formatear Agenda` (Line 830)
  - `Cerebro Inteligencia Artificial` (Line 324)
  - `Formatear Respuesta` (Line 346) — Pre-send Validator Shield node
  - `Guardar Resumen en Supabase` (Line 560)
  - `Respaldar en Google Sheets` (Line 481)
  - `Enviar Mensaje de WhatsApp` (Line 605)
- **Current Connection Topology**:
  - `connections["Formatear Respuesta"].main[0]` (Lines 952-967) connects in parallel to `Guardar Resumen en Supabase` and `Respaldar en Google Sheets`.
  - `Guardar Resumen en Supabase` (Lines 968-977) connects to `Enviar Mensaje de WhatsApp`.
  - `¿Lo envió el paciente?` (Lines 990-1006) output 1 connects to `Apagar Bot (Silenciador)`.
- **Pre-send Validator Shield Logic**:
  - `Formatear Respuesta` executes local JS validating appointment dates/hours, patient name existence, and cross-checking against `Formatear Agenda`.
  - Currently, when an invalid hour/date is hallucinated by Gemini, `Formatear Respuesta` nullifies the fields (`dia_cita = ""`, `hora_cita = ""`), but does not persist telemetry logs to Supabase.

---

## 2. Logic Chain
1. **Observation**: Gemini AI responses are formatted and validated deterministically inside the local JS Code node `Formatear Respuesta` (Line 346) immediately following `Cerebro Inteligencia Artificial` (Line 324).
2. **Reasoning Step 1**: Since `Formatear Respuesta` parses raw AI output (`fullResponse`), evaluates JSON validity, checks human alert flags (`requiere_asistencia_humana`), and applies 5 deterministic time/availability filters, it is the exact place where all AI quality anomalies and corrections are discovered in real time.
3. **Reasoning Step 2**: Performing quality classification inside `Formatear Respuesta` using local JavaScript code executes in sub-milliseconds and consumes **0 AI tokens**, satisfying the zero token cost constraint.
4. **Observation**: `connections["Formatear Respuesta"]` currently branches to `Guardar Resumen en Supabase` and `Respaldar en Google Sheets` (Lines 952-967).
5. **Reasoning Step 3**: Adding a 3rd parallel connection from `Formatear Respuesta` to an IF node `¿Hay Incidencia de Calidad?` (checking `quality_log.incidencia_detectada === true`) -> `Registrar en bot_quality_logs` ensures async, non-blocking telemetry logging. WhatsApp message delivery via `Enviar Mensaje de WhatsApp` remains completely isolated from database telemetry I/O.
6. **Observation**: When a human doctor sends a message, `¿Lo envió el paciente?` (Line 714) routes to `Apagar Bot (Silenciador)` (Line 745).
7. **Reasoning Step 4**: Connecting an async log insert for `tipo_incidencia = 'TAKEOVER_DOCTOR'` post-`Apagar Bot (Silenciador)` captures doctor intervention events for the auto-learning dataset.
8. **Conclusion**: The complete architecture for Paso 4 requires defining Supabase table `bot_quality_logs`, extending `Formatear Respuesta` to return a `quality_log` object (0 tokens), and connecting an async parallel Supabase insert node in n8n.

---

## 3. Caveats
- **No Direct Workflow Mutation in Explorer Phase**: As per Explorer constraints, no direct modifications to `flujo asistente de whatsapp.json` or Supabase schemas were applied during this investigation. Implementation is delegated to the Worker agent.
- **Supabase Credentials & Permissions**: The Supabase connection credential (`Supabase account`) must have SQL `INSERT` permissions on table `bot_quality_logs`.
- **Nightly Learning Job Scope**: The nightly batch auto-learning script/cronjob is an offline consumer of `bot_quality_logs` and is decoupled from the main n8n workflow execution.

---

## 4. Conclusion
The architecture for Paso 4 — Estructuración del Ciclo de Autoaprendizaje Asincrónico (`bot_quality_logs`) is fully specified:
1. **Recording Points**:
   - `Formatear Respuesta` (Pre-send Validator Shield): Detects `ALERTA_ASISTENCIA_HUMANA`, `HORARIO_ALUCINADO_CORREGIDO`, `FECHA_PASADA_O_FIN_DE_SEMANA`, `CITA_SIN_NOMBRE_PACIENTE`, `HORARIO_NO_DISPONIBLE`, `PARSEO_JSON_FALLIDO`, and `MUTE_IA`.
   - `Apagar Bot (Silenciador)`: Detects `TAKEOVER_DOCTOR`.
2. **0 Token Telemetry**: 100% deterministic detection in local JS inside `Formatear Respuesta`.
3. **Async Topology**: 3rd parallel output branch from `Formatear Respuesta` -> IF `¿Hay Incidencia de Calidad?` -> `Registrar en bot_quality_logs` (Supabase Insert node).
4. **Database Table**: `bot_quality_logs` SQL schema created with performance indexes on `fecha_registro`, `tipo_incidencia`, and `revisado_batch`.

---

## 5. Verification Method
- **File Inspection**:
  - Inspect `c:\Users\Leor\Desktop\bot whatsapp\.agents\explorer_4_1\analysis.md` for full schema SQL, JavaScript detection snippet, and n8n node topology design.
  - Verify line numbers 346 (`Formatear Respuesta`), 830 (`Formatear Agenda`), and 952-967 (`connections`) in `flujo asistente de whatsapp.json`.
- **Invalidation Conditions**:
  - If quality logging requires calling an LLM at runtime, the zero-token cost constraint is violated.
  - If quality logging is placed synchronously in series before `Enviar Mensaje de WhatsApp`, failure in logging would block WhatsApp message delivery (violating non-blocking async architecture).
