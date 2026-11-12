/**
 * Bandeau d'en-tete des pages d'information (A propos, Livraison...).
 * `children` = boutons d'action affiches sous le sous-titre.
 */
export default function PageHero({ eyebrow, title, subtitle, image, imageAlt = '', children }) {
  return (
    <section className="relative overflow-hidden bg-pine-900">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full border border-white/10" aria-hidden="true" />

      <div className={`relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:py-20 ${image ? 'md:grid-cols-2 md:items-center' : ''}`}>
        <div className="animate-fade-up">
          {eyebrow && (
            <p className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-500">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
          {subtitle && <p className="mt-4 max-w-xl text-base text-white/70">{subtitle}</p>}
          {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
        </div>

        {image && (
          <div className="animate-fade-up md:justify-self-end">
            <img
              src={image}
              alt={imageAlt}
              className="aspect-[4/3] w-full max-w-md rounded-xl2 object-cover shadow-card ring-1 ring-white/10"
            />
          </div>
        )}
      </div>
    </section>
  );
}
