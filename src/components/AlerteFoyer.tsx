/**
 * Bandeau d'alerte de propagation.
 *
 * Affiche quand detecterFoyers (voir lib/alerte.ts) repere plusieurs
 * diagnostics de la meme maladie, regroupes geographiquement, sur les deux
 * dernieres semaines. Volontairement visible sans avoir a aller chercher la
 * carte : un producteur qui n'y penserait pas doit quand meme etre averti.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert, X } from 'lucide-react';
import { foyersActuels, type Foyer } from '../lib/alerte';
import { classeParId } from '../lib/classes';

interface Props {
  /** Fournie sur la page Carte : recentre la vue sur ce foyer plutot que de
   * naviguer. Absente ailleurs, ou un lien vers /carte est propose a la
   * place. */
  onLocaliser?: (foyer: Foyer) => void;
}

export function AlerteFoyer({ onLocaliser }: Props) {
  const [foyers, setFoyers] = useState<Foyer[]>([]);
  // Fermeture pour la duree de la session (jusqu'au prochain chargement de
  // page) : un producteur qui a deja vu l'alerte n'a pas besoin qu'elle
  // revienne a chaque clic, mais elle ne doit pas non plus disparaitre pour
  // de bon si un vrai nouveau foyer apparait plus tard.
  const [fermes, setFermes] = useState<Set<string>>(new Set());

  useEffect(() => {
    foyersActuels().then(setFoyers);
  }, []);

  const visibles = foyers.filter((f) => !fermes.has(f.classeId));
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-col gap-e2">
      {visibles.map((foyer) => {
        const classe = classeParId(foyer.classeId);
        return (
          <div key={foyer.classeId} className="avis avis--erreur relative pr-e6">
            <button
              type="button"
              className="absolute right-e2 top-e2 grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-white/40"
              onClick={() =>
                setFermes((prev) => new Set(prev).add(foyer.classeId))
              }
              aria-label="Fermer cette alerte"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <p className="flex items-center gap-e2 font-semibold">
              <TriangleAlert size={18} aria-hidden="true" />
              Foyer possible : {classe?.nom ?? foyer.classeId}
            </p>
            <p>
              {foyer.points.length} diagnostics regroupés dans un même
              secteur au cours des deux dernières semaines. La maladie
              semble se propager : envisagez un traitement préventif sur les
              plants voisins, pas seulement sur les fruits déjà atteints.
            </p>
            {onLocaliser ? (
              <button className="bouton-second self-start" onClick={() => onLocaliser(foyer)}>
                Localiser ce foyer
              </button>
            ) : (
              <Link className="bouton-second self-start no-underline" to="/carte">
                Voir sur la carte
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
