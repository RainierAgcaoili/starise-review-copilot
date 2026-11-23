import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const tx = { review: { create: vi.fn() }, aIResponse: { create: vi.fn() } };
  return {
    tx,
    prisma: {
      location: { findUnique: vi.fn() },
      review: { findMany: vi.fn() },
      aIResponse: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(),
    },
    generateReviewTriage: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/ai-triage", () => ({ generateReviewTriage: mocks.generateReviewTriage }));

import { GET, POST } from "@/app/api/reviews/route";
import { PATCH } from "@/app/api/reviews/[id]/reply/route";

const triage = {
  sentiment: "POSITIVE",
  isUrgent: false,
  urgencyReason: null,
  draftReply: "Thanks!",
  status: "DRAFT",
  modelUsed: "gemini-3.8-flash",
};

const jsonRequest = (url: string, method: string, body: unknown) =>
  new NextRequest(url, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (fn: (t: typeof mocks.tx) => unknown) => fn(mocks.tx));
  mocks.generateReviewTriage.mockResolvedValue(triage);
});

describe("POST /api/reviews", () => {
  const valid = { locationId: "loc_1", rating: 5, tags: ["food"], comment: "Great" };

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest("http://localhost/api/reviews", "POST", { ...valid, rating: 9 }));
    expect(res.status).toBe(400);
    expect(mocks.prisma.location.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(jsonRequest("http://localhost/api/reviews", "POST", "{nope"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the location does not exist", async () => {
    mocks.prisma.location.findUnique.mockResolvedValue(null);
    const res = await POST(jsonRequest("http://localhost/api/reviews", "POST", valid));
    expect(res.status).toBe(404);
    expect(mocks.generateReviewTriage).not.toHaveBeenCalled();
  });

  it("returns 201 and persists review + AI response", async () => {
    mocks.prisma.location.findUnique.mockResolvedValue({ id: "loc_1" });
    mocks.tx.review.create.mockResolvedValue({ id: "rev_1", ...valid });
    mocks.tx.aIResponse.create.mockResolvedValue({ id: "ai_1", reviewId: "rev_1", ...triage });

    const res = await POST(jsonRequest("http://localhost/api/reviews", "POST", valid));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("rev_1");
    expect(json.aiResponse.status).toBe("DRAFT");
    expect(mocks.tx.aIResponse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewId: "rev_1", sentiment: "POSITIVE", modelUsed: "gemini-3.8-flash" }),
    });
  });
});

describe("GET /api/reviews", () => {
  beforeEach(() => mocks.prisma.review.findMany.mockResolvedValue([]));

  it("applies no filters by default", async () => {
    const res = await GET(new NextRequest("http://localhost/api/reviews"));
    expect(res.status).toBe(200);
    expect(mocks.prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("passes locationId and urgentOnly filters", async () => {
    await GET(new NextRequest("http://localhost/api/reviews?locationId=loc_1&urgentOnly=true"));
    expect(mocks.prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { locationId: "loc_1", aiResponse: { is: { isUrgent: true } } },
      }),
    );
  });
});

describe("PATCH /api/reviews/[id]/reply", () => {
  const call = (body: unknown) =>
    PATCH(jsonRequest("http://localhost/api/reviews/rev_1/reply", "PATCH", body), {
      params: Promise.resolve({ id: "rev_1" }),
    });

  it("returns 400 on an invalid status", async () => {
    const res = await call({ draftReply: "Hi", status: "SENT" });
    expect(res.status).toBe(400);
    expect(mocks.prisma.aIResponse.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the review/reply is not found", async () => {
    mocks.prisma.aIResponse.findUnique.mockResolvedValue(null);
    const res = await call({ draftReply: "Hi", status: "APPROVED" });
    expect(res.status).toBe(404);
    expect(mocks.prisma.aIResponse.update).not.toHaveBeenCalled();
  });

  it("returns 200 on a valid approval", async () => {
    mocks.prisma.aIResponse.findUnique.mockResolvedValue({ id: "ai_1", reviewId: "rev_1" });
    mocks.prisma.aIResponse.update.mockResolvedValue({ id: "ai_1", draftReply: "Hi", status: "APPROVED" });
    const res = await call({ draftReply: "Hi", status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(mocks.prisma.aIResponse.update).toHaveBeenCalledWith({
      where: { reviewId: "rev_1" },
      data: { draftReply: "Hi", status: "APPROVED" },
    });
    expect((await res.json()).status).toBe("APPROVED");
  });
});
