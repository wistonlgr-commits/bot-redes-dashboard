# Review Report — Paso 3 (Escudo Validador Pre-Envío)

**Node Target**: `Formatear Respuesta` (ID: `8fd94881-ca56-4855-8462-ef0109762964`)  
**File**: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`  
**Reviewer**: Reviewer 3_1  
**Verdict**: **REQUEST_CHANGES**

---

## Review Summary

The implementation of **Paso 3 (Escudo Validador Pre-Envío)** in node `Formatear Respuesta` correctly satisfies core criteria regarding output contract completeness, `:30` -> `:00` time normalization, markdown/JSON tag cleaning, and baseline fallback triggers.

However, adversarial stress testing revealed **two (2) Major logical flaws** that degrade system robustness in production:
1. **Destruction of Valid Short AI Responses**: The recursive `findText` function ignores any string of length $\le 15$ characters (e.g., `"¡Hola! Claro."`, `"¡Con gusto!"`, `"Muchas gracias."`), causing valid short Gemini responses to be falsely classified as empty/null outputs and overwritten by the deterministic fallback.
2. **Flawed `NO LABORABLE` Day Checking**: In the agenda validation module, `else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad'))` checks `if (!dayLine.includes(hora_final))`. If the string representation of a non-working day line includes the hour (e.g., `"2026-08-05: 10:00 NO LABORABLE"` or `"2026-08-05: NO LABORABLE - 10:00 no disponible"`), the condition evaluates to `false` and bypasses appointment cancellation, allowing appointments on non-working days.

---

## Verification Criteria Assessment

### 1. Saneamiento de Horarios `:30` -> `:00` in both `bot_reply` text and `hora_cita` metadata
- **Status**: **PASS**
- **Findings**:
  - `bot_reply`: `sanitizeTimes(text)` correctly applies regex replacement for half-hour and fractional times (`:15`, `:20`, `:30`, `:45`, and `"X y media"`) converting them to sharp hours (`:00`).
  - `hora_cita` metadata: First sanitized via `sanitizeTimes(hora_final)`, then validated against allowed slots `[8, 9, 10, 11, 16, 17]`. Valid sharp hours are formatted as `HH:00` (padded). Invalid slots trigger `alerta_final` and reset appointment fields.

### 2. Sanitization of Weekend Dates / Unauthorized Appointment References
- **Status**: **PASS WITH CAVEATS**
- **Findings**:
  - **Weekend dates**: When `dia_final` corresponds to Saturday (`dayOfWeek === 6`) or Sunday (`dayOfWeek === 0`), `dia_final` and `hora_cita` are reset to `""`, `alerta_final` is populated with `"Alucinación de IA: Intentó agendar en fin de semana (sábado/domingo)."`, and verbal references (`sábado`, `sabado`, `domingo`) in `botMsg` are replaced with `'el lunes'`.
  - **Unauthorized hours**: Hours outside `[8, 9, 10, 11, 16, 17]` (e.g. `12:00`, `14:00`, `15:00`) properly invalidate appointment metadata and generate a human assistance alert.
  - **Caveat**: If Gemini generates verbal weekend references in `botMsg` without populating `dia_cita` in the JSON metadata, the weekend sanitization block (line 180 `if (dia_final && dia_final.trim() !== "")`) is bypassed, leaving the verbal reference in `botMsg`.

### 3. Clean Handling of Markdown, Double Curly Braces `{{ }}`, and `|||DATOS|||` Tags
- **Status**: **PASS**
- **Findings**:
  - `|||DATOS|||`: Metadata extraction splits `fullResponse` on `|||DATOS|||`. A final regex sweep (`botMsg.replace(/\|\|\|DATOS\|\|\|.*/gs, '').trim()`) removes any lingering tags or trailing metadata block.
  - Double curly braces: Cleaned from `jsonStr` during JSON parsing and stripped from `botMsg` (`botMsg.replace(/\{\{/g, '').replace(/\}\}/g, '').trim()`).
  - Markdown code blocks: Stripped from JSON string via `replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()`.

### 4. Friendly Deterministic Fallback when Gemini Output is Empty/Null (0 Tokens)
- **Status**: **FAIL (Major Finding)**
- **Findings**:
  - Standard empty/null case (`$json` missing text): Successfully falls back to `"Hola! Disculpa la demora, ¿en qué te podemos ayudar el día de hoy?"` and sets `requiere_asistencia_humana = "Respuesta de IA vacía - Fallback determinista activado"`.
  - **Major Flaw**: `findText(obj, depth)` uses `if (typeof obj === 'string' && obj.length > 15) return obj;`. Any string $\le 15$ characters is ignored by `findText`, returning `""`. This causes valid short AI responses to trigger the fallback erroneously.

### 5. Output Object Contract Completeness (11 Expected Fields)
- **Status**: **PASS**
- **Findings**:
  - Output contract is strictly maintained. The return statement returns an object with exactly 11 fields:
    1. `final_history` (Array)
    2. `bot_reply` (String)
    3. `delay` (Number)
    4. `nombre` (String)
    5. `ciudad` (String)
    6. `motivo_consulta` (String)
    7. `temperatura` (String)
    8. `resumen` (String)
    9. `dia_cita` (String)
    10. `hora_cita` (String)
    11. `requiere_asistencia_humana` (String)

---

## Detailed Findings & Actionable Suggestions

### [Major] Finding 1: Short Valid AI Responses Destroyed by `findText` Threshold
- **Where**: `target_code.js`, Line 19 (`findText` function)
- **Why**: `if (typeof obj === 'string' && obj.length > 15) return obj;` discards any response of 1 to 15 characters.
- **Example Scenario**: Gemini responds `"¡Hola! Claro."` (13 chars). `findText` returns `""`, setting `wasEmptyResponse = true`. The user receives the generic fallback `"Hola! Disculpa la demora..."` and human assistance alert is logged.
- **Suggestion**: Instead of checking `obj.length > 15`, filter out structural n8n metadata keys/properties or lower/remove the length constraint when inspecting output text fields.

### [Major] Finding 2: Logic Bypass in `NO LABORABLE` Agenda Check
- **Where**: `target_code.js`, Lines 219–224
- **Why**:
  ```javascript
  } else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad')) {
    if (!dayLine.includes(hora_final)) {
      if (!alerta_final) alerta_final = `Día ${dia_final} no laborable o sin cupo.`;
      dia_final = "";
      hora_final = "";
    }
  }
  ```
  If `dayLine` contains `'NO LABORABLE'`, checking `if (!dayLine.includes(hora_final))` is inverted. If `hora_final` appears anywhere in `dayLine`, `!dayLine.includes(hora_final)` evaluates to `false`, leaving `dia_final` and `hora_final` VALID.
- **Suggestion**: A non-working day (`NO LABORABLE`) should unconditionally invalidate any appointment:
  ```javascript
  } else if (dayLine.includes('NO LABORABLE') || dayLine.includes('Sin disponibilidad')) {
    if (!alerta_final) alerta_final = `Día ${dia_final} no laborable o sin cupo.`;
    dia_final = "";
    hora_final = "";
  }
  ```

### [Minor] Finding 3: Verbal Weekend Hallucinations Unsanitized when `dia_cita` is Empty
- **Where**: `target_code.js`, Line 180
- **Why**: Weekend text replacement (`botMsg.replace(...)`) is inside `if (dia_final && dia_final.trim() !== "")`. If Gemini mentions `"Te espero el sábado"` in text but omits `dia_cita` in JSON, the verbal reference remains unchanged.
- **Suggestion**: Move the verbal weekend reference replacement function outside the `if (dia_final)` block, or run a global pre-cleaning pass on `botMsg`.

---

## Verified Claims Matrix

| Claim / Requirement | Verification Method | Status | Notes |
|---|---|---|---|
| 1. Saneamiento :30 -> :00 | Execution in python test harness (`test_suite.py`) | PASS | Transforms `:30`, `:15`, `:45`, and `"y media"` to `:00` |
| 2. Weekend & Invalid Hours | Execution in python test harness (`test_suite.py`) | PASS (with caveats) | Sat/Sun & non-working hours invalidated |
| 3. Markdown / {{ }} / DATOS | Regex pattern analysis & test execution | PASS | Removes `|||DATOS|||`, `{{ }}`, and ```json blocks |
| 4. Empty Response Fallback | Execution with empty string input | FAIL (Major) | Works for empty, but breaks short responses $\le 15$ chars |
| 5. 11 Output Fields Contract | Key enumeration on returned object | PASS | Exactly 11 keys present and typed |
