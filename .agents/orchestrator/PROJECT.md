# Project: WhatsApp Bot Restructuring for Dr. Ángel Trejo Alvarado

## Architecture
- Target file: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`
- Workflow Engine: n8n JSON workflow (23 nodes total)
- Modifiable Nodes:
  1. `Cerebro Inteligencia Artificial` (System Prompt & AI Model)
  2. `Formatear Agenda` (JS availability & block calculation logic)
  3. `Formatear Respuesta` (Escudo Validador JS code - preserved intact)
- Unmodified Nodes: 20 remaining nodes (Connections, IDs, credentials, parameters preserved 100% intact)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Baseline Investigation | Analyze target JSON structure, nodes, connections, current system prompt, agenda JS code | None | DONE |
| 2 | Prompt & Model Restructuring | Rewrite System Prompt (Secretary tone, 5 few-shot, knowledge base, <4000 tokens, limits on 'OBLIGATORIO' and 'ESTRICTAMENTE') & update AI model to `models/gemini-3.6-flash` | M1 | DONE |
| 3 | Formatear Agenda Logic Update | Enhance `Formatear Agenda` JS code to handle `[BLOQUEO]` prefix in `Nombre` and `TODO EL DIA` or specific times in `Hora_Cita`, preserving all existing rules | M1 | DONE |
| 4 | JSON Assembly & Verification Script | Assemble intact JSON workflow & write `verify_flow.py` verification script | M2, M3 | DONE |
| 5 | Independent Review & Forensic Audit | Run Reviewers, Challengers, and Forensic Auditor to ensure 100% compliance, zero structural changes to 20 nodes, valid n8n JSON, and pass all verification checks | M4 | DONE |

## Interface Contracts
- Node `Cerebro Inteligencia Artificial`:
  - `parameters.modelId.value` = `models/gemini-3.6-flash`
  - `parameters.modelId.cachedResultName` = `models/gemini-3.6-flash`
  - `parameters.messages.values[0].content` = Rewritten System Prompt (<4000 tokens)
- Node `Formatear Agenda`:
  - `parameters.jsCode` = Updated JavaScript availability calculation supporting `[BLOQUEO]` in `Nombre` and `TODO EL DIA` / specific time blocking
- Node `Formatear Respuesta`:
  - Preserved Escudo Validador JS code with `sanitizeTimes` and `has_quality_incident`
