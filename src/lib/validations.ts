import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const createReviewSchema = z.object({
  locationId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1)).max(8),
  comment: optionalTrimmed(1000),
  customerName: optionalTrimmed(80),
});

export const aiTriageSchema = z.object({
  sentiment: z
    .enum(["POSITIVE", "NEUTRAL", "NEGATIVE"])
    .describe("Overall sentiment of the review, judged from the comment, tags and rating."),
  isUrgent: z
    .boolean()
    .describe("True if the review mentions hygiene, food safety, allergens, staff misconduct, or a severe service failure."),
  urgencyReason: z
    .string()
    .nullable()
    .describe("Concise reason the review is urgent; null when isUrgent is false."),
  draftReply: z
    .string()
    .min(1)
    .max(800)
    .describe(
      "Concise 2-3 sentence reply that greets the guest by name when provided, explicitly references at least one concrete detail from the review comment or tags, and signs off on behalf of the venue. No refund, comp, or discount promises.",
    ),
});

export const updateReplySchema = z.object({
  draftReply: z.string().trim().min(1).max(1000),
  status: z.enum(["DRAFT", "APPROVED"]),
});

export const reviewIdSchema = z.string().min(1);

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type AiTriage = z.infer<typeof aiTriageSchema>;
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;
