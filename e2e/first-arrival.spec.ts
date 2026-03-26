/**
 * E2E smoke test: new user → onboarding → dashboard → first arrival overlay.
 *
 * Test user is created via Supabase Admin API (service role) before the test
 * and deleted after. No manual setup needed.
 */
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EMAIL = `e2e-${Date.now()}@test.medhub.local`;
const PASSWORD = "e2eTestPass123";
const NAME = "E2E Тест";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let sb: SupabaseClient;
let userId: string;
let patientId: string;

/** Skip the onboarding typing animation on current step */
async function skipTyping(page: import("@playwright/test").Page) {
  const skipBtn = page.getByLabel("Пропустить анимацию");
  // Animation might still be setting up — give it a moment
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
test.beforeAll(async () => {
  sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Create auth user (email pre-confirmed)
  const { data, error } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: NAME, role: "patient" },
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  userId = data.user.id;

  // 2. Create patient record
  const { data: patient, error: patErr } = await sb
    .from("patients")
    .insert({ display_name: NAME })
    .select("id")
    .single();
  if (patErr) throw new Error(`Failed to create patient: ${patErr.message}`);
  patientId = patient.id;

  // 3. Link profile → patient (profile is auto-created by DB trigger)
  const { error: profErr } = await sb
    .from("profiles")
    .update({ patient_id: patientId, display_name: NAME, role: "patient" })
    .eq("user_id", userId);
  if (profErr) throw new Error(`Failed to update profile: ${profErr.message}`);
});

test.afterAll(async () => {
  if (!sb) return;
  // Clean up in dependency order
  if (patientId) {
    await sb.from("diary_entries").delete().eq("patient_id", patientId);
    await sb.from("vitals").delete().eq("patient_id", patientId);
    await sb.from("medications").delete().eq("patient_id", patientId);
    await sb.from("documents").delete().eq("patient_id", patientId);
    await sb.from("timeline_events").delete().eq("patient_id", patientId);
    await sb.from("medication_intakes").delete().eq("patient_id", patientId);
    await sb.from("doctor_visit_preps").delete().eq("patient_id", patientId);
  }
  if (userId) {
    await sb.from("profiles").delete().eq("user_id", userId);
  }
  if (patientId) {
    await sb.from("patients").delete().eq("id", patientId);
  }
  if (userId) {
    await sb.auth.admin.deleteUser(userId);
  }
});

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
test("first arrival overlay shows after onboarding and dismisses correctly", async ({
  page,
}) => {
  test.setTimeout(90_000); // onboarding has many steps with animations

  // ── 1. Login ──────────────────────────────────────────────────────────
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Should redirect to /dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  // ── 2. Onboarding gate should be visible ──────────────────────────────
  // The gate is a fixed overlay with z-[100]
  const gate = page.locator(".fixed.inset-0.z-\\[100\\]");
  await expect(gate).toBeVisible({ timeout: 10_000 });

  // ── 3. Walk through onboarding ────────────────────────────────────────
  // Step: intro → skip typing → click "Хорошо, давайте"
  await skipTyping(page);
  await page.getByText("Хорошо, давайте").click();

  // Step: fork → skip typing → choose "diagnosis" branch
  await skipTyping(page);
  await page.getByText("У меня есть диагноз или хроническое состояние").click();

  // Step: branch_a → skip typing → click "Дальше"
  await skipTyping(page);
  await page.getByRole("button", { name: "Дальше" }).click();

  // Step: focus_ab → skip typing → choose first option
  await skipTyping(page);
  await page
    .getByText("Есть симптомы или вопросы, на которые пока нет ответа")
    .click();

  // Step: transition → skip typing → click "Дальше"
  await skipTyping(page);
  await page.getByRole("button", { name: "Дальше" }).click();

  // Step: context_ab → skip typing → type context → click "Готово"
  await skipTyping(page);
  await page.locator("textarea").fill("Тестовый контекст для e2e");
  await page.getByRole("button", { name: "Готово" }).click();

  // Step: handoff → skip typing → click "Войти в MedHub"
  await skipTyping(page);
  await page.getByRole("button", { name: "Войти в MedHub" }).click();

  // ── 4. Dashboard should load ──────────────────────────────────────────
  // The onboarding gate should disappear, dashboard content should show
  await expect(gate).not.toBeVisible({ timeout: 15_000 });

  // ── 5. First Arrival Overlay should appear after ~1.8s ────────────────
  const overlayText = page.getByText("Ты внутри.");
  await expect(overlayText).toBeVisible({ timeout: 8_000 });

  const dismissBtn = page.getByRole("button", { name: "Начнём" });
  await expect(dismissBtn).toBeVisible();

  // ── 6. Dismiss the overlay ────────────────────────────────────────────
  await dismissBtn.click();

  // Overlay should disappear (400ms leave animation)
  await expect(overlayText).not.toBeVisible({ timeout: 3_000 });

  // ── 7. Reload — overlay should NOT reappear ───────────────────────────
  await page.reload();
  // Wait for dashboard to load
  await page.waitForLoadState("networkidle");

  // Wait longer than DELAY_MS (1800ms) to be sure
  await page.waitForTimeout(3_000);
  await expect(overlayText).not.toBeVisible();
});
