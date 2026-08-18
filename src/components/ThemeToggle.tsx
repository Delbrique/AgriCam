import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

/** Bouton icone qui bascule entre clair et sombre (le mode "systeme" reste
    accessible en effacant la cle localStorage, mais n'a pas besoin d'un
    troisieme etat ici : un bouton a deux etats suffit a l'usage courant). */
export function ThemeToggle() {
  const { themeResolu, setTheme } = useTheme();
  const versSombre = themeResolu === 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(versSombre ? 'dark' : 'light')}
      aria-label={versSombre ? 'Passer au mode sombre' : 'Passer au mode clair'}
      className="grid place-items-center min-h-cible min-w-cible rounded bg-transparent text-chrome-texte hover:bg-white/10"
    >
      {versSombre ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
