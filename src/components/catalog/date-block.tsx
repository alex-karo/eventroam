export function DateBlock({ date }: Readonly<{ date: string }>) {
  const month = new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="edition-date" aria-hidden="true">
      <span>{month}</span>
      <strong>{Number(date.slice(-2))}</strong>
    </div>
  );
}
