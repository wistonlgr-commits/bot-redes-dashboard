# Adversarial Challenge Report — Paso 2 Implementation

## Challenge Summary

**Overall risk assessment**: MEDIUM

The Paso 2 implementation in `flujo asistente de whatsapp.json` successfully addresses the core requirement: converting negative blockage logic into positive available exact `:00` slots (`08:00`, `09:00`, `10:00`, `11:00`, `16:00`, `17:00`), fixing 12h/24h time parsing (preventing `04:00 pm` from blocking 4 AM), purging all `:30` references, enforcing weekend blockages, and validating clean n8n JSON syntax.

However, empirical stress testing revealed **3 notable vulnerabilities/edge cases** in string matching and date normalization that could cause Supabase blockages to be bypassed in production if inputs contain standard Spanish accents or unpadded date strings.

---

## Challenges

### [Medium] Challenge 1: Accent Incompatibility in Full-Day Blockage Filter ("Todo el día" vs "todo el dia")

- **Assumption challenged**: Full-day blockages specified in Supabase `Hora_Cita` as `"Todo el día"` are caught by `timeLower.includes('todo el dia')`.
- **Attack scenario**: A receptionist or system enters `"Todo el día"` (with Spanish accent `í` on `día`) in Supabase `Hora_Cita`.
  In JavaScript, `'todo el día'.includes('todo el dia')` evaluates to **`false`** because `í` (`U+00ED`) != `i` (`U+0069`).
  `parseTimeTo24hHour("todo el día")` returns `null`.
- **Blast radius**: The full-day blockage is completely ignored by Node #15. The blocked day is output to Gemini as 100% AVAILABLE, allowing patients to schedule appointments on days marked as blocked.
- **Mitigation**: Normalize strings by stripping diacritics before comparison (e.g. `str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")`) or expand matching keywords to include `'todo el día'`, `'día completo'`, `'dia completo'`, `'cerrado'`, `'feriado'`, `'no trabaja'`.

---

### [Low-Medium] Challenge 2: Date String Unpadded Formatting Risk ("2026-8-1" vs "2026-08-01")

- **Assumption challenged**: All date strings in Supabase `Dia_Cita` strictly use ISO 8601 2-digit zero-padded dates (`YYYY-MM-DD`).
- **Attack scenario**: Supabase returns a date record formatted without leading zeros (e.g., `"2026-8-1"` or `"2026-08-1"`).
  1. `date < todayStr` (`"2026-8-1" < "2026-07-26"`) evaluates to `false` (since `'8' > '0'`).
  2. `ocupacionSupabase["2026-8-1"]` stores the slot under key `"2026-8-1"`.
  3. When generating availability for `dateStr = "2026-08-01"`, `ocupacionSupabase["2026-08-01"]` returns `undefined`.
- **Blast radius**: Bookings with unpadded dates are ignored during availability calculation, risking double booking on affected dates.
- **Mitigation**: Normalize input `Dia_Cita` strings using `new Date(date)` or split/pad components before storing in `ocupacionSupabase`.

---

### [Low] Challenge 3: Unhandled Blockage Phrases ("Día libre", "Cerrado", "No trabaja")

- **Assumption challenged**: Receptions/admin users only use the exact phrases `'todo el dia'`, `'toda la semana'`, `'bloqueado'`, `'vacaciones'`, `'no laborable'`.
- **Attack scenario**: A user enters `"Cerrado por feriado"` or `"Día libre"` in Supabase `Hora_Cita`.
  `timeLower.includes(...)` misses these keywords.
- **Blast radius**: Full day blockage is ignored; day is presented as available.
- **Mitigation**: Add common administrative blockage terms (`'cerrado'`, `'feriado'`, `'libre'`, `'no trabaja'`) to the inclusion check.

---

## Stress Test Results

| Scenario / Edge Case | Input Description | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **JSON Syntax** | `flujo asistente de whatsapp.json` structure | Valid n8n JSON file | Valid JSON, all nodes loaded | **PASS** |
| **Empty Supabase** | `$input.all()` = `[]` | Clean 14-day schedule with default clinic rules | 14-day schedule generated without errors | **PASS** |
| **Weekend Inputs** | Saturday & Sunday dates in 14-day window | `(Fin de semana): NO LABORABLE` | Saturdays/Sundays marked `NO LABORABLE` | **PASS** |
| **12h PM Parsing** | `Hora_Cita` = `"04:00 pm"` or `"4:00 PM"` | Block 16:00 (4 PM), leave 04:00 (4 AM) unaffected | Correctly blocks `16:00` | **PASS** |
| **12h AM Parsing** | `Hora_Cita` = `"8:00 AM"` or `"08:00 am"` | Block 08:00 AM | Correctly blocks `08:00` | **PASS** |
| **24h Parsing** | `Hora_Cita` = `"16:00"` | Block 16:00 | Correctly blocks `16:00` | **PASS** |
| **12:00 PM / AM** | `Hora_Cita` = `"12:00 pm"` / `"12:00 am"` | Map to 12 / 0 respectively | Mapped to 12:00 / 00:00 without error | **PASS** |
| **Full Day Blockage (unaccented)** | `Hora_Cita` = `"TODO EL DIA"`, `"vacaciones"` | Day marked `(Bloqueado)` | Day marked `(Bloqueado)` | **PASS** |
| **Full Day Blockage (accented)** | `Hora_Cita` = `"Todo el día"` | Day marked `(Bloqueado)` | Day NOT blocked (Outputs available slots) | **FAIL (Vuln)** |
| **Purged :30** | Code and prompt inspection | Zero `:30` references, exact `:00` slots | Zero `:30` references found | **PASS** |
| **Dual Output Keys** | Output object inspection | `{ agenda_disponible, agenda_ocupada }` | Both keys returned with identical text | **PASS** |

---

## Unchallenged Areas

- **Supabase Network Layer**: Real-time Supabase connection and HTTP query parameters were not challenged in live production, as testing was executed on local workflow JSON logic.
