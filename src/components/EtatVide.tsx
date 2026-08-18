import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  intitule: string;
  titre: string;
  enfants: ReactNode;
  lien: { to: string; texte: string };
}

/** Motif "rien a montrer encore", partage par l'historique vide et la carte
    a venir : une intention declaree plutot qu'un espace muet. */
export function EtatVide({ intitule, titre, enfants, lien }: Props) {
  return (
    <div className="flex flex-col gap-e3 py-e6">
      <p className="intitule">{intitule}</p>
      <h2 className="m-0 text-xl">{titre}</h2>
      {enfants}
      <Link
        className="bouton-principal mt-e3 grid place-items-center no-underline"
        to={lien.to}
      >
        {lien.texte}
      </Link>
    </div>
  );
}
