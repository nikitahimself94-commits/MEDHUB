# HANDOFF — MedHUB Agent Layer Session

Date: 2026-03-26

---

## A. ROLE OF NEXT CHAT

Lead Product Strategist + UX/Flow Architect + Scope Controller + Claude Code Controller for MedHUB.

You formulate tasks. Claude Code executes or raises concerns with arguments. One active step at a time. Strict scope. Verified results.

---

## B. PRODUCT TRUTH / CURRENT FRAMING

- **MedHUB = agent of medical accompaniment with a working environment** — not "a medical dashboard with an AI tab."
- Core value: the feeling that the user is being led, understood, accompanied. Not left alone with chaos of symptoms, test results, and decisions.
- **Agent-first continuity inside the product** is the main vector. The agent is active from the first second — not discovered somewhere in a menu.
- **Copy-layer vs Presence-layer distinction:**
  - Copy-layer = what the agent says (texts, reactions, greetings).
  - Presence-layer = how the agent feels (timing, animation, overlay events, visual gravity).
  - These must not be confused. Presence is the harder, more important problem.

---

## C. CURRENT BASELINE — IMPLEMENTED

### Onboarding
- Full 7-step branching onboarding flow (state machine, no AI calls).
- Typing animation with skip. Three entry branches (diagnosis / caregiver / systematic).
- Saves `onboarding_context` + `onboarding_completed_at` to profiles table.

### First Arrival Overlay
- Shows once after onboarding for users with no product data.
- 1.8s delay, fade-in animation, dismiss button, localStorage suppression (`medhub:arrival_v2`).
- After dismiss: brief hero highlight glow as bridge into workspace.
- **Bug fixed this session**: `handleFinish` had competing navigation (`revalidatePath` + `router.push` + `router.refresh`). Fixed to use only `router.refresh()`. Added `mountId` ref guard in timer callback.
- **Verified via Playwright e2e test** — overlay appears, dismisses, does not reappear.

### MCO (Medical Context Object) v1
- `src/lib/mco.ts` — builds structured context from patient data (diary, vitals, meds, docs, timeline).
- Used for dashboard hero (opening, observation, next step, evidence).
- Persistence to `mco_snapshot` column attempted but **column does not exist in DB yet** (fails gracefully).

### Dashboard Hero from MCO
- Proactive agent hero card: opening + observation + next step CTA + evidence footer.
- `hero-from-mco.ts` — deterministic hero generation from MCO state.
- `module-statuses.ts` — micro-status for each module card.

### Template Rotation
- `src/lib/template-rotation.ts` — per-user rotation of hero templates to avoid repetition.
- Persistence to `companion_rotation_state` column attempted but **column does not exist in DB yet** (fails gracefully).

### Haiku Paraphrase
- `src/lib/haiku-paraphrase.ts` — Haiku model paraphrases hero opening only.
- Used ONLY for hero opening. Intentionally NOT used for diary/vitals post-save reactions.

### Companion Layer (modules)
All 12 modules implemented:
- `/dashboard` — agent hero, signals, module statuses, inline AI, activity feed
- `/diary` — diary entries with symptoms
- `/vitals` — vital signs with recharts graphs
- `/documents` — CRUD + upload + AI parse + second opinion
- `/medications` — CRUD + intake tracking + today count
- `/timeline` — events chronological
- `/emotions` — 5-parameter emotion scale
- `/symptoms-map` — read-only matrix from diary data
- `/ai-chat` — Claude Sonnet conversation with context snapshot
- `/doctor-visit` — AI visit prep + share link
- `/ai-plan` — usage transparency
- `/profile` — medical profile

### Other
- Unification pass across modules (visual consistency).
- User-scoped hero memory (rotation state per user).
- Rollback of Haiku from diary/vitals reactions (deterministic post-save only).
- Empty-state noise cleanup.

### Playwright Setup
- Installed and configured this session (see Section G).

---

## D. IMPORTANT PRODUCT DECISIONS ALREADY MADE

1. **Haiku only in hero opening** — not in diary/vitals/other reactions. Post-save must be instant and deterministic.
2. **No broad AI expansion** beyond current layer. Focus on companion/presence, not width.
3. **Focus on presence-layer over copy-layer** — how the agent feels matters more than what it says.
4. **In arrival/presence layer, address user as "ты"** (informal Russian), not "вы".
5. **First arrival should feel like an arrival event**, not static welcome copy.
6. **Browser verification is mandatory** for behavior-sensitive features (timing, animation, overlay logic).
7. **No new large modules** — deepen existing ones.
8. **Monetization discussion required before scaling AI** (tariffs, unit economics still open).

---

## E. WHAT WAS REJECTED / NOT TO REPEAT

| Rejected | Reason |
|---|---|
| Haiku in diary/vitals reactions | Caused text jump — user sees empty then text appears. Must be deterministic. |
| Broad AI expansion beyond current companion layer | Not accepted — focus on depth, not width. |
| Local-only work without deploy/browser verification | Not acceptable for behavior-sensitive features. |
| Confusing copy-layer with presence-layer | Copy = words. Presence = timing + animation + visual weight. Different problems. |
| Considering a task closed without factual verification | When behavior is the point, it must be verified in browser, not assumed from code. |
| `router.push()` + `router.refresh()` after server action | Created competing navigation that broke overlay timer. Use only `router.refresh()`. |

---

## F. CURRENT OPEN ISSUES

1. **DB schema mismatch** — two columns referenced in code but missing from actual Supabase schema:
   - `profiles.mco_snapshot` — MCO persistence fails gracefully
   - `profiles.companion_rotation_state` — rotation persistence fails gracefully
   - Needs migrations to add these columns.

2. **First Arrival Overlay v2** — current overlay works (verified) but is visually minimal. Product-wise, likely needs a stronger presence presentation as next step.

3. **Baseline/source-of-truth doc** — no single canonical doc describing all implemented state in one place (this handoff partially fills that gap).

4. **Deploy discipline** — production deploy not done this session. Changes are local + verified via Playwright but not pushed to Vercel.

---

## G. PLAYWRIGHT / VERIFICATION STATUS

### Installed
- `@playwright/test` (devDependency in package.json)
- Chromium browser (`npx playwright install chromium`)

### Config
- `playwright.config.ts` at project root
- Loads `.env.local` for Supabase credentials
- Auto-starts dev server via `webServer` config
- Single project: chromium, headless

### Smoke Test
- `e2e/first-arrival.spec.ts`
- Creates test user via Supabase Admin API (unique email with timestamp, pre-confirmed)
- Creates patient + updates profile (DB trigger creates profile automatically)
- Full flow: login → all 7 onboarding steps (with animation skip) → dashboard → wait for overlay → dismiss → reload → verify overlay gone
- Cleans up all test data after (profile, patient, auth user, related records)

### What the Test Proves
- Auth login works
- Onboarding completes successfully (all steps)
- `completeOnboarding` server action saves data correctly
- `router.refresh()` correctly transitions from OnboardingGate to dashboard
- `isFirstArrival` is `true` for new user
- Overlay appears after ~1.8s delay
- Overlay dismiss works
- localStorage suppression prevents re-show on reload

### Command
```
npm run test:e2e
```

---

## H. NEXT BEST STAGE

1. **Resolve DB schema mismatch** — add migrations for `mco_snapshot` and `companion_rotation_state` columns in profiles table. This unblocks MCO persistence and rotation memory.
2. **Deploy current state** — push to GitHub, deploy to Vercel, verify in production.
3. **First Arrival Overlay v2** — stronger presence presentation layer (pending product decision on what "stronger" means).
4. Continue working one narrow verified step at a time.

---

## I. WORKING RULES FOR NEXT CHAT

1. One active step at a time. No parallel scope.
2. Strict scope control — no self-initiated broadening, no "while I'm here" improvements.
3. Every change must be verified, not just coded.
4. Browser-sensitive behavior (timing, animation, overlay) must be checked via Playwright where possible.
5. Read before edit. Build after changes.
6. No "local only" ambiguity — deploy status must be explicit.
7. Reports must include: files read, exact change, files changed, what was NOT touched, build/verification result.
8. Do everything without asking permission, except deleting important files.
9. Always restart dev server after code changes (`kill node` + `rm -rf .next` + restart).

---

## J. LAST KNOWN STATE

### Accepted
- First Arrival Overlay bug fix (competing navigation removed, mountId guard added)
- Overlay cleanup to production-ready (all debug artifacts removed)
- Playwright setup with working e2e smoke test
- Test passes consistently (2/2 runs)

### Not Accepted
- No production deploy done this session
- First Arrival Overlay v2 (visual upgrade) — not started, pending product decision

### Where We Stopped
- Overlay fix is complete and verified via e2e
- Playwright infrastructure is in place
- DB schema warnings remain (mco_snapshot, companion_rotation_state columns missing)
- Code is local-only, not deployed

### Next Logical First Step
Add the two missing DB column migrations (`mco_snapshot`, `companion_rotation_state`) so MCO and rotation state persist correctly. Then deploy.
