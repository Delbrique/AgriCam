/**
 * Maladies les plus frequentes, sur l'historique local du producteur.
 *
 * A cote de la case photo : de vraies donnees, jamais une valeur inventee -
 * contrairement a un capteur meteo que l'app n'a pas. Chaque barre reprend la
 * grammaire visuelle de BandeSeverite (nom + valeur + barre coloree par
 * gravite) : la meme lecture que sur la fiche de resultat, pour que le
 * classement se comprenne sans explication.
 */

import { useEffect, useState } from 'react';
import { historique } from '../lib/stockage';
import { CLASSES, couleurGravite } from '../lib/classes';

const MAX_RANGS = 3;

interface Rang {
  nom: string;
  compte: number;
  couleur: string;
}

export function Tendance() {
  const [rangs, setRangs] = useState<Rang[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    historique().then((consultations) => {
      const comptes = new Map<string, number>();
      let n = 0;
      for (const c of consultations) {
        for (const f of c.fruits) {
          if (f.incertain || f.horsSujet || f.classe.gravite === 'sain') continue;
          comptes.set(f.classe.id, (comptes.get(f.classe.id) ?? 0) + 1);
          n += 1;
        }
      }

      const classement = Array.from(comptes.entries())
        .map(([id, compte]) => {
          const classe = CLASSES.find((c) => c.id === id);
          return classe ? { nom: classe.nom, compte, couleur: couleurGravite(classe.gravite) } : null;
        })
        .filter((r): r is Rang => r !== null)
        .sort((a, b) => b.compte - a.compte)
        .slice(0, MAX_RANGS);

      setRangs(classement);
      setTotal(n);
    });
  }, []);

  if (rangs === null) {
    return <div aria-hidden="true" className="aspect-[4/5] max-h-[320px] w-full" />;
  }

  if (rangs.length === 0) {
    return (
      <section className="flex aspect-[4/5] max-h-[320px] w-full flex-col items-center justify-center gap-e1 rounded-lg border border-trait bg-carte px-e3 text-center">
        <p className="intitule">Maladies fréquentes</p>
        <p className="m-0 text-xs text-encre-douce">
          Apparaîtra après vos premiers diagnostics.
        </p>
      </section>
    );
  }

  const max = rangs[0].compte;

  return (
    <section className="flex aspect-[4/5] max-h-[320px] w-full flex-col gap-e2 rounded-lg border border-trait bg-carte p-e3">
      <div>
        <p className="intitule">Maladies fréquentes</p>
        <p className="m-0 text-[0.625rem] text-encre-douce">sur {total} cas atteints</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-e2">
        {rangs.map((r) => (
          <div key={r.nom} className="flex flex-col gap-0.5">
            <span className="flex items-baseline justify-between gap-e2 text-xs">
              <span className="min-w-0 flex-1 truncate text-encre">{r.nom}</span>
              <span className="donnee shrink-0 text-encre-douce">{r.compte}</span>
            </span>
            <div className="h-[6px] w-full overflow-hidden rounded-sm bg-trait">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${(r.compte / max) * 100}%`, background: r.couleur }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
