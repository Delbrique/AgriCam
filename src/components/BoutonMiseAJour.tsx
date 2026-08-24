/**
 * Verifie si une nouvelle version de l'application est disponible.
 *
 * Seule partie utile au producteur de l'ancien bandeau "Performance du
 * modele & appareil" : l'exactitude, le temps de reponse et l'architecture
 * du modele sont des chiffres pour un jury, pas pour quelqu'un qui utilise
 * l'app au champ. Vit desormais dans les actions rapides du tableau de
 * bord, comme un bouton ordinaire plutot qu'une section a part.
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

type EtatVerification = 'inactif' | 'verification' | 'fait' | 'indisponible';

export function BoutonMiseAJour() {
  const [etat, setEtat] = useState<EtatVerification>('inactif');

  async function verifier() {
    setEtat('verification');
    if (!('serviceWorker' in navigator)) {
      setEtat('indisponible');
      return;
    }
    const enregistrement = await navigator.serviceWorker.getRegistration();
    if (!enregistrement) {
      setEtat('indisponible');
      return;
    }
    // Force le navigateur a comparer le fichier du service worker a celui
    // deja installe ; une mise a jour detectee s'installera en arriere-plan
    // et prendra effet au prochain chargement complet (registerType:
    // 'autoUpdate', voir vite.config.ts).
    await enregistrement.update();
    setEtat('fait');
  }

  return (
    <div className="flex flex-wrap items-center gap-e2">
      <button
        type="button"
        className="bouton-second flex items-center gap-e2"
        onClick={verifier}
        disabled={etat === 'verification'}
      >
        <RefreshCw
          size={16}
          aria-hidden="true"
          className={etat === 'verification' ? 'animate-spin' : ''}
        />
        Vérifier les mises à jour
      </button>
      {etat === 'fait' && <span className="text-xs text-sain">Vérification effectuée.</span>}
      {etat === 'indisponible' && (
        <span className="text-xs text-encre-douce">Indisponible sur ce navigateur.</span>
      )}
    </div>
  );
}
