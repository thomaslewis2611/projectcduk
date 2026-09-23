/** Pricemark's mark: a price tag. `currentColor` so it takes the text colour. */
export function PricemarkMark({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} fill="none" aria-hidden>
      <path
        d="M1.8 10 8.2 2.2h17.6v15.6H8.2L1.8 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="10" r="1.7" fill="currentColor" />
      <path
        d="M14 13.2 17 10l2.2 2 3.4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PricemarkWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PricemarkMark />
      <span className="text-[1.35rem] font-medium tracking-tight">Pricemark</span>
    </span>
  );
}
