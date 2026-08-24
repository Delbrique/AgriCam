/**
 * Recommandations agregees - une carte par maladie critique, regroupee
 * plutot qu'une carte par fruit (voir lib/tableauDeBord.ts :
 * recommandationsCritiques).
 *
 * Chaque carte affiche INSTANTANEMENT la conduite en dur (data/conduites.ts,
 * disponible hors ligne), puis - si le reseau est la - demande a l'IA un
 * conseil qui tient compte de la VRAIE situation de cet appareil : combien
 * de fois cette maladie est apparue, sur quelle periode. Le texte change
 * donc reellement d'un diagnostic a l'autre (un premier cas isole et une
 * serie de 5 cas cette semaine ne produisent pas le meme conseil), plutot
 * que de repeter la meme description figee de la maladie. Meme principe que
 * ConduiteATenir.tsx sur la fiche de resultat.
 */

import { useEffect, useState, type ReactNode } from 'react';
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
      {recommandations.map((r) => (
        <CarteRecommandation key={r.classe.id} recommandation={r} />
      ))}
    </ul>
  );
}

type EtatIA = 'inactif' | 'chargement' | 'pret' | 'erreur';

function CarteRecommandation({ recommandation: r }: { recommandation: RecommandationAgregee }) {
  const [etatIA, setEtatIA] = useState<EtatIA>('inactif');
  const [conseilIA, setConseilIA] = useState('');

  useEffect(() => {
    let annule = false;
    if (!navigator.onLine) return;

    setEtatIA('chargement');
    fetch('/api/conseil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maladie: r.classe.nom,
        culture: r.classe.culture,
        agent: r.classe.agent ?? null,
        gravite: r.classe.gravite,
        occurrences: r.occurrences,
        premiereVue: dater(r.premiereFois),
        derniereVue: dater(r.derniereFois),
      }),
    })
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error();
        const data = await reponse.json();
        if (!annule && data.conseil) {
          setConseilIA(data.conseil as string);
          setEtatIA('pret');
        } else if (!annule) {
          setEtatIA('erreur');
        }
      })
      .catch(() => {
        if (!annule) setEtatIA('erreur');
      });

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.classe.id, r.occurrences, r.derniereFois]);

  const memeJour = dater(r.premiereFois) === dater(r.derniereFois);
  const conseilPret = etatIA === 'pret' && conseilIA.length > 0;

  return (
    <li className="rounded border-l-4 border-atteint bg-atteint-fond p-e3">
      <div className="flex flex-wrap items-center justify-between gap-e2">
        <p className="m-0 font-semibold text-encre">{r.classe.nom}</p>
        <span className="donnee whitespace-nowrap rounded-full bg-atteint px-e2 py-0.5 text-xs font-bold text-white">
          {r.occurrences} cas
        </span>
      </div>

      {conseilPret ? (
        <RapportFormate texte={conseilIA} />
      ) : (
        r.conduite && (
          <>
            <p className="m-0 mt-e1 text-sm leading-[1.5] text-encre">{r.conduite.resume}</p>
            <p className="m-0 mt-e2 text-xs font-semibold uppercase tracking-[0.06em] text-atteint">
              {LIBELLE_URGENCE[r.conduite.urgence]}
            </p>
          </>
        )
      )}

      {etatIA === 'chargement' && (
        <p className="m-0 mt-e2 text-xs text-encre-douce">Conseil personnalisé en cours…</p>
      )}

      <p className="donnee m-0 mt-e2 text-xs text-encre-douce">
        {memeJour
          ? `Vu le ${dater(r.derniereFois)}`
          : `Du ${dater(r.premiereFois)} au ${dater(r.derniereFois)}`}
      </p>
      {!conseilPret && (
        <p className="m-0 mt-e1 text-xs italic text-encre-douce">
          Rappel de suivi : reprenez une photo du même plant dans 7 jours pour vérifier
          l&apos;évolution.
        </p>
      )}
    </li>
  );
}

/** Meme mise en forme que ConseilDetaille avant fusion (voir
 * ConduiteATenir.tsx) : une ligne tout en majuscules devient un titre, une
 * ligne commencant par « - » rejoint une liste, le reste est un paragraphe. */
function RapportFormate({ texte }: { texte: string }) {
  const lignes = texte
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const blocs: ReactNode[] = [];
  let puces: string[] = [];

  const viderPuces = (cle: string) => {
    if (puces.length) {
      const items = puces.slice();
      blocs.push(
        <ul key={`ul-${cle}`} className="m-0 mt-e2 flex flex-col gap-e1 pl-[1.1rem]">
          {items.map((p, i) => (
            <li key={i} className="text-sm leading-[1.5] text-encre">
              {p}
            </li>
          ))}
        </ul>,
      );
      puces = [];
    }
  };

  lignes.forEach((ligne, i) => {
    const estTitre =
      ligne.length > 5 &&
      ligne === ligne.toUpperCase() &&
      /[A-ZÀ-Ü]/.test(ligne) &&
      !ligne.startsWith('-');

    if (estTitre) {
      viderPuces(String(i));
      blocs.push(
        <p
          key={`h-${i}`}
          className="m-0 mt-e2 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-atteint first:mt-e1"
        >
          {ligne}
        </p>,
      );
    } else if (ligne.startsWith('-')) {
      puces.push(ligne.replace(/^-\s*/, ''));
    } else {
      viderPuces(String(i));
      blocs.push(
        <p key={`p-${i}`} className="m-0 mt-e1 text-sm leading-[1.5] text-encre">
          {ligne}
        </p>,
      );
    }
  });
  viderPuces('fin');

  return <div className="flex flex-col">{blocs}</div>;
}
