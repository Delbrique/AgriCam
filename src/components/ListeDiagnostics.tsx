/**
 * Derniers diagnostics - liste du tableau de bord (fusionne l'ancienne page
 * Historique). Chaque carte montre la vignette du fruit ET la carte de
 * chaleur cote a cote, un statut a trois niveaux (sain/a surveiller/
 * critique - voir lib/tableauDeBord.ts), et se deplie sur la conduite a
 * tenir complete. La periode est deja filtree par le parent (tableau de
 * bord) ; ce composant ajoute les filtres culture et statut.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import { CLASSES } from '../lib/classes';
import { statutFruit, type StatutDiagnostic } from '../lib/tableauDeBord';
import { supprimer, type Consultation, type Parcelle } from '../lib/stockage';
import { BandeSeverite } from './BandeSeverite';
import { ConduiteATenir } from './ConduiteATenir';

const LIBELLE_STATUT: Record<StatutDiagnostic, string> = {
  sain: 'Sain',
  surveiller: 'À surveiller',
  critique: 'Critique',
};

const EMOJI_STATUT: Record<StatutDiagnostic, string> = {
  sain: '🟢',
  surveiller: '🟠',
  critique: '🔴',
};

const LIBELLE_CULTURE: Record<'tomate' | 'piment' | 'oignon', string> = {
  tomate: 'Tomate',
  piment: 'Piment',
  oignon: 'Oignon',
};

type FiltreCulture = 'toutes' | 'tomate' | 'piment' | 'oignon';
type FiltreStatut = 'tous' | StatutDiagnostic;
type Statut = StatutDiagnostic | 'horsSujet' | 'incertain';

const PAS_PAGINATION = 5;

function principalDe(c: Consultation) {
  return c.fruits.find((f) => !f.horsSujet) ?? c.fruits[0];
}

function statutDe(c: Consultation): Statut {
  const p = principalDe(c);
  if (p.horsSujet) return 'horsSujet';
  if (p.incertain) return 'incertain';
  return statutFruit(p);
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

interface Props {
  /** Deja filtree par periode par le parent (voir pages/TableauDeBord.tsx). */
  consultations: Consultation[];
  parcelles: Parcelle[];
  onConsultationSupprimee: (id: string) => void;
}

export function ListeDiagnostics({ consultations, parcelles, onConsultationSupprimee }: Props) {
  const [filtreCulture, setFiltreCulture] = useState<FiltreCulture>('toutes');
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const [ouvert, setOuvert] = useState<string | null>(null);

  if (consultations.length === 0) {
    return (
      <p className="m-0 text-sm text-encre-douce">
        Aucun diagnostic pour l&apos;instant.{' '}
        <Link to="/diagnostic" className="font-semibold text-encre">
          Lancer un diagnostic
        </Link>
        .
      </p>
    );
  }

  const filtrees = consultations.filter((c) => {
    const principal = principalDe(c);
    if (filtreCulture !== 'toutes' && (principal.horsSujet || principal.classe.culture !== filtreCulture)) {
      return false;
    }
    if (filtreStatut !== 'tous' && statutDe(c) !== filtreStatut) return false;
    return true;
  });
  const visibles = filtrees.slice(0, limite);

  async function retirer(id: string) {
    await supprimer(id);
    onConsultationSupprimee(id);
  }

  return (
    <div className="flex flex-col gap-e3">
      <div className="flex flex-wrap gap-e2">
        {(['toutes', 'tomate', 'piment', 'oignon'] as FiltreCulture[]).map((v) => (
          <button
            key={v}
            className={
              filtreCulture === v
                ? 'min-h-[36px] rounded border border-encre bg-encre px-e3 text-xs font-semibold text-papier'
                : 'min-h-[36px] rounded border border-trait bg-transparent px-e3 text-xs font-semibold text-encre hover:bg-trait/30'
            }
            onClick={() => setFiltreCulture(v)}
            aria-pressed={filtreCulture === v}
          >
            {v === 'toutes' ? 'Toutes cultures' : LIBELLE_CULTURE[v]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-e2">
        {(['tous', 'sain', 'surveiller', 'critique'] as FiltreStatut[]).map((v) => (
          <button
            key={v}
            className={
              filtreStatut === v
                ? 'min-h-[36px] rounded border border-encre bg-encre px-e3 text-xs font-semibold text-papier'
                : 'min-h-[36px] rounded border border-trait bg-transparent px-e3 text-xs font-semibold text-encre hover:bg-trait/30'
            }
            onClick={() => setFiltreStatut(v)}
            aria-pressed={filtreStatut === v}
          >
            {v === 'tous' ? 'Tous statuts' : `${EMOJI_STATUT[v]} ${LIBELLE_STATUT[v]}`}
          </button>
        ))}
      </div>

      {filtrees.length === 0 ? (
        <p className="m-0 text-sm text-encre-douce">Aucun diagnostic ne correspond à ces filtres.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-e2 p-0">
          {visibles.map((c) => {
            const principal = principalDe(c);
            const statut = statutDe(c);
            const deplie = ouvert === c.id;
            const parcelle = parcelles.find((p) => p.id === c.parcelleId);

            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-lg border border-trait bg-carte transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-encre hover:shadow-lg"
              >
                <button
                  className="flex w-full items-stretch gap-e3 rounded-none border-0 bg-transparent p-e3 text-left"
                  onClick={() => setOuvert(deplie ? null : c.id)}
                  aria-expanded={deplie}
                >
                  <span className="flex shrink-0 gap-1">
                    <img
                      className="h-16 w-16 rounded bg-encre object-cover"
                      src={principal.vignette}
                      alt=""
                    />
                    {!principal.horsSujet && (
                      <img
                        className="h-16 w-16 rounded bg-encre object-cover"
                        src={principal.vignetteChaleur}
                        alt=""
                      />
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                    <span className="flex items-center gap-e2 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-encre-douce">
                      <span aria-hidden="true">
                        {statut === 'horsSujet' || statut === 'incertain' ? '⚪' : EMOJI_STATUT[statut]}
                      </span>
                      {statut === 'horsSujet'
                        ? 'Hors sujet'
                        : statut === 'incertain'
                          ? 'Incertain'
                          : LIBELLE_STATUT[statut]}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {principal.horsSujet ? 'Photo non reconnue' : principal.classe.nom}
                    </span>
                    <span className="donnee truncate text-xs text-encre-douce">
                      {!principal.horsSujet && `${Math.min(99, Math.round(principal.confiance * 100))} % · `}
                      {dater(c.horodatage)}
                      {parcelle ? ` · ${parcelle.nom}` : c.position ? ' · géolocalisé' : ''}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center text-encre-douce" aria-hidden="true">
                    <ChevronRight
                      size={18}
                      className={deplie ? 'rotate-90 transition-transform' : 'transition-transform'}
                    />
                  </span>
                </button>

                {deplie && (
                  <div className="flex flex-col gap-e3 border-t border-trait p-e3">
                    {principal.horsSujet ? (
                      <p className="avis avis--erreur m-0">
                        Cette photo ne ressemblait à aucune des cultures reconnues (tomate,
                        piment, oignon).
                      </p>
                    ) : principal.incertain ? (
                      <p className="avis avis--incertain m-0">
                        Confiance insuffisante pour trancher entre les maladies connues.
                      </p>
                    ) : (
                      <>
                        <BandeSeverite
                          probabilites={principal.probabilites}
                          indiceRetenu={CLASSES.findIndex((x) => x.id === principal.classe.id)}
                          incertain={principal.incertain}
                        />
                        <ConduiteATenir
                          classe={principal.classe}
                          confiance={principal.confiance}
                          horodatage={c.horodatage}
                          vignetteChaleur={principal.vignetteChaleur}
                        />
                      </>
                    )}

                    <button
                      className="flex min-h-[40px] w-fit items-center gap-e2 rounded border border-trait bg-transparent px-e3 text-sm font-semibold text-atteint hover:bg-atteint-fond"
                      onClick={() => retirer(c.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Supprimer
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {limite < filtrees.length && (
        <button className="bouton-second self-start" onClick={() => setLimite((l) => l + PAS_PAGINATION)}>
          Afficher plus ({filtrees.length - limite} restants)
        </button>
      )}
    </div>
  );
}
