# Phase 3/4 Verification: Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: MEDIUM

- `verify_flow.py`: **PASS** (11/11 automated checks pass without error).
- Modality & Slot Rules: **PASS** (Correct candidate slots for PRESENCIAL and ONLINE across working days and non-working days).
- Empirical Stress Testing: 17 test cases executed via Node.js test harness (`test_formatear_agenda.js`), 13 passed cleanly, 4 edge cases/vulnerabilities identified.

## Challenges

### [Medium] Challenge 1: Accented `[BLOQUEÓ]` or `[bloqueó]` Bypasses Block Detection

- **Assumption challenged**: `nombreRaw.toUpperCase().startsWith('[BLOQUEO]')` is sufficient to identify all manual block entries.
- **Attack scenario**: A clinic administrative user inputs `"[BLOQUEÓ] Mantenimiento"` or `"[bloqueó]"` in Supabase without a specific time string.
- **Blast radius**: `isBloqueo` evaluates to `false` because `"[BLOQUEÓ]".toUpperCase()` remains `"[BLOQUEÓ]"` (retaining the accented `Ó`), which does not start with `"[BLOQUEO]"`. As a result, the full-day block is ignored and all candidate slots for that day remain open to patients, risking overbooking.
- **Mitigation**: Normalize `nombreRaw` before checking:
  ```js
  const nombreClean = nombreRaw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isBloqueo = nombreClean.startsWith('[BLOQUEO]');
  ```

### [Medium] Challenge 2: Time Ranges in `Hora_Cita` Only Block the First Slot

- **Assumption challenged**: `parseTimeTo24hHour(timeRaw)` adequately handles time strings representing duration or ranges (e.g. `"09:00 - 12:00"` or `"09:00 a 11:00"`).
- **Attack scenario**: A lead or block entry specifies `Hora_Cita: "09:00 - 12:00"`.
- **Blast radius**: `parseTimeTo24hHour` splits on `:` and parses `parts[0]` as `9`. It adds ONLY `"09:00"` to `ocupacionSupabase`, leaving `"10:00"` and `"11:00"` as available candidate slots, leading to potential double-booking during multi-hour blockouts.
- **Mitigation**: Extend `parseTimeTo24hHour` or add range parsing logic to extract both start and end hours if a range separator (`-` or `a`) is detected, and populate all intermediate hour slots.

### [Low] Challenge 3: Label Text Formatting Inconsistency Between Blocked and Open Days

- **Assumption challenged**: Output text format is uniform across all output states.
- **Attack scenario**: Downstream prompt or parser relies on exact label headers.
- **Blast radius**: On full-day blocked days, the line outputs:
  `- YYYY-MM-DD: PRESENCIAL (Uniaragua): [Sin disponibilidad] | ONLINE: [Sin disponibilidad] (Bloqueado)`
  On open working days, the line outputs:
  `- YYYY-MM-DD: PRESENCIAL (Mañanas en Uniaragua): [08:00, 09:00, 10:00, 11:00] | ONLINE (Tardes): [16:00, 17:00]`
  Note `PRESENCIAL (Uniaragua)` vs `PRESENCIAL (Mañanas en Uniaragua)` and `ONLINE` vs `ONLINE (Tardes)`.
- **Mitigation**: Standardize the modality labels across both blocked and open lines (e.g. use `PRESENCIAL (Mañanas en Uniaragua)` and `ONLINE (Tardes)` consistently).

## Stress Test Results

| # | Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| 1.1 | UPPERCASE `[BLOQUEO]` empty time | Full day block | Full day block | **PASS** |
| 1.2 | Lowercase `[bloqueo]` empty time | Full day block | Full day block | **PASS** |
| 1.3 | Mixed case `  [BloQueO]  ` | Full day block | Full day block | **PASS** |
| 1.4 | Accented `[BLOQUEÓ]` empty time | Full day block | Not blocked (`isBloqueo=false`) | **FAIL** |
| 1.5 | Accented `[bloqueó]` empty time | Full day block | Not blocked (`isBloqueo=false`) | **FAIL** |
| 1.6 | `[BLOQUEO]` with `Todo el día` | Full day block | Full day block | **PASS** |
| 1.7 | `[BLOQUEO]` with specific time `09:00` | Block ONLY `09:00` slot | Only `09:00` removed, others open | **PASS** |
| 1.8 | `[BLOQUEO]` with specific time `16:00` | Block ONLY `16:00` in Online | Only `16:00` removed, `17:00` open | **PASS** |
| 2.1 | Normal lead `09:00` | Remove `09:00` from Presencial | Presencial slots: `08:00, 10:00, 11:00` | **PASS** |
| 2.2 | Normal lead `16:00` | Remove `16:00` from Online | Online slots: `17:00` | **PASS** |
| 2.3 | Time parsing `9:00 am` & `4 pm` | Parse `09:00` & `16:00` | `09:00` & `16:00` removed | **PASS** |
| 3.1 | Weekend (Sat/Sun) | `(Fin de semana): NO LABORABLE` | `(Fin de semana): NO LABORABLE` | **PASS** |
| 3.2 | Monday slots | Presencial 08-11, Online 16-17 | Presencial 08-11, Online 16-17 | **PASS** |
| 3.3 | Tue/Wed/Fri slots | Presencial 08-11, Online `[Sin disponibilidad]` | Presencial 08-11, Online `[Sin disponibilidad]` | **PASS** |
| 3.4 | Thursday slots | Presencial 08-11, Online 16-17 | Presencial 08-11, Online 16-17 | **PASS** |
| 4.1 | Time range `"09:00 - 12:00"` | Block `09:00`, `10:00`, `11:00` | Blocks ONLY `09:00` | **FAIL** |
| 4.2 | Label text uniformity | Uniform label format | Variance in labels (`Uniaragua` vs `Mañanas...`) | **FAIL** |

## Unchallenged Areas

- External Supabase DB connection latency / network timeouts — Out of scope for node logic verification.
- Downstream `Formatear Respuesta` LLM parsing execution — Out of scope for candidate slot generator node.
