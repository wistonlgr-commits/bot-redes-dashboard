# Challenge Report — Node #15 (`Formatear Agenda`) & `flujo asistente de whatsapp.json` (Paso 2)

## Challenge Summary

**Overall risk assessment**: MEDIUM

The Node #15 (`Formatear Agenda`) JavaScript code implemented in `flujo asistente de whatsapp.json` (and `formatear_agenda_corregido.js`) successfully enforces exact `:00` candidate slot formatting, eliminates all `:30` intermediate strings, correctly handles Supabase input variations (`"04:00 pm"`, `"4:00 PM"`, `"16:00"`, `"08:00 am"`, `"12:00 pm"`), and respects external clinic blocking rules by day of week.

However, an empirical vulnerability was identified regarding system timezone sensitivity when executing `d.getDay()`, which can corrupt day-of-week classification if n8n runs in server environments located in positive UTC timezones (UTC+8 or higher).

---

## Challenges

### [Medium] Challenge 1: Host System Timezone Dependency in `d.getDay()`

- **Assumption challenged**: Assumes `d.getDay()` evaluates the day of the week relative to `America/Caracas` timezone.
- **Attack scenario**: `d` is instantiated via `new Date(baseDate.getTime() + i * 86400000)`, where `baseDate` is `new Date(todayStr + 'T12:00:00-04:00')` (`16:00:00 UTC`). While `dateFormatter.format(d)` explicitly uses `{ timeZone: 'America/Caracas' }`, `d.getDay()` invokes standard `Date.prototype.getDay()`, which evaluates in the **local system timezone of the server running Node.js/n8n**.
  - If the server runs in UTC+9 (e.g. Tokyo, AWS ap-northeast-1) or UTC+10/12, `16:00:00 UTC` corresponds to `01:00:00` of the *following day* in local time.
  - On Sunday in Caracas (`2026-07-26`), local server time is Monday morning (`2026-07-27 01:00:00`). `dateFormatter.format(d)` returns `"2026-07-26"`, but `d.getDay()` returns `1` (Monday).
  - Consequently, Sunday (`2026-07-26`) is incorrectly flagged as Monday and outputs available morning slots (`MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00]`) instead of `NO LABORABLE`.
- **Blast radius**: If hosted on servers configured to UTC, UTC+8, UTC+9, or UTC+12, weekend blocking breaks, allowing patients to schedule on Sunday.
- **Mitigation**: Derive `dayOfWeek` directly from `dateStr` in UTC:
  ```javascript
  const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  ```
  This guarantees 100% server-timezone independence.

---

### [Low] Challenge 2: Non-ISO Date String Comparison in Supabase Filtering

- **Assumption challenged**: Assumes `json.Dia_Cita` in Supabase is always strictly ISO `YYYY-MM-DD`.
- **Attack scenario**: If a manual entry or third-party integration writes dates like `"2026/7/27"` or `"27-07-2026"`, string comparison `date < todayStr` yields incorrect boolean evaluation.
- **Blast radius**: Past appointments might fail to filter out, or future appointments might be ignored.
- **Mitigation**: Ensure Supabase schema enforces `DATE` type or ISO `YYYY-MM-DD` format.

---

## Stress Test Results

| Test ID | Input Scenario | Expected Output | Actual / Predicted Output | Result |
|---|---|---|---|---|
| ST-01 | Time parsing `"04:00 pm"` | Parsed to `16` (`"16:00"` slot blocked) | `"16:00"` added to `ocupacionSupabase` | PASS |
| ST-02 | Time parsing `"4:00 PM"` | Parsed to `16` (`"16:00"` slot blocked) | `"16:00"` added to `ocupacionSupabase` | PASS |
| ST-03 | Time parsing `"16:00"` | Parsed to `16` (`"16:00"` slot blocked) | `"16:00"` added to `ocupacionSupabase` | PASS |
| ST-04 | Time parsing `"08:00 am"` | Parsed to `8` (`"08:00"` slot blocked) | `"08:00"` added to `ocupacionSupabase` | PASS |
| ST-05 | Time parsing `"12:00 pm"` | Parsed to `12` (`"12:00"`), no slot affected | `"12:00"` added to `ocupacionSupabase`, candidate slots untouched | PASS |
| ST-06 | Non-exact time `"08:30 am"` | Parsed to `8` (`"08:00"` slot blocked) | `"08:00"` added to `ocupacionSupabase` | PASS |
| ST-07 | Non-exact time `"16:30"` | Parsed to `16` (`"16:00"` slot blocked) | `"16:00"` added to `ocupacionSupabase` | PASS |
| ST-08 | PostgreSQL SQL Time `"08:00:00"` | Parsed to `8` (`"08:00"` slot blocked) | `"08:00"` added to `ocupacionSupabase` | PASS |
| ST-09 | Absence of `:30` strings | Zero `:30` in output string | Format contains only `:00` slots | PASS |
| ST-10 | Day schedule - Monday | Morning: 8-11, Afternoon: Sin disponibilidad | `- YYYY-MM-DD: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] \| TARDE DISPONIBLE: [Sin disponibilidad]` | PASS |
| ST-11 | Day schedule - Wednesday | Morning: 8-11, Afternoon: 16, 17 | `- YYYY-MM-DD: MAÑANA DISPONIBLE: [08:00, 09:00, 10:00, 11:00] \| TARDE DISPONIBLE: [16:00, 17:00]` | PASS |
| ST-12 | Day schedule - Weekend | `(Fin de semana): NO LABORABLE` | `- YYYY-MM-DD (Fin de semana): NO LABORABLE` | PASS (under UTC-4 to UTC+2) |
| ST-13 | Server timezone UTC+9/UTC+12 | Weekend evaluated in Caracas time | `d.getDay()` evaluates local server time, causing day offset | FAIL (Vulnerability found) |

---

## Unchallenged Areas

- **Supabase DB Network connectivity**: Tested code logic with `$input.all()` mock objects; live Supabase network latency / connection errors were not tested as out of scope for JS unit logic.
