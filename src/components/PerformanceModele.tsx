/**
 * Performance du modele & appareil - bandeau bas du tableau de bord.
 *
 * Uniquement des faits verifies (voir CAHIER_DES_CHARGES.md : exactitude
 * mesuree sur le jeu de test, temps de reponse chronometre, poids reel des
 * artefacts telecharges) - aucune precision/rappel/F1 par classe : ces
 * chiffres n'existent nulle part dans le depot, les inventer serait
 * exactement ce que ce tableau de bord s'interdit ailleurs.
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import pkg from '../../package.json';
import { classifieurPret } from '../lib/classifieur';
import { detecteurPret } from '../lib/detecteur';

type EtatVerification = 'inactif' | 'verification' | 'fait' | 'indisponible';

interface Props {
  nbDiagnostics: number;
}

export function PerformanceModele({ nbDiagnostics }: Props) {
  const [etatVerif, setEtatVerif] = useState<EtatVerification>('inactif');
  const modelePret = classifieurPret() && detecteurPret();

  async function verifierMisesAJour() {
    setEtatVerif('verification');
    if (!('serviceWorker' in navigator)) {
      setEtatVerif('indisponible');
      return;
    }
    const enregistrement = await navigator.serviceWorker.getRegistration();
    if (!enregistrement) {
      setEtatVerif('indisponible');
      return;
    }
    // Force le navigateur a comparer le fichier du service worker a celui
    // deja installe ; une mise a jour detectee s'installera en arriere-plan
    // et prendra effet au prochain chargement complet (registerType:
    // 'autoUpdate', voir vite.config.ts).
    await enregistrement.update();
    setEtatVerif('fait');
  }

  return (
    <section className="carte flex flex-col gap-e4">
      <p className="intitule">Performance du modèle &amp; appareil</p>

      <div className="grid grid-cols-2 gap-e3 bp560:grid-cols-4">
        <Statistique valeur="95,9 %" libelle="exactitude sur le jeu de test" />
        <Statistique valeur="647 ms" libelle="temps de réponse mesuré" />
        <Statistique valeur="35,4 Mo" libelle="poids total du modèle" />
        <Statistique
          valeur={String(nbDiagnostics)}
          libelle="diagnostics stockés sur cet appareil"
        />
      </div>

      <p className="m-0 text-sm text-encre-douce">
        EfficientNetB3 + YOLOv8n (détection) + CAM (explicabilité) · Application v{pkg.version} ·{' '}
        {modelePret
          ? 'modèle en cache, prêt hors ligne'
          : 'modèle pas encore mis en cache sur cet appareil'}
      </p>

      <div className="flex flex-wrap items-center gap-e3">
        <button
          type="button"
          className="bouton-second flex items-center gap-e2"
          onClick={verifierMisesAJour}
          disabled={etatVerif === 'verification'}
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={etatVerif === 'verification' ? 'animate-spin' : ''}
          />
          Vérifier les mises à jour
        </button>
        {etatVerif === 'fait' && (
          <span className="text-xs text-sain">Vérification effectuée.</span>
        )}
        {etatVerif === 'indisponible' && (
          <span className="text-xs text-encre-douce">
            Vérification indisponible sur ce navigateur.
          </span>
        )}
      </div>
    </section>
  );
}

function Statistique({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="donnee text-lg font-bold text-encre">{valeur}</span>
      <span className="text-xs leading-[1.3] text-encre-douce">{libelle}</span>
    </div>
  );
}
