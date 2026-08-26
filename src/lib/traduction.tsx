/**
 * Systeme de traduction maison (FR/EN), sans i18next : l'application ne
 * traduit pour l'instant que le chrome (en-tete/navigation), un volume qui
 * ne justifie pas une dependance supplementaire sur une PWA qui charge deja
 * des modeles tfjs/onnx lourds. Le tableau de bord et le diagnostic restent
 * en francais uniquement, comme avant eux l'historique et la carte.
 *
 * `t` expose directement l'objet de traduction de la langue active : les
 * appelants ecrivent `t.accueil.titre` plutot que `t('accueil.titre')`, ce qui
 * donne l'autocompletion ET une erreur de compilation si une cle manque dans
 * un des deux dictionnaires (voir l'interface Traductions ci-dessous, que
 * fr.ts et en.ts doivent toutes deux respecter).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fr } from './locales/fr';
import { en } from './locales/en';

export interface Traductions {
  chrome: {
    marque: string;
    sousTitre: string;
    nav: {
      tableauDeBord: string;
      diagnostic: string;
      communaute: string;
    };
    modeleIncompatible: string;
  };
}

export type Langue = 'fr' | 'en';

const DICTIONNAIRES: Record<Langue, Traductions> = { fr, en };

const CLE_STOCKAGE = 'agricam-langue';

type ContexteTraduction = {
  langue: Langue;
  changerLangue: (langue: Langue) => void;
  t: Traductions;
};

const ContexteTraductionReact = createContext<ContexteTraduction | null>(null);

function langueInitiale(): Langue {
  const stockee = window.localStorage.getItem(CLE_STOCKAGE);
  if (stockee === 'fr' || stockee === 'en') return stockee;
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function TraductionProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(langueInitiale);

  const changerLangue = useCallback((prochaine: Langue) => {
    window.localStorage.setItem(CLE_STOCKAGE, prochaine);
    setLangue(prochaine);
  }, []);

  const valeur = useMemo(
    () => ({ langue, changerLangue, t: DICTIONNAIRES[langue] }),
    [langue, changerLangue],
  );

  return (
    <ContexteTraductionReact.Provider value={valeur}>
      {children}
    </ContexteTraductionReact.Provider>
  );
}

export function useTraduction(): ContexteTraduction {
  const contexte = useContext(ContexteTraductionReact);
  if (!contexte) {
    throw new Error('useTraduction doit etre utilise dans un <TraductionProvider>.');
  }
  return contexte;
}
