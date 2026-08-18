/**
 * Conduite a tenir - le bloc « Que faire » du diagnostic.
 *
 * La conduite en dur (resume + gestes numerotes + « a ne pas faire » +
 * prevention) : c'est le filet de securite au champ, toujours affiche, avec
 * ou sans reseau. Le rapport detaille genere en ligne (Groq) vit desormais a
 * part, dans la section Recommandations de FicheResultat - son contenu est
 * toujours long, et le melanger a cette case l'aurait fait deborder.
 *
 * Le badge d'urgence vient toujours des donnees locales.
 */

import { useState } from 'react';
import { conduitePour, LIBELLE_URGENCE, type Urgence } from '../data/conduites';

const COULEUR_URGENCE: Record<Urgence, string> = {
  aucune: 'var(--sain)',
  surveiller: 'var(--alerte)',
  sous_48h: 'var(--atteint)',
  immediat: 'var(--grave)',
};

interface Props {
  classeId: string;
}

export function ConduiteATenir({ classeId }: Props) {
  const [replieOuvert, setReplieOuvert] = useState(false);
  const conduite = conduitePour(classeId);

  if (!conduite) return null;

  const { urgence, resume, gestes, eviter, prevention } = conduite;

  return (
    <section className="carte flex flex-col gap-e3 bp860:self-start">
      <div className="flex items-center justify-between gap-e3">
        <p className="intitule">Que faire</p>
        <span
          className="whitespace-nowrap rounded-sm px-e3 py-e1 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-white"
          style={{ background: COULEUR_URGENCE[urgence] }}
        >
          {LIBELLE_URGENCE[urgence]}
        </span>
      </div>

      <p className="m-0 text-md leading-[1.45]">{resume}</p>

      <ol className="m-0 flex flex-col gap-e3 pl-[1.4rem] text-md leading-[1.45] marker:font-donnee marker:font-bold marker:text-encre-douce">
        {gestes.map((geste) => (
          <li key={geste}>{geste}</li>
        ))}
      </ol>

      {eviter && (
        <p className="m-0 rounded border-l-4 border-atteint bg-atteint-fond p-e3 text-sm leading-[1.45]">
          <strong>À ne pas faire.</strong> {eviter}
        </p>
      )}

      {prevention && (
        <>
          <button
            className="min-h-[40px] self-start border-0 bg-transparent p-0 text-sm font-semibold text-encre underline underline-offset-[3px]"
            onClick={() => setReplieOuvert((v) => !v)}
            aria-expanded={replieOuvert}
          >
            {replieOuvert ? 'Masquer' : 'Éviter que cela revienne'}
          </button>
          {replieOuvert && (
            <p className="m-0 text-sm leading-[1.45] text-encre-douce">{prevention}</p>
          )}
        </>
      )}
    </section>
  );
}
