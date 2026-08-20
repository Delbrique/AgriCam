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
import { CLASSES, couleurGravite } from '../lib/classes';
import type { DiagnosticFruit, Diagnostic } from '../lib/pipeline';
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

const LIBELLE_GRAVITE = {
  sain: 'Rien à signaler',
  alerte: 'À surveiller',
  atteint: 'Atteinte confirmée',
  grave: 'Atteinte grave',
} as const;

export function FicheResultat({ diagnostic, onRecommencer }: Props) {
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
        <p className="intitule">Verdict</p>
        <h1 className="mb-e2 mt-e1 text-2xl">
          {tousHorsSujet ? 'Photo non reconnue' : LIBELLE_GRAVITE[diagnostic.graviteGlobale]}
        </h1>

        {!tousHorsSujet && (multiple ? (
          <p className="m-0 text-sm text-encre-douce">
            <span className="donnee text-lg text-encre">
              {diagnostic.nbAtteints}
            </span>{' '}
            fruit{diagnostic.nbAtteints > 1 ? 's' : ''} atteint
            {diagnostic.nbAtteints > 1 ? 's' : ''} sur{' '}
            <span className="donnee">{diagnostic.fruits.length}</span> repérés,
            soit un taux d&apos;infestation de{' '}
            <span className="donnee">
              {Math.round(diagnostic.tauxInfestation * 100)}&nbsp;%
            </span>
            .
          </p>
        ) : (
          <p className="m-0 text-sm text-encre-douce">
            Un seul fruit analysé sur cette photo.
          </p>
        ))}

        {diagnostic.sansDetection && (
          <p className="avis avis--attention">
            Aucun fruit n&apos;a pu être repéré : la photo entière a été
            analysée. Le résultat est moins fiable. Rapprochez-vous du fruit et
            reprenez la photo.
          </p>
        )}

        {tousHorsSujet && (
          <p className="avis avis--erreur">
            Cette photo ne ressemble à aucune des cultures reconnues (tomate,
            piment, oignon). Reprenez une photo cadrée sur le fruit ou le
            bulbe à diagnostiquer.
          </p>
        )}
      </section>

      {/* --- Grille 2x2 :
             Fruits reperes | Diagnostic
             Que faire      | Zones analysees ------------------------------ */}
      <div className="grid grid-cols-1 gap-e5 bp860:grid-cols-2">
        {/* Photo annotee : fruits reperes (haut gauche) */}
        <section className="carte flex flex-col gap-e3">
          <p className="intitule">Fruits repérés</p>
          <PhotoAnnotee
            photo={diagnostic.photo}
            fruits={diagnostic.fruits}
            selection={selection}
            onSelection={setSelection}
          />
          {multiple && (
            <p>Touchez un fruit pour voir son diagnostic.</p>
          )}
        </section>

        {/* Diagnostic du fruit selectionne (haut droite) */}
        <section className="carte flex flex-col gap-e3">
          <p className="intitule">Diagnostic</p>

          {fruit.horsSujet ? (
            <HorsSujetExplique />
          ) : fruit.incertain ? (
            <IncertitudeExpliquee fruit={fruit} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-e3">
                <PastilleGravite
                  gravite={fruit.classe.gravite}
                  libelle={fruit.classe.nom}
                />
                <span className="donnee text-xl font-bold">
                  {Math.min(99, Math.round(fruit.confiance * 100))}&nbsp;%
                </span>
              </div>
              {fruit.classe.agent && (
                <p>Agent en cause : {fruit.classe.agent}</p>
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
              <p className="intitule">Zones analysées</p>
              <button
                className="min-h-[40px] border border-trait bg-transparent px-e3 text-sm font-semibold text-encre aria-pressed:border-encre aria-pressed:bg-encre aria-pressed:text-papier"
                onClick={() => setChaleurVisible((v) => !v)}
                aria-pressed={chaleurVisible}
              >
                {chaleurVisible ? 'Masquer' : 'Afficher'}
              </button>
            </div>

            <img
              className="mx-auto block max-h-[300px] w-auto max-w-full rounded-lg bg-encre object-contain"
              src={chaleurVisible ? fruit.vignetteChaleur : fruit.vignette}
              alt={
                chaleurVisible
                  ? 'Zones de l’image ayant motivé le diagnostic'
                  : 'Fruit analysé'
              }
            />

            {chaleurVisible && (
              <p>
                Les zones chaudes sont celles sur lesquelles le modèle s&apos;est
                appuyé. Si elles ne couvrent pas la lésion, le diagnostic est à
                prendre avec prudence.
              </p>
            )}
          </section>
        )}
      </div>

      {!fruit.incertain && !fruit.horsSujet && (
        <DiagnosticsSimilaires embedding={fruit.embedding} idAExclure={diagnostic.id} />
      )}

      <button className="bouton-principal" onClick={onRecommencer}>
        Analyser un autre fruit
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
  return (
    <div className="avis avis--erreur">
      <strong>Photo hors sujet.</strong> Cette image ne ressemble à aucune des
      cultures reconnues par AgriCam (tomate, piment, oignon). Le modèle ne
      classe que des photos de fruits ou de bulbes de ces trois cultures ;
      reprenez une photo cadrée dessus.
    </div>
  );
}

/**
 * Quand la confiance passe sous le seuil, on refuse de trancher.
 */
function IncertitudeExpliquee({ fruit }: { fruit: DiagnosticFruit }) {
  return (
    <div className="avis avis--incertain">
      <strong>Diagnostic incertain.</strong> Le modèle hésite entre plusieurs
      états ({Math.round(fruit.confiance * 100)}&nbsp;% pour l&apos;hypothèse la
      plus probable). Reprenez la photo de plus près, en lumière naturelle, ou
      demandez un avis à un technicien.
    </div>
  );
}