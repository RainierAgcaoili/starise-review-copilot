import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reviewIdSchema, updateReplySchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const idResult = reviewIdSchema.safeParse((await params).id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.aIResponse.findUnique({ where: { reviewId: idResult.data } });
  if (!existing) {
    return NextResponse.json({ error: "Review or AI response not found" }, { status: 404 });
  }

  const updated = await prisma.aIResponse.update({
    where: { reviewId: idResult.data },
    data: { draftReply: parsed.data.draftReply, status: parsed.data.status },
  });

  return NextResponse.json(updated, { status: 200 });
}
