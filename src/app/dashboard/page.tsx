import type { Metadata } from "next";
import { DashboardClient } from "@/components/DashboardClient";

export const metadata: Metadata = {
  title: "Manager Dashboard | Starise Copilot",
};

export default function DashboardPage() {
  return (
    <main className="flex-1 bg-stone-100 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <DashboardClient />
      </div>
    </main>
  );
}
