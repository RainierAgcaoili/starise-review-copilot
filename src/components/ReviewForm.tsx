"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

type LocationOption = { id: string; name: string; slug: string; city: string };

type Props = {
  locations: LocationOption[];
  initialLocationId: string | null;
  scanned: boolean;
};

const RATING_LABELS = ["1 - Very Poor", "2 - Poor", "3 - Average", "4 - Good", "5 - Excellent"];

const TAGS = [
  "Friendly Staff",
  "Fast Service",
  "Food & Drink Quality",
  "Cleanliness",
  "Wait Time",
  "Order Accuracy",
  "Atmosphere",
];

const COMMENT_MAX = 1000;

const successSchema = z.object({ id: z.string().min(1) });
const errorSchema = z.object({ error: z.string() });

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z"
        fill={filled ? "#b45309" : "none"}
        stroke={filled ? "#b45309" : "#78716c"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} filled={n <= value} />
      ))}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ReviewForm({ locations, initialLocationId, scanned }: Props) {
  const [locationId, setLocationId] = useState(initialLocationId ?? "");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ rating: number; locationName: string } | null>(null);

  const location = locations.find((l) => l.id === locationId);
  const shown = hover || rating;
  const canSubmit = Boolean(location) && rating > 0 && !submitting;

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!location || rating === 0) {
      setError("Please choose a location and a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          rating,
          tags,
          comment: comment.trim() || undefined,
          customerName: customerName.trim() || undefined,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !successSchema.safeParse(data).success) {
        const parsedError = errorSchema.safeParse(data);
        setError(
          parsedError.success && res.status < 500
            ? parsedError.data.error
            : "We could not submit your feedback. Please try again.",
        );
        return;
      }
      setSubmitted({ rating, locationName: location.name });
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setRating(0);
    setHover(0);
    setTags([]);
    setComment("");
    setCustomerName("");
    setError(null);
    setSubmitted(null);
  }

  if (submitted) {
    return (
      <section
        aria-live="polite"
        className="animate-[fadeIn_300ms_ease-out] rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200 sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900">Thank you!</h1>
        <p className="mt-2 text-stone-700">Your feedback helps us serve you better.</p>
        <div className="mt-5 flex justify-center">
          <Stars value={submitted.rating} />
        </div>
        <p className="mt-1 text-sm font-medium text-stone-800">{RATING_LABELS[submitted.rating - 1]}</p>
        <p className="mt-1 text-sm text-stone-600">{submitted.locationName}</p>
        <button
          type="button"
          onClick={reset}
          className={`mt-6 min-h-12 w-full rounded-xl bg-stone-900 px-5 font-semibold text-white transition-colors hover:bg-stone-700 ${focusRing}`}
        >
          Submit Another Review
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-8"
    >
      <header>
        <h1 className="text-2xl font-bold text-stone-900">How was your visit?</h1>
        <p className="mt-1 text-sm text-stone-600">Takes about 30 seconds.</p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="location" className="block text-sm font-semibold text-stone-900">
          1. Location
        </label>
        <select
          id="location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          required
          className={`mt-2 min-h-12 w-full rounded-xl border border-stone-400 bg-white px-3 text-base text-stone-900 ${focusRing}`}
        >
          <option value="" disabled>
            Select a location…
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.city}
            </option>
          ))}
        </select>
        {scanned && locationId === initialLocationId && (
          <p className="mt-1 text-xs text-stone-600">Pre-selected from your table QR code.</p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-stone-900">2. Rating</legend>
        <div
          role="radiogroup"
          aria-label="Star rating"
          className="mt-2 flex gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {RATING_LABELS.map((label, i) => {
            const n = i + 1;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={label}
                title={label}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                className={`flex h-12 w-12 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95 ${focusRing}`}
              >
                <StarIcon filled={n <= shown} />
              </button>
            );
          })}
        </div>
        <p className="mt-1 min-h-5 text-sm font-medium text-stone-800" aria-live="polite">
          {shown ? RATING_LABELS[shown - 1] : "Tap a star to rate"}
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-stone-900">3. What stood out? (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${focusRing} ${
                  on
                    ? "border-amber-800 bg-amber-800 text-white"
                    : "border-stone-400 bg-white text-stone-800 hover:bg-stone-100"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-4">
        <div>
          <label htmlFor="comment" className="block text-sm font-semibold text-stone-900">
            4. Comments (optional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={4}
            placeholder="Tell us more about your visit"
            className={`mt-2 w-full resize-none rounded-xl border border-stone-400 p-3 text-base text-stone-900 placeholder:text-stone-500 ${focusRing}`}
          />
          <p className="mt-1 text-right text-xs text-stone-600">
            {comment.length}/{COMMENT_MAX}
          </p>
        </div>
        <div>
          <label htmlFor="name" className="sr-only">
            Your Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={80}
            autoComplete="given-name"
            placeholder="Your Name (optional)"
            className={`min-h-12 w-full rounded-xl border border-stone-400 px-3 text-base text-stone-900 placeholder:text-stone-500 ${focusRing}`}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-800 px-5 text-base font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-400 ${focusRing}`}
      >
        {submitting ? (
          <>
            <Spinner />
            Submitting feedback...
          </>
        ) : (
          "Submit Review"
        )}
      </button>
    </form>
  );
}
