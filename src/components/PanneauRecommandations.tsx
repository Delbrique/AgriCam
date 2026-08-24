/**
 * Recommandations agregees - reprend la conduite a tenir DEJA definie
 * localement (data/conduites.ts) pour les maladies critiques, regroupees
 * plutot qu'une carte par fruit (voir lib/tableauDeBord.ts :
 * recommandationsCritiques). Jamais un nouvel appel reseau : le tableau de
 * bord reste 100 % utilisable hors ligne.
 *
 * Le compteur d'occurrences et la fenetre premiere/derniere fois sont ce
 * qui rend cette section vivante d'un diagnostic a l'autre : le texte de
 * conduite reste le meme (il decrit la maladie, pas l'instant), mais ce qui
 * l'entoure grandit reellement a mesure que l'historique s'enrichit.
 */

import { LIBELLE_URGENCE } from '../data/conduites';
import type { RecommandationAgregee } from '../lib/tableauDeBord';

interface Props {
  recommandations: RecommandationAgregee[];
}

function dater(horodatage: number): string {
  return new Date(horodatage).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
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
      {recommandations.map((r) => {
        const memeJour = dater(r.premiereFois) === dater(r.derniereFois);
        return (
          <li
            key={r.classe.id}
            className="rounded border-l-4 border-atteint bg-atteint-fond p-e3"
          >
            <div className="flex flex-wrap items-center justify-between gap-e2">
              <p className="m-0 font-semibold text-encre">{r.classe.nom}</p>
              <span className="donnee whitespace-nowrap rounded-full bg-atteint px-e2 py-0.5 text-xs font-bold text-white">
                {r.occurrences} cas
              </span>
            </div>

            {r.conduite && (
              <>
                <p className="m-0 mt-e1 text-sm leading-[1.5] text-encre">{r.conduite.resume}</p>
                <p className="m-0 mt-e2 text-xs font-semibold uppercase tracking-[0.06em] text-atteint">
                  {LIBELLE_URGENCE[r.conduite.urgence]}
                </p>
              </>
            )}

            <p className="donnee m-0 mt-e2 text-xs text-encre-douce">
              {memeJour ? `Vu le ${dater(r.derniereFois)}` : `Du ${dater(r.premiereFois)} au ${dater(r.derniereFois)}`}
            </p>
            <p className="m-0 mt-e1 text-xs italic text-encre-douce">
              Rappel de suivi : reprenez une photo du même plant dans 7 jours pour vérifier
              l&apos;évolution.
            </p>
          </li>
        );
      })}
    </ul>
  );
}
