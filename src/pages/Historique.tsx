/**
 * Historique des consultations.
 *
 * Tout est lu depuis le telephone : cette page reste consultable sans reseau,
 * comme le reste de l'application.
 *
 * Elle repond a une question que le diagnostic unitaire ne peut pas traiter :
 * non pas « qu'a ce fruit », mais « ou en est ma parcelle ». C'est la
 * repetition des observations qui fait le suivi sanitaire, pas la photo isolee.
 */

import { useEffect, useState } from 'react';
import { History, ScanEye, TriangleAlert, type LucideIcon } from 'lucide-react';
import { CLASSES, couleurGravite, type Gravite } from '../lib/classes';
import { historique, parcelles, supprimer, type Consultation, type Parcelle } from '../lib/stockage';
import { BandeSeverite } from '../components/BandeSeverite';
import { EtatVide } from '../components/EtatVide';

const LIBELLE_GRAVITE: Record<Gravite, string> = {
  sain: 'Sain',
  alerte: 'À surveiller',
  atteint: 'Atteint',
  grave: 'Grave',
};

export function Historique() {
  const [consultations, setConsultations] = useState<Consultation[] | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [listeParcelles, setListeParcelles] = useState<Parcelle[]>([]);

  useEffect(() => {
    historique().then(setConsultations);
    parcelles().then(setListeParcelles);
  }, []);

  async function retirer(id: string) {
    await supprimer(id);
    setConsultations((liste) => liste?.filter((c) => c.id !== id) ?? null);
  }

  if (consultations === null) {
    return <p>Lecture de l’historique…</p>;
  }

  if (consultations.length === 0) {
    return (
      <EtatVide
        intitule="Historique"
        titre="Aucune consultation"
        lien={{ to: '/diagnostic', texte: 'Faire un premier diagnostic' }}
        enfants={
          <p>
            Les diagnostics que vous ferez apparaîtront ici, avec leur date et
            leur photo. Tout reste sur votre téléphone.
          </p>
        }
      />
    );
  }

  // Statistiques d'ensemble : c'est ce qui transforme une liste en suivi.
  const atteintes = consultations.filter(
    (c) => c.graviteGlobale === 'atteint' || c.graviteGlobale === 'grave',
  ).length;
  const fruits = consultations.reduce((s, c) => s + c.fruits.length, 0);

  return (
    <div className="flex flex-col gap-e4">
      <section className="grid grid-cols-1 gap-e3 bp520:grid-cols-3">
        <KpiTuile
          icone={History}
          couleur="sain"
          valeur={consultations.length}
          libelle="consultations"
        />
        <KpiTuile icone={ScanEye} couleur="sain" valeur={fruits} libelle="fruits analysés" />
        <KpiTuile
          icone={TriangleAlert}
          couleur={atteintes > 0 ? 'atteint' : 'sain'}
          valeur={atteintes}
          libelle="avec atteinte"
        />
      </section>

      <ul className="m-0 flex list-none flex-col gap-e2 p-0">
        {consultations.map((c) => {
          const principal = c.fruits[0];
          const deplie = ouvert === c.id;

          return (
            <li key={c.id} className="overflow-hidden rounded-lg border border-trait bg-carte">
              <button
                className="flex w-full items-stretch gap-e3 rounded-none border-0 bg-transparent p-0 text-left"
                onClick={() => setOuvert(deplie ? null : c.id)}
                aria-expanded={deplie}
              >
                <img
                  className="h-[76px] w-[76px] shrink-0 bg-encre object-cover"
                  src={principal.vignette}
                  alt=""
                />

                <span className="flex min-w-0 flex-1 flex-col justify-center gap-e1 py-e3 pr-e3">
                  <span className="flex items-baseline justify-between gap-e2">
                    <span
                      className="font-donnee text-xs font-bold uppercase tracking-[0.06em]"
                      style={{
                        color: principal.horsSujet
                          ? 'var(--inconnu)'
                          : couleurGravite(c.graviteGlobale),
                      }}
                    >
                      {principal.horsSujet ? 'Hors sujet' : LIBELLE_GRAVITE[c.graviteGlobale]}
                    </span>
                    <span className="donnee text-xs text-encre-douce">{dater(c.horodatage)}</span>
                  </span>

                  <span className="truncate text-sm font-semibold">
                    {principal.horsSujet ? 'Photo non reconnue' : principal.classe.nom}
                  </span>

                  <span className="flex items-center gap-e2 text-xs text-encre-douce">
                    {principal.horsSujet ? null : c.fruits.length > 1 ? (
                      <span className="donnee">
                        {c.nbAtteints}/{c.fruits.length} atteints ·{' '}
                        {Math.round(c.tauxInfestation * 100)}&nbsp;%
                      </span>
                    ) : (
                      <span className="donnee">
                        {Math.min(99, Math.round(principal.confiance * 100))}&nbsp;%
                      </span>
                    )}
                    {c.correction && (
                      <span className="rounded-sm border border-trait px-e1 font-donnee text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        corrigé
                      </span>
                    )}
                  </span>
                </span>
              </button>

              {deplie && (
                <div className="flex flex-col gap-e3 border-t border-trait p-e3">
                  {principal.horsSujet ? (
                    <p className="avis avis--erreur m-0">
                      Cette photo ne ressemblait à aucune des cultures
                      reconnues (tomate, piment, oignon).
                    </p>
                  ) : (
                    <>
                      <img
                        className="block w-full rounded bg-encre"
                        src={principal.vignetteChaleur}
                        alt="Zones ayant motivé le diagnostic"
                      />

                      <BandeSeverite
                        probabilites={principal.probabilites}
                        indiceRetenu={CLASSES.findIndex(
                          (x) => x.id === principal.classe.id,
                        )}
                        incertain={principal.incertain}
                      />
                    </>
                  )}

                  <p className="donnee m-0 text-xs text-encre-douce">
                    {c.dureeMs} ms
                    {c.position &&
                      ` · ${c.position.latitude.toFixed(3)}, ${c.position.longitude.toFixed(3)}`}
                    {c.sansDetection && ' · pleine image'}
                  </p>

                  {c.parcelleId && (
                    <p className="donnee m-0 text-xs text-encre-douce">
                      Parcelle :{' '}
                      {listeParcelles.find((p) => p.id === c.parcelleId)?.nom ?? '—'}
                    </p>
                  )}

                  <button className="bouton-second" onClick={() => retirer(c.id)}>
                    Supprimer cette consultation
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Classes completes (jamais construites par template) : le purge de Tailwind
 * n'a besoin de reconnaitre que des chaines litterales. */
const BADGE_COULEUR: Record<'sain' | 'atteint', string> = {
  sain: 'bg-sain-fond text-sain',
  atteint: 'bg-atteint-fond text-atteint',
};

/** Tuile de statistique, meme grammaire visuelle que les "Chiffres" de
 * l'accueil : icone dans un badge colore, valeur en chasse fixe, libelle. */
function KpiTuile({
  icone: Icone,
  couleur,
  valeur,
  libelle,
}: {
  icone: LucideIcon;
  couleur: 'sain' | 'atteint';
  valeur: number;
  libelle: string;
}) {
  return (
    <div className="carte flex items-center gap-e3">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${BADGE_COULEUR[couleur]}`}
        aria-hidden="true"
      >
        <Icone size={22} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="donnee text-xl font-bold leading-none tracking-[-0.02em] text-encre">
          {valeur}
        </span>
        <span className="text-sm leading-[1.3] text-encre-douce">{libelle}</span>
      </div>
    </div>
  );
}

/** Date relative tant qu'elle reste utile, absolue ensuite. */
function dater(horodatage: number): string {
  const minutes = Math.floor((Date.now() - horodatage) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;

  return new Date(horodatage).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
