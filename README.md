# Starise AI Review & Reputation Copilot

Full-stack hospitality review collection (<30s mobile flow) with a human-in-the-loop AI triage and reply copilot. Customers leave a rating, tags, and an optional comment; Gemini classifies sentiment, flags urgent issues, and drafts a manager reply that a human approves before it is used.

## Architecture & Data Flow

```
 Customer Mobile UI (/)
          |  POST /api/reviews
          v
 Next.js Route Handlers (/api/*)
   Zod-validated payloads (src/lib/validations.ts)
          |
          +--> Gemini Structured Output Pipeline (src/lib/ai-triage.ts)
          |      @google/genai + responseJsonSchema: z.toJSONSchema(aiTriageSchema)
          |      -> Zod safeParse of LLM JSON -> DRAFT
          |      -> on timeout / error / invalid output -> FALLBACK
          |
          +--> Prisma v7 (@prisma/adapter-neon) + Neon PostgreSQL
          |      review + aiResponse written in one transaction
          v
 Manager Dashboard (/dashboard)
   triage, edit, and approve replies via PATCH /api/reviews/[id]/reply
```

## Reliability & AI Guardrails

- **Strict TypeScript:** `strict` and `noUncheckedIndexedAccess` enabled.
- **Validation everywhere:** every request body and every LLM JSON response is parsed with a Zod schema; raw model output is never trusted.
- **Prompt injection defense:** customer text is wrapped in `<customer_review>` XML tags, `<` / `>` are escaped, and the system instruction tells the model to treat the content strictly as data.
- **Bounded latency:** 15s deadline per Gemini call, plus a single retry (750ms backoff) on `429` / `503` only.
- **Graceful fallback:** on any failure (missing key, timeout, API error, schema violation) a deterministic triage is used (rating-based sentiment, urgent-keyword matching, template reply) and stored with status `FALLBACK`, so review writes never fail.
- **Human-in-the-loop:** AI replies are stored as `DRAFT`; nothing is `APPROVED` until a manager edits/approves it via the API.

## REST API Reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/locations` | Locations with `reviewCount` and `averageRating` |
| `GET` | `/api/reviews` | Reviews with location and AI response; query: `locationId`, `urgentOnly=true` |
| `POST` | `/api/reviews` | Create review `{ locationId, rating 1-5, tags[], comment?, customerName? }`; runs triage; `201` / `400` / `404` |
| `PATCH` | `/api/reviews/[id]/reply` | Update reply `{ draftReply, status: "DRAFT" \| "APPROVED" }`; `200` / `400` / `404` |

## Local Development, Testing & Docker

```bash
cp .env.example .env        # set DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL
npm install                 # postinstall runs `prisma generate`
npm run db:push             # sync schema to Neon
npm run db:seed             # seed locations/reviews
npm run dev                 # http://localhost:3000
npm test                    # vitest

docker build -t starise-review-copilot .
docker run --env-file .env -p 3000:3000 starise-review-copilot
```

## Deploying to Vercel

Set `DATABASE_URL` and `GEMINI_API_KEY` (optionally `GEMINI_MODEL`) as project environment variables. `postinstall` and `build` both run `prisma generate`, so no extra build config is needed.
