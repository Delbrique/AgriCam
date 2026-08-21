/**
 * Recommandations agregees - reprend la conduite a tenir DEJA definie
 * localement (data/conduites.ts) pour les cas critiques les plus recents.
 * Jamais un nouvel appel reseau : le tableau de bord reste 100 % utilisable
 * hors ligne (voir lib/tableauDeBord.ts : recommandationsCritiques).
 */

import { LIBELLE_URGENCE } from '../data/conduites';
import type { RecommandationAgregee } from '../lib/tableauDeBord';

interface Props {
  recommandations: RecommandationAgregee[];
}

export function PanneauRecommandations({ recommandations }: Props) {
  if (recommandations.length === 0) {
    return (
      <p className="m-0 text-sm text-encre-douce">
        Aucun cas critique sur cette période — rien à signaler.
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-e3 p-0">
      {recommandations.map((r) => (
        <li
          key={`${r.consultationId}-${r.classe.id}`}
          className="rounded border-l-4 border-atteint bg-atteint-fond p-e3"
        >
          <p className="m-0 flex items-center justify-between gap-e2 font-semibold text-encre">
            {r.classe.nom}
            <span className="donnee text-xs text-encre-douce">
              {new Date(r.horodatage).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          </p>
          {r.conduite && (
            <>
              <p className="m-0 mt-e1 text-sm leading-[1.5] text-encre">{r.conduite.resume}</p>
              <p className="m-0 mt-e2 text-xs font-semibold uppercase tracking-[0.06em] text-atteint">
                {LIBELLE_URGENCE[r.conduite.urgence]}
              </p>
            </>
          )}
          <p className="m-0 mt-e2 text-xs italic text-encre-douce">
            Rappel de suivi : reprenez une photo du même plant dans 7 jours pour vérifier
            l&apos;évolution.
          </p>
        </li>
      ))}
    </ul>
  );
}
