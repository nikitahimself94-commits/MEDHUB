import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Haiku paraphrase layer v1 — controlled model variation for hero opening.
//
// Takes a deterministic base opening and returns a slight paraphrase.
// On any failure (timeout, error, missing key, bad output) returns null
// so the caller can fall back to the deterministic base.
//
// Guardrails (enforced in code, not just in prompt):
//   - Output length <= base length
//   - One sentence only (no multiple sentence-enders)
//   - Must preserve user name if present in base
//   - Must preserve greeting shape (start with time-of-day greeting)
//   - No multi-line, no empty, no suspiciously short
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 2000;
const MAX_TOKENS = 60;

const TIME_GREETING_STARTS = ["доброе", "добрый", "доброй"];

const SYSTEM_PROMPT = `Ты — внутренний стилист медицинского ассистента MedHUB.

Задача: слегка перефразировать приветственную фразу агента.

Жёсткие правила:
- Ровно одно предложение, русский язык
- Результат НЕ длиннее оригинала
- Сохрани имя пользователя и приветствие времени суток из оригинала дословно
- Не добавляй новых фактов, диагнозов, советов
- Не добавляй эмодзи
- Не меняй смысл — только слегка освежи вторую часть фразы (после приветствия)
- Тон: спокойный, собранный, не болтливый
- Верни ТОЛЬКО перефразированную строку, без кавычек, без пояснений`;

/**
 * Paraphrase a hero opening line using Haiku.
 * Returns the paraphrased string, or null on any failure.
 */
export async function paraphraseHeroOpening(
  baseOpening: string,
  greetingContext: string,
  timeOfDay: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Skip paraphrase for empty/trivial openings
  if (!baseOpening || baseOpening.length < 10) return null;

  // Skip for returned_today — base is just a greeting with no situational tail
  if (greetingContext === "returned_today") return null;

  // Extract name from base for later validation
  const baseName = extractName(baseOpening);

  try {
    const client = new Anthropic({ apiKey });

    const response = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Контекст: ${greetingContext}, ${timeOfDay}\nОригинал: ${baseOpening}`,
        }],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);

    if (!response) return null; // timeout

    const text = (response as Anthropic.Message).content[0];
    if (!text || text.type !== "text") return null;

    const result = text.text.trim();

    // --- Strict validation ---
    if (!validate(result, baseOpening, baseName)) return null;

    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(result: string, base: string, baseName: string | null): boolean {
  // Non-empty
  if (!result) return false;

  // No multi-line (prompt leak)
  if (result.includes("\n")) return false;

  // Length: must not exceed base
  if (result.length > base.length) return false;

  // Not suspiciously short (less than 40% of base = too aggressive trimming)
  if (result.length < base.length * 0.4) return false;

  // One sentence only: split on sentence-ending punctuation followed by a space + uppercase
  // This catches "Фраза. Другая фраза." but allows "фразу." and trailing "..."
  if (/[.!?…]\s+[А-ЯЁA-Z]/.test(result)) return false;

  // Must end with punctuation
  if (!/[.!?…]$/.test(result)) return false;

  // Greeting shape: must start with a time-of-day greeting (case-insensitive)
  const lower = result.toLowerCase();
  const startsWithGreeting = TIME_GREETING_STARTS.some((g) => lower.startsWith(g));
  if (!startsWithGreeting) return false;

  // Name preserved: if base has a name, result must contain it
  if (baseName && !result.includes(baseName)) return false;

  return true;
}

/**
 * Extract the user's display name from the base opening.
 * Pattern: "Добрый день, ИМЯ — ..." or "Добрый день, ИМЯ."
 * Returns the name or null if not found.
 */
function extractName(base: string): string | null {
  // Match: greeting + comma + space + name (up to em-dash, period, or end)
  const match = base.match(/,\s+([^—.]+?)(?:\s*[—.]|$)/);
  if (!match) return null;
  const name = match[1].trim();
  // Sanity: name should be 1-40 chars, not a full sentence
  if (name.length < 1 || name.length > 40) return null;
  return name;
}
