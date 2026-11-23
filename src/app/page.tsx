import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/components/ReviewForm";

async function ReviewLoader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { location } = await searchParams;
  const slug = typeof location === "string" ? location : undefined;
  const locations = await prisma.location.findMany({
    select: { id: true, name: true, slug: true, city: true },
    orderBy: { name: "asc" },
  });
  const scanned = slug ? locations.find((l) => l.slug === slug) : undefined;
  return (
    <ReviewForm
      locations={locations}
      initialLocationId={scanned?.id ?? null}
      scanned={Boolean(scanned)}
    />
  );
}

function FormSkeleton() {
  return (
    <div
      className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-stone-200"
      aria-hidden="true"
    />
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <main className="flex-1 bg-stone-100 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <Suspense fallback={<FormSkeleton />}>
          <ReviewLoader searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
