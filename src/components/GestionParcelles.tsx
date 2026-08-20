/**
 * Gestion des parcelles.
 *
 * Une parcelle regroupe sous un nom ("Champ piment - derriere la maison")
 * des points de diagnostic qui, seuls, ne disent rien : c'est leur suite
 * dans le temps qui montre si une zone du champ s'ameliore ou empire. Vit
 * sur la page Carte, a cote des foyers geolocalises - une parcelle n'a de
 * sens qu'associee a un lieu.
 */

import { useEffect, useState } from 'react';
import {
  Check,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { couleurGravite } from '../lib/classes';
import {
  creerParcelle,
  renommerParcelle,
  statutParcelle,
  supprimerParcelle,
  type Parcelle,
  type StatutParcelle,
} from '../lib/stockage';

const LIBELLE_CULTURE: Record<Parcelle['culture'], string> = {
  tomate: 'Tomate',
  piment: 'Piment',
  oignon: 'Oignon',
};

interface Props {
  parcelles: Parcelle[];
  positionActuelle: { latitude: number; longitude: number } | null;
  /** La liste des parcelles vit dans le composant parent (la carte s'en sert
   * aussi, pour rattacher un point depuis son infobulle) : ce composant lui
   * signale juste qu'il faut la relire apres une creation/modification. */
  onParcellesChangees: () => void;
  /** Incremente a chaque rattachement d'une consultation depuis l'infobulle
   * de la carte : la liste `parcelles` elle-meme ne change pas dans ce cas
   * (seule la consultation change de parcelleId), ce compteur est donc le
   * seul signal qui force ce composant a relire le statut des parcelles. */
  rattachementsVersion: number;
  onSelectionner: (parcelle: Parcelle) => void;
}

export function GestionParcelles({
  parcelles,
  positionActuelle,
  onParcellesChangees,
  rattachementsVersion,
  onSelectionner,
}: Props) {
  const [statuts, setStatuts] = useState<Record<string, StatutParcelle>>({});
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [culture, setCulture] = useState<Parcelle['culture']>('tomate');
  const [avecPosition, setAvecPosition] = useState(true);
  const [renommageId, setRenommageId] = useState<string | null>(null);
  const [brouillonNom, setBrouillonNom] = useState('');

  useEffect(() => {
    let annule = false;
    Promise.all(
      parcelles.map((p) => statutParcelle(p.id).then((s) => [p.id, s] as const)),
    ).then((entrees) => {
      if (!annule) setStatuts(Object.fromEntries(entrees));
    });
    return () => {
      annule = true;
    };
  }, [parcelles, rattachementsVersion]);

  async function creer() {
    const nomPropre = nom.trim();
    if (!nomPropre) return;
    await creerParcelle(
      nomPropre,
      culture,
      avecPosition && positionActuelle ? positionActuelle : undefined,
    );
    setNom('');
    setCulture('tomate');
    setCreation(false);
    onParcellesChangees();
  }

  async function validerRenommage(id: string) {
    const nomPropre = brouillonNom.trim();
    if (nomPropre) await renommerParcelle(id, nomPropre);
    setRenommageId(null);
    onParcellesChangees();
  }

  async function retirer(id: string) {
    await supprimerParcelle(id);
    onParcellesChangees();
  }

  return (
    <div className="flex flex-col gap-e3">
      <div className="flex items-center justify-between gap-e2">
        <h3 className="intitule">Mes parcelles</h3>
        {!creation && (
          <button
            className="bouton-second flex items-center gap-e1 px-e3 text-sm"
            onClick={() => setCreation(true)}
          >
            <Plus size={16} aria-hidden="true" /> Nouvelle parcelle
          </button>
        )}
      </div>

      {parcelles.length > 0 && (
        <p className="m-0 text-xs text-encre-douce">
          Pour rattacher un diagnostic à une parcelle : cliquez sur son point
          coloré sur la carte, puis choisissez la parcelle dans le menu «
          Parcelle » qui apparaît dans l&apos;infobulle.
        </p>
      )}

      {creation && (
        <form
          className="carte flex flex-col gap-e3"
          onSubmit={(e) => {
            e.preventDefault();
            creer();
          }}
        >
          <label className="flex flex-col gap-e1 text-sm">
            Nom
            <input
              className="rounded border border-trait bg-transparent px-e3 py-e2"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Champ piment - derrière la maison"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-e1 text-sm">
            Culture
            <select
              className="rounded border border-trait bg-transparent px-e3 py-e2"
              value={culture}
              onChange={(e) => setCulture(e.target.value as Parcelle['culture'])}
            >
              {(Object.keys(LIBELLE_CULTURE) as Parcelle['culture'][]).map((c) => (
                <option key={c} value={c}>
                  {LIBELLE_CULTURE[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-e2 text-sm">
            <input
              type="checkbox"
              checked={avecPosition}
              disabled={!positionActuelle}
              onChange={(e) => setAvecPosition(e.target.checked)}
            />
            Utiliser ma position actuelle
          </label>
          {!positionActuelle && (
            <p className="m-0 text-xs text-encre-douce">
              Position indisponible pour l’instant — la parcelle sera créée
              sans repère sur la carte.
            </p>
          )}

          <div className="flex gap-e2">
            <button type="submit" className="bouton-principal" disabled={!nom.trim()}>
              Créer
            </button>
            <button type="button" className="bouton-second" onClick={() => setCreation(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {parcelles.length === 0 && !creation && (
        <p className="m-0 text-sm text-encre-douce">
          Regroupez vos points de diagnostic sous un nom de parcelle pour
          suivre leur évolution dans le temps.
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-e2 p-0">
        {parcelles.map((p) => {
          const statut = statuts[p.id];
          const enRenommage = renommageId === p.id;

          return (
            <li key={p.id} className="carte flex flex-col gap-e2 p-e3">
              <div className="flex items-center gap-e2">
                <span
                  className="h-[10px] w-[10px] shrink-0 rounded-full"
                  style={{
                    background: statut?.gravitePire
                      ? couleurGravite(statut.gravitePire)
                      : 'var(--trait)',
                  }}
                  aria-hidden="true"
                />

                {enRenommage ? (
                  <input
                    className="min-w-0 flex-1 rounded border border-trait bg-transparent px-e2 py-e1 text-sm"
                    value={brouillonNom}
                    onChange={(e) => setBrouillonNom(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') validerRenommage(p.id);
                      if (e.key === 'Escape') setRenommageId(null);
                    }}
                  />
                ) : (
                  <button
                    className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-sm font-semibold disabled:cursor-default"
                    onClick={() => p.position && onSelectionner(p)}
                    disabled={!p.position}
                    title={p.position ? 'Centrer la carte sur cette parcelle' : undefined}
                  >
                    {p.nom}
                  </button>
                )}

                <span className="donnee shrink-0 text-xs text-encre-douce">
                  {LIBELLE_CULTURE[p.culture]}
                </span>

                {enRenommage ? (
                  <>
                    <IconeBouton icone={Check} label="Valider" onClick={() => validerRenommage(p.id)} />
                    <IconeBouton icone={X} label="Annuler" onClick={() => setRenommageId(null)} />
                  </>
                ) : (
                  <>
                    <IconeBouton
                      icone={Pencil}
                      label={`Renommer ${p.nom}`}
                      onClick={() => {
                        setRenommageId(p.id);
                        setBrouillonNom(p.nom);
                      }}
                    />
                    <IconeBouton
                      icone={Trash2}
                      label={`Supprimer ${p.nom}`}
                      onClick={() => retirer(p.id)}
                    />
                  </>
                )}
              </div>

              <p className="donnee m-0 text-xs text-encre-douce">
                {statut && statut.nbRecent > 0 ? (
                  <>
                    {statut.nbRecent} consultation{statut.nbRecent > 1 ? 's' : ''} ·{' '}
                    {Math.round((statut.tauxRecent ?? 0) * 100)}&nbsp;% infestation (30 j)
                    {' · '}
                    <Tendance tendance={statut.tendance} />
                  </>
                ) : (
                  'Pas encore de consultation rattachée'
                )}
              </p>

              {p.position && (
                <p className="m-0 flex items-center gap-e1 text-xs text-encre-douce">
                  <MapPin size={12} aria-hidden="true" /> Repérée sur la carte
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconeBouton({
  icone: Icone,
  label,
  onClick,
}: {
  icone: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-trait"
      onClick={onClick}
      aria-label={label}
    >
      <Icone size={16} aria-hidden="true" />
    </button>
  );
}

function Tendance({ tendance }: { tendance: StatutParcelle['tendance'] }) {
  if (tendance === 'aggravation') {
    return (
      <span className="inline-flex items-center gap-e1 text-atteint">
        <TrendingUp size={14} aria-hidden="true" /> en hausse
      </span>
    );
  }
  if (tendance === 'amelioration') {
    return (
      <span className="inline-flex items-center gap-e1 text-sain">
        <TrendingDown size={14} aria-hidden="true" /> en baisse
      </span>
    );
  }
  if (tendance === 'stable') {
    return (
      <span className="inline-flex items-center gap-e1">
        <Minus size={14} aria-hidden="true" /> stable
      </span>
    );
  }
  return null;
}
