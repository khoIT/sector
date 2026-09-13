---
phase: 5
title: "Foundations and question banks"
status: pending
priority: P1
effort: "17 days"
dependencies: [1, 2]
---

# Phase 5: Foundations and question banks

## Overview

Build the two most expensive LMS foundations — a sanitized HTML renderer and **one**
quiz engine — and prove them against real migrated WordPress content before any course
surface depends on them.

Question banks are the vehicle because they are the only real LMS surface that stands
alone: 5 endpoints, no permission gate, no feature flag, no course dependency.

## One engine, not four

Four quiz implementations exist. Two are unreachable — all three route entry points
hardwire V3 — so ~1,850 lines and the whole `POST /api/lms/quizzes/:id/finalize`
endpoint are dead. The two live ones differ on **one axis**:

| | Course quiz | Question bank |
| --- | --- | --- |
| Save | per question | autosave |
| Grade | per question | one batch at the end |
| Resume from | the learner-course document | last answered question |

That is a three-method adapter — `loadProgress`, `saveAnswer`, `finish` — not two
engines. The prototype demonstrates it: both surfaces mount the same component.

Build **two** answer types, not six. Production holds single 2,227 (95.1%), multiple
113 (4.8%), sort_answer 1, and zero free_choice / fill_blank / essay — and the server
hard-codes the last three to `isCorrect = false`.

## Bugs to fix in the rewrite rather than port

- **Client and server score by different formulas.** Server: correct ÷ total. Client:
  earned ÷ possible points. Masked only because all 2,341 production questions have
  `points: 1`. Pick the server's and delete the other.
- **Time spent accumulates quadratically** — the quiz start time is sent with every
  per-question submit, so a 10-question quiz taken in 10 minutes records ~55. Every
  time-on-task and CME report built on it is inflated.
- **The on-screen timer freezes after the first answer.**
- **146 published course quizzes have zero questions** — Start lands on "Question data
  not found" and the attempt can never complete. Detect and refuse, with a message.
- **`incorrectMessage` is authored, returned, typed, carried into state and never
  rendered.** Clinician authors write remediation no learner has seen. Render it.

## Related code files

- Create: `packages/ui/src/components/rich-text.tsx` — DOMPurify-backed renderer
- Create: `packages/ui/src/components/*` — the 9 missing primitives (progress meter,
  segmented progress, radio card, ring, accordion, toolbar, stat, empty-grid, drawer)
- Create: `apps/web/src/features/quiz/engine/*` — runner, state, `adapters/bank.ts`,
  `adapters/course.ts`
- Create: `apps/web/src/features/question-banks/**`
- Create: `packages/api-client/src/endpoints/question-bank.ts`, `quiz.ts`
- Create: `packages/api-client/src/schemas/quiz.ts`, `question.ts`

## Implementation steps

1. Rich-text renderer first, tested against the ugliest real lesson bodies in the
   mirror. It replaces 677 lines of render-time WordPress repair — do not port that.
2. The 9 UI primitives, each with its own test, in `packages/ui`.
3. Quiz engine as pure state in `.ts` (the vitest config is `environment: 'node'`,
   `src/**/*.test.ts` — no jsdom, no `.tsx` tests). Scoring, resume and the adapter
   contract are all testable without React.
4. The bank adapter, then the bank surfaces: index, runner, score card with review.
5. Replay every production question through the schema (Phase 2 harness) before
   calling it done.

## Tests / validation

- Unit: scoring on the server's formula; resume from a partial attempt; the empty-quiz
  refusal; both answer types; the adapter contract for both modes.
- Fidelity: all 2,341 production questions parse.
- Browser: complete a bank end to end against the mirror.

## Success criteria

- [ ] One engine, two adapters, no second implementation anywhere
- [ ] Client score equals the server's for every attempt, points or not
- [ ] Time on task matches wall-clock within a second
- [ ] A zero-question quiz cannot be started
- [ ] `incorrectMessage` is on screen after an answer

## Risk / rollback

The engine is the single most depended-on thing built in this plan — Phase 7 mounts it
again. Land the adapter contract with tests before building the bank UI, so the course
adapter later is a file, not a refactor. The rich-text renderer is the other risk: too
strict and real lesson bodies lose content, too loose and it is an XSS hole. Test it
against the mirror, not against fixtures.
