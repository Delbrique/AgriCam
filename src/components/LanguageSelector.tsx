import { Languages } from 'lucide-react';
import { useTraduction } from '../lib/traduction';

/** Bouton qui bascule FR/EN. Seulement deux langues geree pour l'instant :
    un cycle a deux etats suffit, un dialogue de selection (comme sur des
    sites a dix langues) serait une abstraction inutile ici. */
export function LanguageSelector() {
  const { langue, changerLangue } = useTraduction();
  const prochaine = langue === 'fr' ? 'en' : 'fr';

  return (
    <button
      type="button"
      onClick={() => changerLangue(prochaine)}
      aria-label={
        langue === 'fr' ? 'Switch to English' : 'Passer en français'
      }
      className="relative grid place-items-center min-h-cible min-w-cible rounded bg-transparent text-chrome-texte hover:bg-white/10"
    >
      <Languages className="h-5 w-5" />
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-accent px-1 text-[10px] font-bold leading-[14px] text-chrome">
        {langue.toUpperCase()}
      </span>
    </button>
  );
}
