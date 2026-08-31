/**
 * Bloc de chargement "squelette" : un degrade anime (voir tailwind.config,
 * animation "shimmer", deja definie mais inutilisee jusqu'ici) plutot qu'un
 * simple texte "Chargement…" - la forme du contenu a venir se devine avant
 * qu'il n'arrive, ce qui rend l'attente moins vide a l'oeil.
 */
export function Squelette({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-lg bg-[length:200%_100%] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--trait) 25%, var(--vert-soft) 50%, var(--trait) 75%)',
      }}
      aria-hidden="true"
    />
  );
}
