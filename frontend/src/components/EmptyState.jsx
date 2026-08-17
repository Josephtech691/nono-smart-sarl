export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      {Icon && <Icon className="h-10 w-10 text-ink/30" strokeWidth={1.5} />}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink/60">{description}</p>}
      {action}
    </div>
  );
}
