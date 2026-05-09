type MetricCardProps = {
  label: string;
  value: string;
  note?: string;
  tone?: "aqua" | "lime" | "amber";
};

const toneClass = {
  aqua: "text-aqua",
  lime: "text-lime",
  amber: "text-amber"
};

export default function MetricCard({ label, value, note, tone = "aqua" }: MetricCardProps) {
  return (
    <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-400">{note}</p> : null}
    </section>
  );
}
