import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateReviewTriage } from "@/lib/ai-triage";
import { createReviewSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locationId = params.get("locationId");
  const urgentOnly = params.get("urgentOnly") === "true";

  const reviews = await prisma.review.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(urgentOnly ? { aiResponse: { is: { isUrgent: true } } } : {}),
    },
    include: { location: true, aiResponse: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reviews);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const triage = await generateReviewTriage(input, location.name);

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        locationId: input.locationId,
        rating: input.rating,
        tags: input.tags,
        comment: input.comment,
        customerName: input.customerName,
      },
    });
    const aiResponse = await tx.aIResponse.create({
      data: {
        reviewId: created.id,
        sentiment: triage.sentiment,
        isUrgent: triage.isUrgent,
        urgencyReason: triage.urgencyReason,
        draftReply: triage.draftReply,
        status: triage.status,
        modelUsed: triage.modelUsed,
      },
    });
    return { ...created, aiResponse };
  });

  return NextResponse.json(review, { status: 201 });
}
