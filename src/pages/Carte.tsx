/**
 * Carte des foyers.
 *
 * Voir components/CarteFoyers.tsx pour la logique et les choix (carte
 * personnelle, locale, sans serveur partage entre producteurs).
 */

import { CarteFoyers } from '../components/CarteFoyers';

export function Carte() {
  return (
    <div className="flex flex-col gap-e4">
      <div>
        <p className="intitule">Carte des foyers</p>
        <h1 className="mb-e1 mt-e1 text-xl">Où, dans votre champ ?</h1>
        <p className="m-0 text-sm text-encre-douce">
          Chaque diagnostic géolocalisé devient un point sur cette carte.
          Utile surtout pour la tomate et le piment, dont l&apos;état se lit
          sur le fruit en place ; l&apos;oignon ne se juge qu&apos;une fois le
          bulbe déterré.
        </p>
      </div>

      <CarteFoyers />
    </div>
  );
}
