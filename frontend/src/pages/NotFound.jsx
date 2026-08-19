import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <img src="/brand/logo-icon-raw.png" alt="" className="h-24 w-auto opacity-40" />
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Page introuvable</h1>
      <p className="mt-2 text-ink/60">Cette page n'existe pas ou plus.</p>
      <Link to="/" className="btn-primary mt-6">Retour à l'accueil</Link>
    </div>
  );
}
