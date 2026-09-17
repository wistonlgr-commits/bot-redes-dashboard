# Context Overview

## Project Target
- File: `c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json`
- Workflow: n8n workflow with 23 nodes.

## Modifiable Nodes:
1. `Cerebro Inteligencia Artificial`:
   - `modelId.value` and `modelId.cachedResultName` -> `models/gemini-3.6-flash`
   - `messages.values[0].content` -> Rewritten System Prompt (<4000 tokens, 5 few-shot examples, medical secretary tone, complete knowledge base, OBLIGATORIO <= 2, ESTRICTAMENTE <= 1)
2. `Formatear Agenda`:
   - `jsCode` -> Updated algorithm supporting `[BLOQUEO]` prefix in `Nombre` and `TODO EL DIA` / specific time blocking.
3. `Formatear Respuesta`:
   - Escudo Validador JS code kept intact.

## Required Verification Script
- `verify_flow.py`: Python script validating 11 automated verification rules against the output JSON file.
