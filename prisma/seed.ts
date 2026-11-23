import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, Sentiment, ReplyStatus } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const locations = [
  { slug: "the-pearl-marina-cafe", name: "The Pearl Marina Cafe", city: "Doha" },
  { slug: "msheireb-artisanal-roastery", name: "Msheireb Artisanal Roastery", city: "Doha" },
  { slug: "west-bay-courtyard-kitchen", name: "West Bay Courtyard Kitchen", city: "Doha" },
];

type SeedReview = {
  id: string;
  location: string;
  rating: number;
  tags: string[];
  comment: string | null;
  customerName: string | null;
  daysAgo: number;
  ai: {
    sentiment: Sentiment;
    isUrgent?: boolean;
    urgencyReason?: string;
    draftReply: string;
    status: ReplyStatus;
    modelUsed: string;
  };
};

const reviews: SeedReview[] = [
  {
    id: "seed-review-01",
    location: "the-pearl-marina-cafe",
    rating: 5,
    tags: ["service", "view", "coffee"],
    comment: "Lovely marina view and the flat white was perfect. Staff were welcoming.",
    customerName: "Noora A.",
    daysAgo: 2,
    ai: {
      sentiment: "POSITIVE",
      status: "APPROVED",
      modelUsed: "gemini-3.8-flash",
      draftReply:
        "Thank you, Noora! We're delighted you enjoyed the view and your flat white. We look forward to welcoming you back to the marina soon.",
    },
  },
  {
    id: "seed-review-02",
    location: "the-pearl-marina-cafe",
    rating: 2,
    tags: ["wait-time", "service"],
    comment: "Waited 40 minutes for a sandwich on a quiet weekday. Nobody apologised.",
    customerName: "James R.",
    daysAgo: 5,
    ai: {
      sentiment: "NEGATIVE",
      status: "DRAFT",
      modelUsed: "gemini-3.8-flash",
      draftReply:
        "We're sorry about the long wait, James, and that no one acknowledged it. This isn't the standard we aim for. We've shared your feedback with the team and would welcome the chance to make it right.",
    },
  },
  {
    id: "seed-review-03",
    location: "msheireb-artisanal-roastery",
    rating: 4,
    tags: ["coffee", "ambience"],
    comment: "Excellent single-origin pour-over. Seating is limited at peak hours.",
    customerName: "Fatima K.",
    daysAgo: 3,
    ai: {
      sentiment: "POSITIVE",
      status: "DRAFT",
      modelUsed: "gemini-3.8-flash",
      draftReply:
        "Thank you, Fatima! Glad the pour-over hit the mark. We're working on more seating for busy hours and hope to see you again.",
    },
  },
  {
    id: "seed-review-04",
    location: "msheireb-artisanal-roastery",
    rating: 3,
    tags: ["price", "pastries"],
    comment: "Coffee was good but pastries were stale and a bit pricey.",
    customerName: null,
    daysAgo: 8,
    ai: {
      sentiment: "NEUTRAL",
      status: "FALLBACK",
      modelUsed: "fallback-template",
      draftReply:
        "Thank you for your feedback. We appreciate you taking the time to share your experience and will review our pastry freshness and pricing.",
    },
  },
  {
    id: "seed-review-05",
    location: "west-bay-courtyard-kitchen",
    rating: 1,
    tags: ["food-safety", "hygiene"],
    comment:
      "Got sick after the chicken shawarma plate. Felt unwell for two days. Kitchen looked unclean.",
    customerName: "Omar S.",
    daysAgo: 1,
    ai: {
      sentiment: "NEGATIVE",
      isUrgent: true,
      urgencyReason:
        "Possible food-safety incident (illness reported after meal); escalate to management immediately.",
      status: "DRAFT",
      modelUsed: "gemini-3.8-flash",
      draftReply:
        "Omar, we are very sorry to hear you were unwell. We take this extremely seriously and our manager will contact you directly to learn more. Please reach out to us so we can investigate.",
    },
  },
  {
    id: "seed-review-06",
    location: "west-bay-courtyard-kitchen",
    rating: 5,
    tags: ["food", "courtyard", "service"],
    comment: "Best mezze in West Bay. The courtyard is beautiful in the evening.",
    customerName: "Layla M.",
    daysAgo: 4,
    ai: {
      sentiment: "POSITIVE",
      status: "APPROVED",
      modelUsed: "gemini-3.8-flash",
      draftReply:
        "Thank you, Layla! We're thrilled you loved the mezze and the courtyard evenings. See you again soon!",
    },
  },
];

async function main() {
  const locationIds = new Map<string, string>();
  for (const loc of locations) {
    const row = await prisma.location.upsert({
      where: { slug: loc.slug },
      update: { name: loc.name, city: loc.city },
      create: loc,
    });
    locationIds.set(loc.slug, row.id);
  }

  for (const r of reviews) {
    const locationId = locationIds.get(r.location);
    if (!locationId) throw new Error(`Unknown location ${r.location}`);
    const data = {
      locationId,
      rating: r.rating,
      tags: r.tags,
      comment: r.comment,
      customerName: r.customerName,
    };
    const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000);
    await prisma.review.upsert({
      where: { id: r.id },
      update: data,
      create: { id: r.id, createdAt, ...data },
    });
    const ai = {
      sentiment: r.ai.sentiment,
      isUrgent: r.ai.isUrgent ?? false,
      urgencyReason: r.ai.urgencyReason ?? null,
      draftReply: r.ai.draftReply,
      status: r.ai.status,
      modelUsed: r.ai.modelUsed,
    };
    await prisma.aIResponse.upsert({
      where: { reviewId: r.id },
      update: ai,
      create: { reviewId: r.id, ...ai },
    });
  }
  console.log(`Seeded ${locations.length} locations, ${reviews.length} reviews.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
