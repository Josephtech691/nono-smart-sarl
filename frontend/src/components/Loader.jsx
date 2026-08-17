export default function Loader({ label = 'Chargement...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink/60">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
