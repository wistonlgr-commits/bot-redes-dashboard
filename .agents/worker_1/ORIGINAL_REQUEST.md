## 2026-07-26T23:31:21Z
<USER_REQUEST>
You are Worker 1 implementing Paso 1 for the n8n Dr Trejo workflow optimization project.
Your working directory is c:\Users\Leor\Desktop\bot whatsapp\.agents\worker_1.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task Scope (Paso 1: Saneamiento y Robustecimiento del System Prompt):
Modify the production n8n JSON file `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`.
Specifically, target Node #9 named `Cerebro Inteligencia Artificial` (`parameters.messages.values[0].content`).

Requirements for Paso 1:
1. **Unify Paso 4**: Remove the duplicate and contradictory `4.` heading in the system prompt. Unify into a single, clear `4. HORAS EXACTAS` section.
2. **Enforce Exact Hours (:00)**: Replace all `:30` references (such as `3:30 pm`) with exact `:00` times (e.g., `4:00 pm`). Explicitly state that ONLY exact `:00` hours are permitted (e.g. `8:00 am`, `9:00 am`, `10:00 am`, `11:00 am`, `4:00 pm`, `5:00 pm`) and half-hours like `:30` are strictly forbidden.
3. **Fix Weekend Logic**: Update weekend rules (Saturday/Sunday) so that patients contacting on weekends CAN schedule appointments for both morning and afternoon available slots for the upcoming work week without triggering unnecessary human handoffs (`requiere_asistencia_humana: "true"`).
4. **Compact & Clean System Prompt**: Remove duplicate blocks (e.g., duplicate `Exámenes Previos` paragraph), harmonize rescheduling rules, and streamline prompt text to be ultracompact (~1,750 tokens / under 8,000 chars) while preserving all essential medical knowledge, clinic schedules, and n8n expressions `{{ ... }}`.
5. **JSON Integrity**: Ensure `flujo asistente de whatsapp.json` remains 100% valid JSON syntax and can be parsed without errors.

Steps to perform:
1. Load `flujo asistente de whatsapp.json`.
2. Extract and update the system prompt in Node `Cerebro Inteligencia Artificial`.
3. Validate JSON syntax and structure using node / python scripts or verification commands.
4. Save the modified `flujo asistente de whatsapp.json`.
5. Write your implementation report in `c:\Users\Leor\Desktop\bot whatsapp\.agents\worker_1\changes.md` and handoff report in `c:\Users\Leor\Desktop\bot whatsapp\.agents\worker_1\handoff.md`.
6. Send a message to Orchestrator (conversation ID: a158d5ec-ea11-426c-b57d-8b8e69905a37) when done.
</USER_REQUEST>
