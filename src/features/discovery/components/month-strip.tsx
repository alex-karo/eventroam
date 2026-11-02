export function nearbyMonths(now: Date) {
  return Array.from({ length: 12 }, (_, offset) => {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const last = new Date(year, start.getMonth() + 1, 0).getDate();
    return {
      year,
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(start),
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(last).padStart(2, "0")}`,
    };
  });
}

export function MonthStrip({
  now,
  from,
  to,
  onChange,
}: Readonly<{
  now: Date | null;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}>) {
  const months = now ? nearbyMonths(now) : [];
  const years = [...new Set(months.map((month) => month.year))];
  return (
    <div className="month-strip" role="group" aria-label="Nearby months">
      <button
        type="button"
        className="month-all"
        aria-pressed={!from && !to}
        onClick={() => onChange("", "")}
      >
        All
      </button>
      <div className="month-scroll">
        {years.map((year) => (
          <div className="month-year-group" key={year}>
            <span className="month-year" aria-hidden="true">
              {year}
            </span>
            <div className="month-buttons">
              {months
                .filter((month) => month.year === year)
                .map((month) => (
                  <button
                    type="button"
                    key={month.from}
                    aria-label={`${month.label} ${year}`}
                    aria-pressed={from === month.from && to === month.to}
                    onClick={() => onChange(month.from, month.to)}
                  >
                    {month.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
