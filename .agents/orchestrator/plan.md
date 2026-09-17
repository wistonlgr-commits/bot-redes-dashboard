# Project Plan: WhatsApp Bot Restructuring

## Objectives
1. Rewrite System Prompt in node `Cerebro Inteligencia Artificial` with Venezuelan medical secretary tone, 5 few-shot examples, complete base knowledge, token count <4000, 'OBLIGATORIO' <= 2, 'ESTRICTAMENTE' <= 1.
2. Update AI model in `Cerebro Inteligencia Artificial` to `models/gemini-3.6-flash` (both `modelId.value` and `modelId.cachedResultName`).
3. Update `Formatear Agenda` JS code to handle `[BLOQUEO]` prefix in `Nombre` and `TODO EL DIA` or specific times in `Hora_Cita`, preserving presencial/online slots, Caracas hour filter, 14-day window, 12h/24h parsing.
4. Keep `Formatear Respuesta` and all other 20 nodes 100% intact (connections, IDs, credentials, parameters). Output MUST be valid n8n JSON with 23 nodes.
5. Create and run `verify_flow.py` Python script to validate all 11 criteria automatically.

## Execution Steps
1. **Phase 1: Exploration & Analysis**
   - Dispatch 3 `teamwork_preview_explorer` agents to analyze `flujo asistente de whatsapp.json`:
     - Explorer 1: Analyze current System Prompt and list all base knowledge sections and formatting requirements.
     - Explorer 2: Analyze current `Formatear Agenda` and `Formatear Respuesta` JS code.
     - Explorer 3: Verify overall JSON structure, 23 node names, IDs, connections, and metadata.
2. **Phase 2: Implementation**
   - Dispatch `teamwork_preview_worker` to:
     - Draft the new System Prompt following tone guidelines, few-shot examples, knowledge base, token limits.
     - Modify `Cerebro Inteligencia Artificial` model to `models/gemini-3.6-flash`.
     - Update `Formatear Agenda` JS code to handle `[BLOQUEO]` in `Nombre` and `TODO EL DIA` / specific time in `Hora_Cita`.
     - Preserve all other nodes and connections.
     - Create `verify_flow.py` and run it to verify all checks pass.
3. **Phase 3: Review & Verification**
   - Dispatch 2 `teamwork_preview_reviewer` agents and 2 `teamwork_preview_challenger` agents to independently verify the updated JSON and run `verify_flow.py`.
4. **Phase 4: Forensic Audit**
   - Dispatch `teamwork_preview_auditor` to conduct static/runtime integrity checks on the JSON file and verification script.
5. **Phase 5: Synthesis & Reporting**
   - Final completion summary and client presentation.
