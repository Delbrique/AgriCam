/**
 * BANDE DE SEVERITE - element signature de l'interface.
 *
 * Reprend la forme d'une bandelette de test agronomique, l'instrument que les
 * producteurs et les techniciens connaissent deja. Chaque segment represente
 * une probabilite de classe ; le segment retenu est souleve et legende.
 *
 * Le meme composant sert sur la fiche de resultat, dans les lignes
 * d'historique et dans la legende de la carte : une seule grammaire visuelle
 * pour dire l'etat sanitaire, partout dans l'application.
 */

import { CLASSES, couleurGravite, nomClasse, type Gravite } from '../lib/classes';
import { useTraduction } from '../lib/traduction';

interface Props {
  probabilites: Float32Array;
  indiceRetenu: number;
  /** Version reduite, sans legende, pour les listes. */
  compacte?: boolean;
  incertain?: boolean;
}

/** Part minimale d'un segment, pour qu'il reste visible et cliquable. */
const PART_MINIMALE = 0.015;

export function BandeSeverite({
  probabilites,
  indiceRetenu,
  compacte = false,
  incertain = false,
}: Props) {
  const { t, langue } = useTraduction();
  const segments = Array.from(probabilites)
    .map((p, i) => ({ p, i, classe: CLASSES[i] }))
    .filter((s) => s.p >= PART_MINIMALE)
    .sort((a, b) => b.p - a.p);

  const total = segments.reduce((s, x) => s + x.p, 0);
  const retenu = CLASSES[indiceRetenu];
  const libelle = incertain
    ? t.bandeSeverite.diagnosticIncertain
    : t.bandeSeverite.diagnostic(
        nomClasse(retenu, langue),
        Math.round(probabilites[indiceRetenu] * 100),
      );

  if (compacte) {
    return (
      <div
        className="flex h-[10px] gap-[2px] overflow-hidden rounded-sm bg-trait shadow-[inset_0_0_0_1px_rgba(14,26,19,0.18)]"
        role="img"
        aria-label={libelle}
      >
        {segments.map(({ p, i, classe }) => (
          <span
            key={classe.id}
            className={`min-w-[3px] flex-shrink basis-0 transition-[filter] duration-[140ms] ease-in-out ${i === indiceRetenu ? 'relative shadow-[inset_0_0_0_2px_rgba(255,255,255,0.85)]' : ''}`}
            style={{
              flexGrow: p / total,
              background: incertain ? 'var(--inconnu)' : couleurGravite(classe.gravite),
            }}
            title={`${nomClasse(classe, langue)} - ${Math.round(p * 100)} %`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-e3" role="img" aria-label={libelle}>
      {segments.map(({ p, i, classe }) => (
        <div key={classe.id} className="flex flex-col gap-e1">
          <span className="flex items-center gap-e2 text-sm">
            <span className="min-w-0 flex-1 truncate">{nomClasse(classe, langue)}</span>
            {i === indiceRetenu && !incertain && (
              <span
                className="rounded-sm border border-encre px-e1 font-donnee text-[0.625rem] font-bold uppercase tracking-[0.1em] text-encre"
                aria-hidden="true"
              >
                {t.bandeSeverite.retenu}
              </span>
            )}
            <span className="donnee shrink-0 text-sm text-encre-douce">
              {Math.round(p * 100)}&nbsp;%
            </span>
          </span>
          <div className="h-[10px] w-full overflow-hidden rounded-sm bg-trait shadow-[inset_0_0_0_1px_rgba(14,26,19,0.18)]">
            <span
              className="block h-full rounded-sm transition-[width] duration-[140ms] ease-in-out"
              style={{
                width: `${Math.round(p * 100)}%`,
                background: incertain ? 'var(--inconnu)' : couleurGravite(classe.gravite),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Variante autonome, quand seule la gravite est connue (carte, listes). */
export function PastilleGravite({ gravite, libelle }: { gravite: Gravite; libelle: string }) {
  return (
    <span
      className="inline-flex items-center gap-e2 rounded-full border-[1.5px] bg-carte px-e3 py-e1 text-sm font-semibold"
      style={{ borderColor: couleurGravite(gravite) }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: couleurGravite(gravite) }} />
      {libelle}
    </span>
  );
}
