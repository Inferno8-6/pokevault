"use client";

export function StarRating({
  score,
  small = false,
}: {
  score: number;
  small?: boolean;
}) {
  const filled = Math.round(score);
  return (
    <span className={small ? "text-xs" : "text-sm"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= filled ? "text-[var(--primary)]" : "text-[var(--border)]"}
        >
          ★
        </span>
      ))}
    </span>
  );
}
