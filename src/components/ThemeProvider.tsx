/**
 * Fournit le theme clair/sombre a toute l'application.
 *
 * Persiste le choix dans localStorage ; "system" suit
 * prefers-color-scheme et se met a jour si l'utilisateur change ce reglage
 * en cours de session (utile pour une demo au grand jour comme en salle).
 * La classe "dark" posee sur <html> pilote a elle seule tout le thème : les
 * couleurs Tailwind pointent vers des variables CSS (voir tokens.css), donc
 * aucun composant n'a besoin d'ecrire de classe "dark:" pour en beneficier.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

type ContexteTheme = {
  theme: Theme;
  themeResolu: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const CLE_STOCKAGE = 'agricam-theme';

const ContexteThemeReact = createContext<ContexteTheme | null>(null);

function themeSysteme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function themeInitial(): Theme {
  const stocke = window.localStorage.getItem(CLE_STOCKAGE);
  return stocke === 'light' || stocke === 'dark' || stocke === 'system'
    ? stocke
    : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(themeInitial);
  const [themeResolu, setThemeResolu] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? themeSysteme() : theme,
  );

  const setTheme = useCallback((prochain: Theme) => {
    window.localStorage.setItem(CLE_STOCKAGE, prochain);
    setThemeState(prochain);
  }, []);

  // Applique la classe "dark" a chaque changement de theme resolu.
  useEffect(() => {
    const resolu = theme === 'system' ? themeSysteme() : theme;
    setThemeResolu(resolu);
    document.documentElement.classList.toggle('dark', resolu === 'dark');
  }, [theme]);

  // En mode "system", suit les changements de preference du systeme.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const surChangement = () => {
      const resolu = themeSysteme();
      setThemeResolu(resolu);
      document.documentElement.classList.toggle('dark', resolu === 'dark');
    };
    media.addEventListener('change', surChangement);
    return () => media.removeEventListener('change', surChangement);
  }, [theme]);

  const valeur = useMemo(
    () => ({ theme, themeResolu, setTheme }),
    [theme, themeResolu, setTheme],
  );

  return (
    <ContexteThemeReact.Provider value={valeur}>
      {children}
    </ContexteThemeReact.Provider>
  );
}

export function useTheme(): ContexteTheme {
  const contexte = useContext(ContexteThemeReact);
  if (!contexte) {
    throw new Error('useTheme doit etre utilise dans un <ThemeProvider>.');
  }
  return contexte;
}
