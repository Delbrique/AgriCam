/**
 * Fiche de resultat.
 *
 * Disposition sur grand ecran, grille 2x2 (dimensions fixes, aucune des
 * quatre cases ne s'etire au contenu de sa voisine) :
 *   Fruits reperes  |  Diagnostic
 *   Que faire       |  Zones analysees
 * suivie d'une section pleine largeur, Recommandations, qui porte le conseil
 * detaille genere via Groq (en ligne) et le bouton de telechargement PDF.
 * Cette section est volontairement HORS de la grille : son contenu est
 * toujours long, et l'y inclure forcerait sa voisine de rangee (Zones
 * analysees) a s'etirer d'autant.
 * Sur telephone, tout repasse en une seule colonne.
 */

import { useState } from 'react';
import { CLASSES, agentClasse, couleurGravite, nomClasse } from '../lib/classes';
import type { DiagnosticFruit, Diagnostic } from '../lib/pipeline';
import { useTraduction } from '../lib/traduction';
import { BandeSeverite, PastilleGravite } from './BandeSeverite';
import { ConduiteATenir } from './ConduiteATenir';
import { DiagnosticsSimilaires } from './DiagnosticsSimilaires';
import { PhotoAnnotee } from './PhotoAnnotee';

interface Props {
  /** En pratique toujours une Consultation deja enregistree (voir
   * pages/Diagnostic.tsx) : `id` est optionnel dans le type pour ne pas
   * coupler ce composant a stockage.ts, mais sert a exclure le diagnostic
   * de ses propres resultats "similaires". */
  diagnostic: Diagnostic & { id?: string };
  onRecommencer: () => void;
  onCorriger?: (indexFruit: number, classeId: string) => void;
}

export function FicheResultat({ diagnostic, onRecommencer }: Props) {
  const { t, langue } = useTraduction();
  const LIBELLE_GRAVITE = {
    sain: t.ficheResultat.rienASignaler,
    alerte: t.ficheResultat.aSurveiller,
    atteint: t.ficheResultat.atteinteConfirmee,
    grave: t.ficheResultat.atteinteGrave,
  } as const;
  const [selection, setSelection] = useState(0);
  const [chaleurVisible, setChaleurVisible] = useState(true);

  const fruit = diagnostic.fruits[selection];
  const multiple = diagnostic.fruits.length > 1;
  const tousHorsSujet = diagnostic.fruits.every((f) => f.horsSujet);

  return (
    <div className="flex flex-col gap-e5">
      {/* --- Verdict : bandeau global, pleine largeur -------------------- */}
      <section
        className="rounded-lg border border-trait border-l-[6px] bg-carte p-e5 shadow-carte"
        style={{ borderLeftColor: couleurGravite(diagnostic.graviteGlobale) }}
      >
        <p className="intitule">{t.ficheResultat.verdict}</p>
        <h1 className="mb-e2 mt-e1 text-2xl">
          {tousHorsSujet ? t.ficheResultat.photoNonReconnue : LIBELLE_GRAVITE[diagnostic.graviteGlobale]}
        </h1>

        {!tousHorsSujet && (multiple ? (
          <p className="m-0 text-sm text-encre-douce">
            {t.ficheResultat.fruitsAtteints(
              diagnostic.nbAtteints,
              diagnostic.fruits.length,
              Math.round(diagnostic.tauxInfestation * 100),
            )}
          </p>
        ) : !diagnostic.sansDetection ? (
          <p className="m-0 text-sm text-encre-douce">{t.ficheResultat.unSeulFruit}</p>
        ) : null)}

        {diagnostic.sansDetection && (
          <p className="avis avis--attention">{t.ficheResultat.sansDetection}</p>
        )}

        {tousHorsSujet && <p className="avis avis--erreur">{t.ficheResultat.horsSujetAvis}</p>}
      </section>

      {/* --- Grille 2x2 :
             Fruits reperes | Diagnostic
             Que faire      | Zones analysees ------------------------------ */}
      <div className="grid grid-cols-1 gap-e5 bp860:grid-cols-2">
        {/* Photo annotee : fruits reperes (haut gauche) */}
        <section className="carte flex flex-col gap-e3">
          <p className="intitule">{t.ficheResultat.fruitsRepere}</p>
          <PhotoAnnotee
            photo={diagnostic.photo}
            fruits={diagnostic.fruits}
            selection={selection}
            onSelection={setSelection}
          />
          {multiple && <p>{t.ficheResultat.toucherFruit}</p>}
        </section>

        {/* Diagnostic du fruit selectionne (haut droite) */}
        <section className="carte flex flex-col gap-e3">
          <p className="intitule">{t.ficheResultat.diagnosticTitre}</p>

          {fruit.horsSujet ? (
            <HorsSujetExplique />
          ) : fruit.incertain ? (
            <IncertitudeExpliquee fruit={fruit} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-e3">
                <PastilleGravite
                  gravite={fruit.classe.gravite}
                  libelle={nomClasse(fruit.classe, langue)}
                />
                <span className="donnee text-xl font-bold">
                  {Math.min(99, Math.round(fruit.confiance * 100))}&nbsp;%
                </span>
              </div>
              {fruit.classe.agent && (
                <p>{t.ficheResultat.agentEnCause(agentClasse(fruit.classe, langue) ?? fruit.classe.agent)}</p>
              )}
            </>
          )}

          {!fruit.horsSujet && (
            <BandeSeverite
              probabilites={fruit.probabilites}
              indiceRetenu={CLASSES.findIndex((c) => c.id === fruit.classe.id)}
              incertain={fruit.incertain}
            />
          )}
        </section>

        {/* Que faire (bas gauche). Absente si le fruit est incertain ou hors
            sujet : on ne conseille pas sur une hypothese non tranchee, ni sur
            une image qui n'est meme pas une culture reconnue. Affiche la
            conduite en dur instantanement, puis se remplace elle-meme par le
            conseil IA (Groq) des qu'il arrive, si le reseau est la - voir
            ConduiteATenir.tsx. */}
        {!fruit.incertain && !fruit.horsSujet && (
          <ConduiteATenir
            classe={fruit.classe}
            confiance={fruit.confiance}
            horodatage={diagnostic.horodatage}
            vignetteChaleur={fruit.vignetteChaleur}
          />
        )}

        {/* Carte d'activation : zones analysees (bas droite). Absente si le
            fruit est hors sujet : la carte de chaleur d'un classifieur qui
            n'a rien reconnu n'a aucun sens a montrer. Meme logique de taille
            fixe que les autres cases : self-start pour ne pas suivre la
            hauteur de la case voisine. */}
        {!fruit.horsSujet && (
          <section className="carte flex flex-col gap-e3 bp860:self-start">
            <div className="flex items-center justify-between gap-e3">
              <p className="intitule">{t.ficheResultat.zonesAnalysees}</p>
              <button
                className="min-h-[40px] border border-trait bg-transparent px-e3 text-sm font-semibold text-encre aria-pressed:border-encre aria-pressed:bg-encre aria-pressed:text-papier"
                onClick={() => setChaleurVisible((v) => !v)}
                aria-pressed={chaleurVisible}
              >
                {chaleurVisible ? t.ficheResultat.masquer : t.ficheResultat.afficher}
              </button>
            </div>

            <img
              className="mx-auto block max-h-[300px] w-auto max-w-full rounded-lg bg-encre object-contain"
              src={chaleurVisible ? fruit.vignetteChaleur : fruit.vignette}
              alt={chaleurVisible ? t.ficheResultat.altZonesChaudes : t.ficheResultat.altFruitAnalyse}
            />

            {chaleurVisible && <p>{t.ficheResultat.zonesChaudesTexte}</p>}
          </section>
        )}
      </div>

      {!fruit.incertain && !fruit.horsSujet && (
        <DiagnosticsSimilaires embedding={fruit.embedding} idAExclure={diagnostic.id} />
      )}

      <button className="bouton-principal" onClick={onRecommencer}>
        {t.ficheResultat.analyserAutreFruit}
      </button>
    </div>
  );
}

/**
 * Quand l'image ne ressemble a aucune des 9 classes connues (voir
 * classifieur.ts) : contrairement a l'incertitude, ce n'est pas une hesitation
 * entre maladies, c'est une image hors du domaine de l'application.
 */
function HorsSujetExplique() {
  const { t } = useTraduction();
  return (
    <div className="avis avis--erreur">
      <strong>{t.ficheResultat.horsSujetTitre}</strong> {t.ficheResultat.horsSujetTexte}
    </div>
  );
}

/**
 * Quand la confiance passe sous le seuil, on refuse de trancher.
 */
function IncertitudeExpliquee({ fruit }: { fruit: DiagnosticFruit }) {
  const { t } = useTraduction();
  return (
    <div className="avis avis--incertain">
      <strong>{t.ficheResultat.incertainTitre}</strong>{' '}
      {t.ficheResultat.incertainTexte(Math.round(fruit.confiance * 100))}
    </div>
  );
}