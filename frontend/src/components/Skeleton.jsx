// Ecrans squelettes (style "shimmer") pour un chargement plus premium que
// des spinners generiques - utilises sur les grilles produits et listes.
export function ProductCardSkeleton() {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="mt-2 skeleton h-6 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-16 w-full rounded-xl2" />
      ))}
    </div>
  );
}

export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-6 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
