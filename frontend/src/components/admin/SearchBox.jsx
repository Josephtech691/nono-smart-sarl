import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

const DELAY_MS = 400;

/**
 * Champ de recherche d'une liste : la recherche part 0,4 s après la dernière frappe (ou tout de suite
 * avec Entrée) pour ne pas interroger le serveur à chaque lettre.
 * `value` est la recherche en cours dans l'adresse de la page ; `onSearch(texte)` la met à jour.
 */
export default function SearchBox({ value, onSearch, placeholder = 'Rechercher…', label = 'Rechercher' }) {
  const [text, setText] = useState(value);
  // Le parent passe souvent une nouvelle fonction à chaque rendu : on garde la dernière sans relancer le minuteur.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Une recherche changée de l'extérieur (« réinitialiser », retour arrière) met le champ à jour,
  // sans effacer les espaces que l'on est en train de taper.
  useEffect(() => {
    setText((current) => (current.trim() === value ? current : value));
  }, [value]);

  useEffect(() => {
    if (text.trim() === value) return undefined;
    const timer = setTimeout(() => onSearchRef.current(text.trim()), DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() !== value) onSearch(text.trim());
      }}
      className="relative"
    >
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={80}
        className="input !pl-10 !pr-10"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onSearch('');
          }}
          aria-label="Effacer la recherche"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink/40 hover:bg-mist hover:text-ink"
        >
          <X size={16} />
        </button>
      )}
    </form>
  );
}
