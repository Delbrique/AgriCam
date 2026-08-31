/**
 * Synthese du tableau de bord.
 *
 * Contrairement au conseil de la fiche de resultat (ConduiteATenir.tsx, qui
 * porte sur UN seul diagnostic), cette section analyse l'ENSEMBLE des
 * chiffres du tableau de bord sur la periode choisie : KPI, repartition des
 * maladies et des cultures, maladies critiques. Affiche INSTANTANEMENT un
 * resume local (chiffres deja calcules, voir lib/tableauDeBord.ts), puis -
 * si le reseau est la - demande a l'IA (api/synthese.ts) une analyse qui
 * degage une priorite parmi tout ce qui a ete diagnostique, plutot qu'une
 * carte repetee par maladie.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  resumeLocalSituation,
  type KpiTableauDeBord,
  type PartMaladie,
  type RecommandationAgregee,
  type StatCulture,
} from '../lib/tableauDeBord';
import { useTraduction } from '../lib/traduction';

interface Props {
  periodeLibelle: string;
  kpis: KpiTableauDeBord;
  maladiesCritiques: RecommandationAgregee[];
  repartitionMaladies: PartMaladie[];
  repartitionCultures: StatCulture[];
}

type Etat = 'inactif' | 'chargement' | 'pret' | 'erreur';

export function SyntheseTableauDeBord({
  periodeLibelle,
  kpis,
  maladiesCritiques,
  repartitionMaladies,
  repartitionCultures,
}: Props) {
  const { t, langue } = useTraduction();
  const [etat, setEtat] = useState<Etat>('inactif');
  const [syntheseIA, setSyntheseIA] = useState('');

  useEffect(() => {
    let annule = false;
    if (!navigator.onLine || kpis.nbDiagnostics === 0) return;

    setEtat('chargement');
    fetch('/api/synthese', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periode: periodeLibelle,
        nbDiagnostics: kpis.nbDiagnostics,
        tauxSain: kpis.tauxSain,
        nbAlertesCritiques: kpis.nbAlertesCritiques,
        confianceMoyenne: kpis.confianceMoyenne,
        maladiePredominante: kpis.maladiePredominante?.classe.nom ?? null,
        maladiesCritiques: maladiesCritiques.map((m) => ({
          nom: m.classe.nom,
          occurrences: m.occurrences,
        })),
        repartitionMaladies: repartitionMaladies.slice(0, 6).map((m) => ({
          nom: m.classe.nom,
          nombre: m.nombre,
          part: m.part,
        })),
        repartitionCultures: repartitionCultures.map((c) => ({
          nom: c.culture,
          nombre: c.nombre,
          nombreAtteints: c.nombreAtteints,
        })),
      }),
    })
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error();
        const data = await reponse.json();
        if (!annule && data.synthese) {
          setSyntheseIA(data.synthese as string);
          setEtat('pret');
        } else if (!annule) {
          setEtat('erreur');
        }
      })
      .catch(() => {
        if (!annule) setEtat('erreur');
      });

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    periodeLibelle,
    kpis.nbDiagnostics,
    kpis.nbAlertesCritiques,
    kpis.tauxSain,
    kpis.maladiePredominante?.classe.id,
  ]);

  if (kpis.nbDiagnostics === 0) {
    return <p className="m-0 text-sm text-encre-douce">{t.syntheseTableauDeBord.aucunDiagnostic}</p>;
  }

  const pret = etat === 'pret' && syntheseIA.length > 0;

  return (
    <div className="flex flex-col gap-e2">
      {pret ? (
        <RapportSynthese texte={syntheseIA} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-e1 p-0 text-sm leading-[1.5] text-encre">
          {resumeLocalSituation(kpis, t, langue).map((ligne, i) => (
            <li key={i}>{ligne}</li>
          ))}
        </ul>
      )}
      {etat === 'chargement' && (
        <p className="m-0 text-xs text-encre-douce">{t.syntheseTableauDeBord.analyseEnCours}</p>
      )}
    </div>
  );
}

/** Meme grammaire de mise en forme que les autres conseils generes (voir
 * ConduiteATenir.tsx) : une ligne tout en majuscules devient un titre, une
 * ligne commencant par « - » rejoint une liste. */
function RapportSynthese({ texte }: { texte: string }) {
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
        <ul key={`ul-${cle}`} className="m-0 flex flex-col gap-e1 pl-[1.1rem]">
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
          className="m-0 mt-e2 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-encre-douce first:mt-0"
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
