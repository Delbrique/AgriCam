/**
 * Diagnostics similaires - "a-t-on deja vu ce cas ?"
 *
 * Rapproche le fruit affiche des cas visuellement proches deja rencontres
 * dans l'historique de ce telephone (voir lib/similarite.ts). Purement
 * informatif : n'influence jamais le diagnostic pose sur cette photo, mais
 * aide a en juger la coherence - utile en particulier quand un cas
 * similaire avait ete corrige par le producteur.
 */

import { useEffect, useState } from 'react';
import { couleurGravite, nomClasse } from '../lib/classes';
import { diagnosticsSimilaires, type ResultatSimilarite } from '../lib/similarite';
import type { Consultation } from '../lib/stockage';
import { useTraduction } from '../lib/traduction';

interface Props {
  embedding: ArrayLike<number>;
  /** Le diagnostic affiche est deja dans l'historique au moment ou ce
   * composant se monte (voir pages/Diagnostic.tsx) : sans cet identifiant,
   * il se retrouverait dans ses propres resultats, similaire a 100 % avec
   * lui-meme. */
  idAExclure?: string;
}

export function DiagnosticsSimilaires({ embedding, idAExclure }: Props) {
  const { t, langue } = useTraduction();
  const [resultats, setResultats] = useState<ResultatSimilarite<Consultation>[] | null>(null);

  useEffect(() => {
    let annule = false;
    diagnosticsSimilaires(embedding, idAExclure).then((r) => {
      if (!annule) setResultats(r);
    });
    return () => {
      annule = true;
    };
  }, [embedding, idAExclure]);

  if (!resultats || resultats.length === 0) return null;

  return (
    <section className="carte flex flex-col gap-e3">
      <p className="intitule">{t.diagnosticsSimilaires.titre}</p>
      <p className="m-0 text-sm text-encre-douce">{t.diagnosticsSimilaires.intro}</p>

      <ul className="m-0 flex list-none flex-col gap-e2 p-0">
        {resultats.map(({ candidat, similarite }) => {
          const principal = candidat.fruits.find((f) => !f.horsSujet) ?? candidat.fruits[0];
          return (
            <li
              key={candidat.id}
              className="flex items-center gap-e3 rounded-xl border border-trait p-e2"
            >
              <img
                className="h-12 w-12 shrink-0 rounded bg-encre object-cover"
                src={principal.vignette}
                alt=""
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className="truncate text-sm font-semibold"
                  style={{ color: couleurGravite(candidat.graviteGlobale) }}
                >
                  {nomClasse(principal.classe, langue)}
                </span>
                <span className="text-xs text-encre-douce">
                  {dater(candidat.horodatage, langue)} ·{' '}
                  {t.diagnosticsSimilaires.ressemblance(Math.round(similarite * 100))}
                  {candidat.correction && ` · ${t.diagnosticsSimilaires.corrige}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function dater(horodatage: number, langue: 'fr' | 'en'): string {
  return new Date(horodatage).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
