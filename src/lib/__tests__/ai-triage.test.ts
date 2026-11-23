import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { buildFallbackTriage, generateReviewTriage } from "@/lib/ai-triage";
import type { CreateReviewInput } from "@/lib/validations";

const input: CreateReviewInput = { locationId: "loc_1", rating: 5, tags: [], comment: "Lovely stay", customerName: undefined };
const validJson = JSON.stringify({
  sentiment: "POSITIVE",
  isUrgent: false,
  urgencyReason: null,
  draftReply: "Thank you for staying with us!",
});
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  generateContent.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function runWithRetryDelay(ms = 750) {
  vi.useFakeTimers();
  const promise = generateReviewTriage(input);
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

describe("generateReviewTriage", () => {
  it("returns a DRAFT for valid structured JSON", async () => {
    generateContent.mockResolvedValueOnce({ text: validJson });
    const result = await generateReviewTriage(input);
    expect(result).toMatchObject({ status: "DRAFT", modelUsed: "gemini-3.8-flash", sentiment: "POSITIVE" });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("recovers from a single 503 via retry", async () => {
    generateContent.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce({ text: validJson });
    const result = await runWithRetryDelay();
    expect(result.status).toBe("DRAFT");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("retries on 429", async () => {
    generateContent.mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce({ text: validJson });
    const result = await runWithRetryDelay();
    expect(result.status).toBe("DRAFT");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("fails over to flash-lite after the primary model returns 503 twice", async () => {
    generateContent
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ text: validJson });
    const result = await runWithRetryDelay();
    expect(result).toMatchObject({ status: "DRAFT", modelUsed: "gemini-3.8-flash-lite" });
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.8-flash",
      "gemini-3.8-flash-lite",
    ]);
  });

  it("falls back to the template when all models fail", async () => {
    generateContent.mockRejectedValue(httpError(503));
    const result = await runWithRetryDelay(1500);
    expect(result).toMatchObject({ status: "FALLBACK", modelUsed: "fallback-template" });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it("does not duplicate the model when GEMINI_MODEL equals the failover model", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash-lite");
    generateContent.mockRejectedValue(httpError(400));
    const result = await generateReviewTriage(input);
    expect(result.status).toBe("FALLBACK");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-transient errors", async () => {
    generateContent.mockRejectedValue(httpError(400));
    const result = await generateReviewTriage(input);
    expect(result.status).toBe("FALLBACK");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("falls back on malformed JSON without throwing", async () => {
    generateContent.mockResolvedValue({ text: "not json {" });
    const result = await generateReviewTriage(input);
    expect(result).toMatchObject({ status: "FALLBACK", modelUsed: "fallback-template" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("falls back on schema validation failure without retrying", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ sentiment: "MIXED" }) });
    const result = await generateReviewTriage(input);
    expect(result.status).toBe("FALLBACK");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("falls back without calling Gemini when no API key is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await generateReviewTriage(input);
    expect(result.status).toBe("FALLBACK");
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe("buildFallbackTriage", () => {
  const make = (rating: number, extra: Partial<CreateReviewInput> = {}): CreateReviewInput => ({
    comment: undefined,
    customerName: undefined,
    locationId: "loc_1",
    rating,
    tags: [],
    ...extra,
  });

  it.each([
    [1, "NEGATIVE"],
    [2, "NEGATIVE"],
    [3, "NEUTRAL"],
    [4, "POSITIVE"],
    [5, "POSITIVE"],
  ])("maps rating %i to %s", (rating, sentiment) => {
    expect(buildFallbackTriage(make(rating)).sentiment).toBe(sentiment);
  });

  it("flags urgency from keywords in the comment", () => {
    const result = buildFallbackTriage(make(4, { comment: "I think I got food poisoning" }));
    expect(result.isUrgent).toBe(true);
    expect(result.urgencyReason).toBeTruthy();
  });

  it("flags urgency from keywords in tags", () => {
    expect(buildFallbackTriage(make(3, { tags: ["rude staff"] })).isUrgent).toBe(true);
  });

  it("flags 1-star reviews as urgent without keywords", () => {
    expect(buildFallbackTriage(make(1, { comment: "Meh" })).isUrgent).toBe(true);
  });

  it("is not urgent for a 2-star review without keywords", () => {
    const result = buildFallbackTriage(make(2, { comment: "Slow service" }));
    expect(result.isUrgent).toBe(false);
    expect(result.urgencyReason).toBeNull();
  });

  it("marks results as FALLBACK / fallback-template", () => {
    expect(buildFallbackTriage(make(5))).toMatchObject({ status: "FALLBACK", modelUsed: "fallback-template" });
  });
});
