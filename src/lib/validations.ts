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
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  isUrgent: z.boolean(),
  urgencyReason: z.string().nullable(),
  draftReply: z.string().min(1).max(800),
});

export const updateReplySchema = z.object({
  draftReply: z.string().trim().min(1).max(1000),
  status: z.enum(["DRAFT", "APPROVED"]),
});

export const reviewIdSchema = z.string().min(1);

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type AiTriage = z.infer<typeof aiTriageSchema>;
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;
