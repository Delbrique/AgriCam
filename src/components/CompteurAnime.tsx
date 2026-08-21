/**
 * Nombre qui compte de 0 jusqu'a sa valeur, plutot que d'apparaitre figee -
 * un ressort de vie tres simple sur les tuiles KPI du tableau de bord.
 * Repart de 0 a chaque changement de valeur (ex. changement de periode) :
 * l'effet de "compte" est plus lisible qu'une interpolation entre deux
 * chiffres. Respecte prefers-reduced-motion (deja en place globalement,
 * voir tailwind.css) en affichant directement la valeur finale.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  valeur: number;
  decimales?: number;
  suffixe?: string;
  dureeMs?: number;
}

function reductionMouvementDemandee(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CompteurAnime({ valeur, decimales = 0, suffixe = '', dureeMs = 900 }: Props) {
  const [affiche, setAffiche] = useState(() => (reductionMouvementDemandee() ? valeur : 0));
  const idAnimationRef = useRef<number>();

  useEffect(() => {
    if (reductionMouvementDemandee()) {
      setAffiche(valeur);
      return;
    }

    const debut = performance.now();

    function etape(maintenant: number) {
      const t = Math.min(1, (maintenant - debut) / dureeMs);
      const facilite = 1 - (1 - t) ** 3; // ease-out cubique
      setAffiche(valeur * facilite);
      if (t < 1) idAnimationRef.current = requestAnimationFrame(etape);
    }

    idAnimationRef.current = requestAnimationFrame(etape);
    return () => {
      if (idAnimationRef.current) cancelAnimationFrame(idAnimationRef.current);
    };
  }, [valeur, dureeMs]);

  return (
    <>
      {affiche.toLocaleString('fr-FR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
      {suffixe}
    </>
  );
}
