# Adversarial Challenge Report — Paso 1 System Prompt Verification

**Target File**: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`  
**Target Node**: Node #9 (`Cerebro Inteligencia Artificial`, ID: `8214de70-11ae-4afb-8049-f5527562c61b`)  
**Date**: 2026-07-26  
**Overall Risk Assessment**: **MEDIUM**

---

## Executive Summary

An empirical adversarial audit was conducted on the Paso 1 system prompt embedded within Node #9 of `flujo asistente de whatsapp.json`. The system prompt contains 7,074 decoded characters (7,358 raw JSON characters) across 124 lines. The audit verified character limits, step numbering consistency, forbidden string occurrences, JSON template syntax, and dynamic weekend/timezone logic.

While the prompt structure and JSON schema alignment with the downstream `Formatear Respuesta` node are generally solid, four concrete risk areas and edge-case failure modes were identified.

---

## Summary of Empirical Verification Tests

| Test Category | Requirement | Result / Empirical Finding | Status |
|---|---|---|---|
| **Node Identification** | Locate Node #9 in workflow | Index 9: `Cerebro Inteligencia Artificial` (ID: `8214de70-11ae-4afb-8049-f5527562c61b`) | PASS |
| **Character Count** | Measure total character length | **7,074 characters** (decoded string) / **7,358 characters** (raw JSON string) | PASS |
| **Forbidden `:30` Search** | Search for `:30` occurrences | **3 occurrences** found in Step 4: `8:30 am`, `9:30 am`, `3:30 pm` (used as negative examples) | WARNING |
| **Step Hierarchy (`4.`)** | Count `4.` step occurrences | **1 occurrence**: `4. HORAS EXACTAS (Cuando eligió mañana o tarde):` | PASS |
| **JSON Template Syntax** | Validate `|||DATOS|||` block | Valid template emitting `{{` and `}}` via `String.fromCharCode(123, 123)`. All 8 fields match downstream parser | PASS |
| **Weekend & Timezone Logic** | Evaluate JS expression and wording | Potential JS date parsing ambiguity in V8 and Friday evening transition conflict | WARNING |

---

## Detailed Challenges & Vulnerability Analysis

### [Medium] Challenge 1: Presence of Forbidden `:30` Strings in Context Prompt
- **Assumption Challenged**: Negative examples prevent the LLM from outputting half-hour slots (`:30`).
- **Attack Scenario**: In Step 4 (`HORAS EXACTAS`), the prompt states:
  > `ESTÁ ESTRICTAMENTE PROHIBIDO ofrecer horas intermedias con media hora (como 8:30 am, 9:30 am o 3:30 pm)`
  Because transformer attention mechanisms attend to exact substrings present in the context prompt, explicitly writing `8:30 am`, `9:30 am`, and `3:30 pm` injects `:30` tokens directly into the LLM's active context window. Under high prompt complexity or user prompting (e.g., "Me sirve a las 3:30 pm?"), the model may attend to these tokens and repeat them.
- **Blast Radius**: Bot offers an invalid 30-minute increment appointment to a patient.
- **Mitigation**: Remove explicit `:30` timestamps from the negative example. Rephrase as:
  > `ESTÁ ESTRICTAMENTE PROHIBIDO ofrecer minutos distintos de :00 (ej. 8:00 am, 9:00 am). Solo se permiten horas exactas en punto.`

---

### [Medium] Challenge 2: Fragile JavaScript Date Parsing in Dynamic Weekend Logic
- **Assumption Challenged**: `new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Caracas'}))` safely evaluates the Caracas day of the week.
- **Attack Scenario**:
  ```javascript
  const ahora = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Caracas'}));
  const dia = ahora.getDay();
  ```
  In Node.js / V8 engines, `toLocaleString()` produces a formatted string without ISO timezone offsets (e.g. `"7/26/2026, 4:36:08 PM"`). Passing this string back into `new Date(...)` causes V8 to parse it using the local timezone of the host server running n8n (not UTC or Caracas). If the n8n server is located in UTC+0 or UTC+2, around midnight Caracas time (between 8:00 PM and 12:00 AM Caracas), `getDay()` can report the wrong day of the week (off by 1 day).
- **Blast Radius**: On Sunday night (Caracas time), the bot might evaluate `dia = 1` (Monday) and serve weekday prompt rules prematurely, or vice versa on Friday night.
- **Mitigation**: Replace with native n8n Luxon expression or standard Luxon DateTime available in n8n context:
  `{{ $now.setZone('America/Caracas').weekday >= 6 ? 'HOY ES FIN DE SEMANA...' : 'HOY ES DÍA DE SEMANA...' }}`

---

### [Low] Challenge 3: Prompt Formatting Contradiction (Exclamation Marks)
- **Assumption Challenged**: Prompt rules are non-contradictory.
- **Attack Scenario**:
  - Under `ESTILO DE ESCRITURA`:
    > `PROHIBIDO: ambos signos de exclamación (¡!). Usa solo el de cierre: Hola!`
  - Under `REGLA ESTRICTA DE REAGENDAMIENTO`:
    > `Si el paciente ACEPTA: Responde diciéndole "¡Perfecto! En unos momentos nuestra secretaria..."` (Uses opening `¡`).
- **Blast Radius**: Minor style inconsistency where the LLM occasionally emits Spanish opening exclamations `¡`.
- **Mitigation**: Change `¡Perfecto!` to `Perfecto!` in the reagendamiento rule text.

---

### [Low] Challenge 4: Friday Afternoon / Evening Boundary Condition
- **Assumption Challenged**: The weekday prompt branch handles Friday evening correctly.
- **Attack Scenario**: On Friday at 5:30 PM (after consultations close), `dia` is 5 (weekday branch). The dynamic prompt evaluates to:
  > `HOY ES DÍA DE SEMANA. Puedes ofrecer MAÑANA (8:00 am a 12:00 pm)...`
  Following `REGLA DE PRIORIDAD DE AGENDA` ("ofrece el primer día laborable disponible MÁS CERCANO, empezando por mañana"), the LLM may look at "mañana" (Saturday). Although `BLOQUEOS DE AGENDA` forbids Saturday, the instruction `Puedes ofrecer MAÑANA` explicitly injected by the dynamic code creates conflicting guidance for Friday evening.
- **Blast Radius**: Potential confusion when patients chat on Friday evening, where the bot might offer Saturday or struggle to select Monday.
- **Mitigation**: Update the dynamic weekday logic to detect Friday after 12:00 PM and inform the LLM that consultations for the week are closed, directing focus to the following week starting Monday.

---

## Stress Test Results

| Scenario | Input / Condition | Expected Behavior | Observed / Predicted Behavior | Result |
|---|---|---|---|---|
| **Character Count** | Count unescaped string length | < 10,000 chars | **7,074 chars** | PASS |
| **Forbidden Substring** | Check for `:30` in prompt | No `:30` strings | 3 occurrences (`8:30 am`, `9:30 am`, `3:30 pm`) | WARNING |
| **Step 4 Uniqueness** | Search for `4.` in workflow | Exactly 1 occurrence | 1 occurrence (`4. HORAS EXACTAS`) | PASS |
| **JSON Schema Alignment** | Compare prompt JSON vs `Formatear Respuesta` parser | 100% key match | All 8 keys match (`nombre`, `ciudad`, `motivo_consulta`, `temperatura`, `resumen`, `dia_cita`, `hora_cita`, `requiere_asistencia_humana`) | PASS |
| **Weekend Logic Edge Case** | User chats on Friday at 6 PM | Offer Monday morning/afternoon | Dynamic prompt states `Puedes ofrecer MAÑANA` which conflicts with Saturday block | FAIL / WARN |

---

## Unchallenged Areas

- **Supabase Node Credentials**: Out of scope for Paso 1 prompt testing.
- **WhatsApp Webhook Signature Verification**: Handled in earlier nodes (`Recibir WhatsApp`), out of scope for prompt logic.
