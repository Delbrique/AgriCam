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

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { conduitePour, LIBELLE_URGENCE, type Urgence } from '../data/conduites';

const COULEUR_URGENCE: Record<Urgence, string> = {
  aucune: 'var(--sain)',
  surveiller: 'var(--alerte)',
  sous_48h: 'var(--atteint)',
  immediat: 'var(--grave)',
};

interface Props {
  classeId: string;
  /** Nom lisible de la maladie, pour l'ouverture de la lecture audio - le
   * reste du composant se contente de l'identifiant technique. */
  nomMaladie: string;
}

/** Le lecteur audio embarque du navigateur : fonctionne hors ligne, sans
 * dependance externe. Utile debout, au champ, une main occupee par le
 * fruit - ou pour un producteur qui lit peu ou mal le francais ecrit. */
const LECTURE_DISPONIBLE = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function ConduiteATenir({ classeId, nomMaladie }: Props) {
  const [replieOuvert, setReplieOuvert] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  const conduite = conduitePour(classeId);

  // Coupe toute lecture en cours des que le diagnostic affiche change (autre
  // fruit selectionne, nouvelle photo) ou que le composant disparait - une
  // voix qui continue a parler d'un diagnostic qui n'est plus a l'ecran
  // serait plus genant qu'utile.
  useEffect(() => {
    return () => {
      if (LECTURE_DISPONIBLE) window.speechSynthesis.cancel();
    };
  }, [classeId]);

  if (!conduite) return null;

  const { urgence, resume, gestes, eviter, prevention } = conduite;

  function basculerLecture() {
    if (!LECTURE_DISPONIBLE) return;
    if (enLecture) {
      window.speechSynthesis.cancel();
      setEnLecture(false);
      return;
    }

    const texte = [
      `${nomMaladie}.`,
      `${LIBELLE_URGENCE[urgence]}.`,
      resume,
      ...gestes,
      eviter ? `À ne pas faire : ${eviter}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = 'fr-FR';
    enonce.onend = () => setEnLecture(false);
    enonce.onerror = () => setEnLecture(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(enonce);
    setEnLecture(true);
  }

  return (
    <section className="carte flex flex-col gap-e3 bp860:self-start">
      <div className="flex items-center justify-between gap-e3">
        <p className="intitule">Que faire</p>
        <div className="flex items-center gap-e2">
          {LECTURE_DISPONIBLE && (
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-trait"
              onClick={basculerLecture}
              aria-pressed={enLecture}
              aria-label={enLecture ? 'Arrêter la lecture' : 'Écouter les consignes'}
            >
              {enLecture ? (
                <VolumeX size={16} aria-hidden="true" />
              ) : (
                <Volume2 size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <span
            className="whitespace-nowrap rounded-sm px-e3 py-e1 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-white"
            style={{ background: COULEUR_URGENCE[urgence] }}
          >
            {LIBELLE_URGENCE[urgence]}
          </span>
        </div>
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
