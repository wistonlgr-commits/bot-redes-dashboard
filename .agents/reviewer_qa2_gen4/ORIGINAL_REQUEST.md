## 2026-07-26T21:01:51Z
You are Reviewer QA 2 for Repaso QA 2 (Auditoría de Tokens, Peso y Coherencia del Prompt).
Your working directory is: c:\Users\Leor\Desktop\bot whatsapp\.agents\reviewer_qa2_gen4.
Target file: c:\Users\Leor\Desktop\bot whatsapp\flujo asistente de whatsapp.json.

Your task:
1. Inspect the production workflow file `flujo asistente de whatsapp.json`.
2. Inspect `Cerebro Inteligencia Artificial` node System Prompt and all node parameters.
3. Verify:
   a. Prompt compactness: Ultra-compact, plain text format with minimal token footprint per turn. Zero redundant/repetitive sections.
   b. Prompt coherence: Empathetic, human, respectful tone, clear sales flow (Steps 1-6), precise patient handling (old vs new), cancellation/rescheduling rules.
   c. Double-brace escaping (`{{ ... }}`): Ensure all n8n expression tags within node definitions are valid, correctly escaped, and contain zero syntax errors or template collisions.
4. Write your full review handoff report with pass/fail verdict to `c:\Users\Leor\Desktop\bot whatsapp\.agents\reviewer_qa2_gen4\handoff.md`.
5. Use send_message to report your status and findings back to the orchestrator.
