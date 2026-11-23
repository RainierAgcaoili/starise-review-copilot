# Project: Starise Review & Reputation Copilot

## Communication & Token Efficiency Rules
- English only. Be terse and direct—zero greetings, conversational preamble, or closing summaries.
- Explain changes using concise bullet points or brief diffs only.
- Ask clarifying questions only when requirements are genuinely ambiguous.

## Workflow & Verification
- Before creating or modifying files, output a 3–5 bullet implementation plan and wait for confirmation unless explicitly told to execute immediately.
- Keep code modular, minimal, and production-clean; do not install unrequested packages.
- After any code edit, run `npx tsc --noEmit` (and relevant tests once configured) to verify zero type or build errors before finishing.

## Tech Stack & Hard Standards
- Framework: Next.js (App Router) + TypeScript (strict mode) + Tailwind CSS.
- Database: PostgreSQL (Neon) with Prisma or Drizzle ORM.
- Validation & AI Safety: Validate all incoming API payloads and all LLM JSON responses using strict Zod schemas. Never trust raw unvalidated LLM output.
- Secrets: Never read, log, or hardcode `.env` or `.env.local` values.