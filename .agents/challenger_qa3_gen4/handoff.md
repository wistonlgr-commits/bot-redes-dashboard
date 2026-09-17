# Empirical Challenge & Verification Handoff Report: QA 3 (Simulación Integral de Escenarios y Casos Borde)

## Attack Surface

### Hypotheses Tested
1. **Scenario (a)**: Patient messaging on Sunday requesting an afternoon appointment (evaluating Sunday logic, weekend block, and Monday/Wednesday afternoon slot availability).
2. **Scenario (b)**: Patient asking for an appointment at 12:30 (evaluating minute sanitization and forbidden hour containment `validHours = [8, 9, 10, 11, 16, 17]`).
3. **Scenario (c)**: Returning patient who already has a scheduled appointment (Gold Rule check for existing appointments).
4. **Edge Case 1**: Missing patient name when attempting to book an appointment.
5. **Edge Case 2**: Past date appointment attempt (`dia_cita < todayStr`).
6. **Edge Case 3**: Friday afternoon appointment request (16:00 on Friday, which is blocked/non-working).
7. **Edge Case 4**: Empty AI output response from LLM (`content: ""`).

### Vulnerabilities Found
- **CRITICAL CONFLICT BUG IN SCENARIO (C)**: When a returning patient with an existing appointment (e.g. `2026-07-29 at 09:00`) writes to confirm their appointment, `Formatear Agenda` removes `09:00` from `agenda_disponible` (because it's already booked in Supabase). When the LLM follows the Gold Rule and emits `dia_cita: "2026-07-29"`, `hora_cita: "09:00"`, the Pre-send Validator Shield in `Formatear Respuesta` cross-checks `agenda_disponible` and finds that `09:00` is missing from the available list! It flags `FECHA_NO_DISPONIBLE`, sets `alerta_final = "Hora 09:00 no disponible para el 2026-07-29."`, and **ERASES `dia_final` and `hora_final` to `""`**, effectively deleting the patient's existing appointment from Supabase upon next update!

### Untested Angles
- Live Supabase database network connectivity (simulated deterministically via input JSON matching node schema).

---

## Challenge Summary

**Overall risk assessment**: **HIGH** (3 out of 3 primary scenarios pass validation containment, but 1 CRITICAL flaw was empirically discovered where returning patients' appointments are erased from the DB due to validator cross-check conflict).

---

## 1. Observation

Direct code analysis of `flujo asistente de whatsapp.json`:

1. **`Formatear Agenda`** (Lines 908–920):
   ```javascript
   // Descontar citas registradas en Supabase
   const ocupadas = ocupacionSupabase[dateStr] || new Set();
   const dispManana = candManana.filter(h => !ocupadas.has(h));
   const dispTarde = candTarde.filter(h => !ocupadas.has(h));
   ```
   *Observation*: Any slot present in Supabase for `dateStr` is removed from `dispManana` / `dispTarde` and will NOT appear in `agenda_disponible`.

2. **`Cerebro Inteligencia Artificial`** (Lines 301–334):
   - Gold Rule instructions:
     ```text
     REGLA DE ORO SI YA TIENE CITA:
     Si el paciente ya tiene Cita Programada (que no sea Ninguna), ESA HORA ES SUYA. No le digas que está ocupada. No le agendes una nueva. Si confirma: "Hola [Nombre]! Si, tu cita es el [Día] a las [Hora]. Te esperamos!"
     ```

3. **`Formatear Respuesta` (Pre-send Validator Shield)** (Lines 335–347):
   - Cross-check against `agenda_disponible` (Lines 419–427):
     ```javascript
     const agendaTxt = ($node["Formatear Agenda"] && $node["Formatear Agenda"].json && $node["Formatear Agenda"].json.agenda_disponible) || "";
     if (dia_final && hora_final && agendaTxt) {
       const lines = agendaTxt.toString().split('\n');
       const dayLine = lines.find(l => l.includes(dia_final));
       if (!dayLine.includes(hora_final)) {
         if (!alerta_final) alerta_final = `Hora ${hora_final} no disponible para el ${dia_final}.`;
         if (!detectedIncidentType) detectedIncidentType = "FECHA_NO_DISPONIBLE";
         dia_final = "";
         hora_final = "";
       }
     }
     ```
   - Database Update node `Guardar Resumen en Supabase` (Lines 619–625):
     ```json
     {"fieldId": "Dia_Cita", "fieldValue": "={{ $json.dia_cita }}"},
     {"fieldId": "Hora_Cita", "fieldValue": "={{ $json.hora_cita }}"}
     ```

---

## 2. Logic Chain

1. **Scenario (a) - Sunday Request**:
   - `Formatear Agenda` outputs `2026-07-26 (Fin de semana): NO LABORABLE`.
   - Monday afternoon is blocked (`TARDE DISPONIBLE: [Sin disponibilidad]`).
   - Wednesday afternoon `2026-07-29` is available (`TARDE DISPONIBLE: [16:00, 17:00]`).
   - If AI tries Sunday -> Pre-send Validator catches `ALUCINACION_FIN_DE_SEMANA`, clears appointment fields, rewrites Sunday references to Monday.
   - If AI tries Monday afternoon -> Pre-send Validator catches `FECHA_NO_DISPONIBLE`, clears appointment fields.
   - Wednesday 16:00 -> Passes all validation checks cleanly.

2. **Scenario (b) - Request at 12:30**:
   - `sanitizeTimes` converts `12:30` to `12:00`.
   - `validHours = [8, 9, 10, 11, 16, 17]`. Hour `12` is not valid.
   - Pre-send Validator Shield triggers `ALUCINACION_HORARIO`, sets `alerta_final = "Horario no permitido detectado (12:00). Cita anulada para verificación manual."`, clears `dia_cita` and `hora_cita`.

3. **Scenario (c) - Gold Rule Check (Returning Patient)**:
   - Patient "Carlos Perez" has existing appointment: `2026-07-29` at `09:00`.
   - `Formatear Agenda` registers `09:00` as occupied, producing line: `- 2026-07-29: MAÑANA DISPONIBLE: [08:00, 10:00, 11:00] | TARDE DISPONIBLE: [16:00, 17:00]`.
   - LLM follows Gold Rule and outputs `dia_cita: "2026-07-29"`, `hora_cita: "09:00"`.
   - `Formatear Respuesta` checks if line `- 2026-07-29: ...` contains `"09:00"`. It does NOT contain `"09:00"`.
   - Pre-send Validator Shield flags `FECHA_NO_DISPONIBLE`, sets `alerta_final = "Hora 09:00 no disponible para el 2026-07-29."`, and **sets `dia_final = ""` and `hora_final = ""`**.
   - `Guardar Resumen en Supabase` writes `Dia_Cita = ""` and `Hora_Cita = ""`, deleting Carlos's appointment!

4. **Additional Edge Cases**:
   - Missing name: `AGENDAMIENTO_SIN_NOMBRE` triggered -> appointment canceled.
   - Past date: `ALUCINACION_FECHA_PASADA` triggered -> appointment canceled.
   - Friday afternoon: `FECHA_NO_DISPONIBLE` triggered -> appointment canceled.
   - Empty AI output: `RESPUESTA_VACIA_FALLBACK` triggered -> fallback message sent, incident logged.

---

## 3. Stress Test Results

| Test Case | Scenario / Edge Case | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| 1 | Scenario (a.1): Sunday request for Sunday 16:00 | Intercept Sunday booking, clear fields | Triggered `ALUCINACION_FIN_DE_SEMANA`, cleared fields | **PASS** |
| 2 | Scenario (a.2): Sunday request for Monday 16:00 | Intercept blocked Monday afternoon | Triggered `FECHA_NO_DISPONIBLE`, cleared fields | **PASS** |
| 3 | Scenario (a.3): Sunday request for Wed 16:00 | Allow valid first afternoon slot | `dia_cita: 2026-07-29`, `hora_cita: 16:00` | **PASS** |
| 4 | Scenario (b): Request for 12:30 | Intercept 12:30 / 12:00 invalid slot | Triggered `ALUCINACION_HORARIO`, cleared fields | **PASS** |
| 5 | Scenario (c): Gold Rule check for returning patient | Preserve existing appointment (2026-07-29 09:00) | **CRITICAL BUG**: Triggered `FECHA_NO_DISPONIBLE` and erased appointment to `""` | **FAIL (BUG DETECTED)** |
| 6 | Edge Case 1: Missing patient name | Block booking without name | Triggered `AGENDAMIENTO_SIN_NOMBRE`, cleared fields | **PASS** |
| 7 | Edge Case 2: Past date (2026-07-20) | Block past date booking | Triggered `ALUCINACION_FECHA_PASADA`, cleared fields | **PASS** |
| 8 | Edge Case 3: Friday afternoon (16:00) | Block Friday afternoon booking | Triggered `FECHA_NO_DISPONIBLE`, cleared fields | **PASS** |
| 9 | Edge Case 4: Empty AI output | Trigger deterministic fallback | Triggered `RESPUESTA_VACIA_FALLBACK`, sent fallback msg | **PASS** |

---

## 4. Caveats

- Node execution was evaluated via a standalone empirical JS test harness (`test_harness.js`) using the exact JavaScript source code from `flujo asistente de whatsapp.json`.
- Live Gemini API outputs may vary in natural language phrasing, but the pre-send validator shield logic is 100% deterministic code.

---

## 5. Conclusion & Actionable Fix

The Pre-send Validator Shield in `flujo asistente de whatsapp.json` is highly effective at stopping invalid dates, weekend hallucinations, illegal times, missing names, and empty responses.

However, **Scenario (c) contains a Critical Flaw**:
Existing appointments confirmed by returning patients are deleted from Supabase because `Formatear Agenda` removes occupied slots from `agenda_disponible`, causing `Formatear Respuesta` to fail the slot existence check.

### Proposed Code Mitigation for `Formatear Respuesta`:
Before checking `!dayLine.includes(hora_final)`, verify if the appointment matches the patient's existing appointment in `prevData`:
```javascript
// Bypass availability check if patient is confirming their own pre-existing appointment (Gold Rule)
const isExistingPatientOwnAppointment = (prevData.Dia_Cita === dia_final && prevData.Hora_Cita === hora_final);

if (!isExistingPatientOwnAppointment && !dayLine.includes(hora_final)) {
  if (!alerta_final) alerta_final = `Hora ${hora_final} no disponible para el ${dia_final}.`;
  if (!detectedIncidentType) detectedIncidentType = "FECHA_NO_DISPONIBLE";
  dia_final = "";
  hora_final = "";
}
```

---

## 6. Verification Method

To verify these results independently:
1. File: `c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_qa3_gen4\test_harness.js`
2. Log file: `c:\Users\Leor\Desktop\bot whatsapp\.agents\challenger_qa3_gen4\test_results.log`
3. Run command: `node .agents/challenger_qa3_gen4/test_harness.js`
4. Invalidation condition: If `SCENARIO_C_GOLD_RULE_EXISTING_APPOINTMENT` retains `dia_cita: "2026-07-29"` without triggering `FECHA_NO_DISPONIBLE`, the bug has been fixed.
