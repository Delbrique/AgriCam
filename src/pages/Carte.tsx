/**
 * Carte.
 *
 * Page dediee a la carte des foyers geolocalises et a la gestion des
 * parcelles (voir composants CarteFoyers/GestionParcelles, qui portent
 * toute la logique). Vivait un temps dans le tableau de bord, mais s'y
 * retrouvait etouffee au milieu d'un long defilement de KPI et de
 * graphiques - une page a elle seule lui laisse la place qu'elle merite.
 */

import { CarteFoyers } from '../components/CarteFoyers';
import { useTraduction } from '../lib/traduction';

export function Carte() {
  const { t } = useTraduction();

  return (
    <div className="flex flex-col gap-e4">
      <div>
        <h1 className="m-0 text-xl tracking-[-0.025em]">{t.carte.titre}</h1>
        <p className="m-0 mt-e1 text-sm text-encre-douce">{t.carte.intro}</p>
      </div>
      <CarteFoyers />
    </div>
  );
}
