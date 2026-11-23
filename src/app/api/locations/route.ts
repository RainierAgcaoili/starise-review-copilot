import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [locations, stats] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.review.groupBy({
      by: ["locationId"],
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);

  const byLocation = new Map(stats.map((s) => [s.locationId, s]));

  return NextResponse.json(
    locations.map((location) => {
      const s = byLocation.get(location.id);
      const avg = s?._avg.rating;
      return {
        ...location,
        reviewCount: s?._count._all ?? 0,
        averageRating: avg == null ? null : Math.round(avg * 10) / 10,
      };
    }),
  );
}
