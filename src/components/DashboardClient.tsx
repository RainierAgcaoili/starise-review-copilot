"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
});

const aiResponseSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  isUrgent: z.boolean(),
  urgencyReason: z.string().nullable(),
  draftReply: z.string(),
  status: z.enum(["DRAFT", "APPROVED", "FALLBACK"]),
  modelUsed: z.string(),
});

const reviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  tags: z.array(z.string()),
  comment: z.string().nullable(),
  customerName: z.string().nullable(),
  createdAt: z.string(),
  location: locationSchema,
  aiResponse: aiResponseSchema.nullable(),
});

const errorSchema = z.object({ error: z.string() });

type Location = z.infer<typeof locationSchema>;
type AiResponse = z.infer<typeof aiResponseSchema>;
type Review = z.infer<typeof reviewSchema>;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700";

const SENTIMENT_STYLES: Record<AiResponse["sentiment"], string> = {
  POSITIVE: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  NEUTRAL: "bg-stone-200 text-stone-800 ring-stone-400",
  NEGATIVE: "bg-red-100 text-red-900 ring-red-300",
};

const STATUS_STYLES: Record<AiResponse["status"], string> = {
  DRAFT: "bg-amber-100 text-amber-900 ring-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  FALLBACK: "bg-orange-100 text-orange-900 ring-orange-300",
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z"
            fill={n <= value ? "#b45309" : "none"}
            stroke={n <= value ? "#b45309" : "#78716c"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function formatRelative(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return "just now";
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "alert";
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ring-1 ${
        tone === "alert" ? "bg-red-50 ring-red-300" : "bg-white ring-stone-200"
      }`}
    >
      <p className={`text-sm font-medium ${tone === "alert" ? "text-red-900" : "text-stone-600"}`}>{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone === "alert" ? "text-red-800" : "text-stone-900"}`}>{value}</p>
    </div>
  );
}

function ReviewCard({
  review,
  onUpdated,
}: {
  review: Review;
  onUpdated: (reviewId: string, aiResponse: AiResponse) => void;
}) {
  const ai = review.aiResponse;
  const [draft, setDraft] = useState(ai?.draftReply ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  async function save(status: "DRAFT" | "APPROVED") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftReply: draft.trim(), status }),
      });
      const data: unknown = await res.json().catch(() => null);
      const parsed = aiResponseSchema.safeParse(data);
      if (!res.ok || !parsed.success) {
        const e = errorSchema.safeParse(data);
        setError(e.success && res.status < 500 ? e.data.error : "Could not save the reply. Please try again.");
        return;
      }
      setDraft(parsed.data.draftReply);
      onUpdated(review.id, parsed.data);
      setFlash(status === "APPROVED" ? "Approved" : "Saved");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && draft.trim().length > 0;

  return (
    <article className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
          {review.location.name}
        </span>
        <Stars value={review.rating} />
        <span className="text-sm font-semibold text-stone-900">{review.customerName ?? "Anonymous Guest"}</span>
        <time
          dateTime={review.createdAt}
          title={new Date(review.createdAt).toLocaleString()}
          className="text-sm text-stone-600"
        >
          {formatRelative(review.createdAt)}
        </time>
        {ai && (
          <span
            className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${SENTIMENT_STYLES[ai.sentiment]}`}
          >
            {ai.sentiment}
          </span>
        )}
      </header>

      {ai?.isUrgent && (
        <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-red-900">
          <p className="text-sm font-bold uppercase tracking-wide">Urgent escalation</p>
          <p className="mt-0.5 text-sm font-medium">{ai.urgencyReason ?? "Flagged as urgent."}</p>
        </div>
      )}

      {review.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {review.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-900">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {review.comment ? (
        <p className="text-stone-800">{review.comment}</p>
      ) : (
        <p className="text-sm italic text-stone-500">No comment left.</p>
      )}

      {ai ? (
        <div className="space-y-2 border-t border-stone-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`reply-${review.id}`} className="text-sm font-semibold text-stone-900">
              AI draft reply
            </label>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[ai.status]}`}>
              {ai.status}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-xs text-stone-700 ring-1 ring-stone-300">
              {ai.modelUsed}
            </span>
          </div>
          <textarea
            id={`reply-${review.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={4}
            disabled={saving}
            className={`w-full resize-y rounded-xl border border-stone-400 p-3 text-base text-stone-900 disabled:bg-stone-100 ${focusRing}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => save("APPROVED")}
              disabled={!canSave}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400 ${focusRing}`}
            >
              {saving && <Spinner />}
              Approve &amp; Publish
            </button>
            <button
              type="button"
              onClick={() => save("DRAFT")}
              disabled={!canSave}
              className={`inline-flex min-h-11 items-center rounded-xl border border-stone-400 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-500 ${focusRing}`}
            >
              Save Draft
            </button>
            <span aria-live="polite" className="text-sm font-semibold text-emerald-800">
              {flash}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-800">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="border-t border-stone-200 pt-3 text-sm text-stone-600">AI triage unavailable for this review.</p>
      )}
    </article>
  );
}

export function DashboardClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [locationId, setLocationId] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (locationId) query.set("locationId", locationId);
    if (urgentOnly) query.set("urgentOnly", "true");

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [revRes, locRes] = await Promise.all([
          fetch(`/api/reviews?${query}`, { signal: controller.signal }),
          fetch("/api/locations", { signal: controller.signal }),
        ]);
        if (!revRes.ok || !locRes.ok) throw new Error("bad status");
        const revs = z.array(reviewSchema).parse(await revRes.json());
        const locs = z.array(locationSchema).parse(await locRes.json());
        setReviews(revs);
        setLocations(locs);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[dashboard] load failed", err instanceof Error ? err.message : String(err));
        setError("Could not load dashboard data. Please try refreshing.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [locationId, urgentOnly, nonce]);

  const handleUpdated = useCallback((reviewId: string, aiResponse: AiResponse) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, aiResponse } : r)));
  }, []);

  const kpis = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : null;
    return {
      total,
      avg: avg === null ? "—" : `${avg.toFixed(1)} ★`,
      urgent: reviews.filter((r) => r.aiResponse?.isUrgent).length,
      pending: reviews.filter((r) => r.aiResponse?.status === "DRAFT" || r.aiResponse?.status === "FALLBACK")
        .length,
    };
  }, [reviews]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-900">Manager Dashboard</h1>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Reviews" value={String(kpis.total)} />
        <KpiCard label="Average Rating" value={kpis.avg} />
        <KpiCard label="Urgent Alerts" value={String(kpis.urgent)} tone={kpis.urgent > 0 ? "alert" : "default"} />
        <KpiCard label="Pending Drafts" value={String(kpis.pending)} />
      </section>

      <section
        aria-label="Filters"
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200"
      >
        <label htmlFor="loc-filter" className="sr-only">
          Location
        </label>
        <select
          id="loc-filter"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className={`min-h-11 rounded-xl border border-stone-400 bg-white px-3 text-sm text-stone-900 ${focusRing}`}
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-stone-900">
          <input
            type="checkbox"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
            className="h-4 w-4 accent-red-700"
          />
          Urgent Issues Only
        </label>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          disabled={loading}
          className={`ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-500 ${focusRing}`}
        >
          {loading && <Spinner />}
          Refresh
        </button>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      <section
        aria-label="Review feed"
        aria-busy={loading}
        className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}
      >
        {!loading && !error && reviews.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-stone-600 ring-1 ring-stone-200">
            No reviews match the current filters.
          </p>
        )}
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} onUpdated={handleUpdated} />
        ))}
      </section>
    </div>
  );
}
