import { useEffect } from 'react';

const DEFAULT_TITLE = 'Fresh Fish — Silures frais & Alevins livrés à Yaoundé';

function setMeta(name, content) {
  if (!content) return;
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Titre d'onglet + meta description propres a chaque page (utile pour le
 * partage, l'historique du navigateur et le referencement).
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — Fresh Fish` : DEFAULT_TITLE;
    setMeta('description', description);
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description]);
}
