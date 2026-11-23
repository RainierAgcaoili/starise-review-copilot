import { describe, expect, it } from "vitest";
import { aiTriageSchema, createReviewSchema, updateReplySchema } from "@/lib/validations";

const validReview = { locationId: "loc_1", rating: 4, tags: ["service"], comment: "Great", customerName: "Ann" };

describe("createReviewSchema", () => {
  it("accepts a valid payload", () => {
    expect(createReviewSchema.safeParse(validReview).success).toBe(true);
  });

  it.each([1, 5])("accepts boundary rating %i", (rating) => {
    expect(createReviewSchema.safeParse({ ...validReview, rating }).success).toBe(true);
  });

  it.each([0, 6])("rejects rating %i", (rating) => {
    expect(createReviewSchema.safeParse({ ...validReview, rating }).success).toBe(false);
  });

  it("normalizes empty comment and customerName to undefined", () => {
    const result = createReviewSchema.parse({ ...validReview, comment: "", customerName: "   " });
    expect(result.comment).toBeUndefined();
    expect(result.customerName).toBeUndefined();
  });

  it("rejects more than 8 tags", () => {
    const tags = Array.from({ length: 9 }, (_, i) => `t${i}`);
    expect(createReviewSchema.safeParse({ ...validReview, tags }).success).toBe(false);
  });

  it("accepts exactly 8 tags", () => {
    const tags = Array.from({ length: 8 }, (_, i) => `t${i}`);
    expect(createReviewSchema.safeParse({ ...validReview, tags }).success).toBe(true);
  });
});

describe("aiTriageSchema", () => {
  const valid = { sentiment: "POSITIVE", isUrgent: false, urgencyReason: null, draftReply: "Thanks!" };

  it("accepts valid output", () => {
    expect(aiTriageSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown sentiment", () => {
    expect(aiTriageSchema.safeParse({ ...valid, sentiment: "MIXED" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    const { sentiment, urgencyReason, draftReply } = valid;
    expect(aiTriageSchema.safeParse({ sentiment, urgencyReason, draftReply }).success).toBe(false);
  });

  it("rejects an empty draftReply", () => {
    expect(aiTriageSchema.safeParse({ ...valid, draftReply: "" }).success).toBe(false);
  });
});

describe("updateReplySchema", () => {
  it.each(["DRAFT", "APPROVED"])("accepts status %s", (status) => {
    expect(updateReplySchema.safeParse({ draftReply: "Hello", status }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(updateReplySchema.safeParse({ draftReply: "Hello", status: "SENT" }).success).toBe(false);
  });

  it("rejects a blank reply", () => {
    expect(updateReplySchema.safeParse({ draftReply: "   ", status: "DRAFT" }).success).toBe(false);
  });
});
