/**
 * Coque de l'application : en-tete, routes, navigation.
 *
 * Quatre pages. L'accueil presente le projet a qui arrive sans contexte ; les
 * trois autres servent l'usage reel. La navigation reste en bas, a portee de
 * pouce, parce que l'outil s'utilise debout, une main occupee par le fruit.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Accueil } from './pages/Accueil';
import { Diagnostic } from './pages/Diagnostic';
import { Historique } from './pages/Historique';
import { verifierReferentiel } from './lib/classes';
import { useTraduction } from './lib/traduction';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSelector } from './components/LanguageSelector';
import { Assistant } from './components/Assistant';

/** Chargee a la demande : Leaflet n'a pas a alourdir les trois autres pages,
 * consultees bien plus souvent que la carte. */
const Carte = lazy(() => import('./pages/Carte').then((m) => ({ default: m.Carte })));

/** Classes de chaque onglet de navigation, calculees selon l'etat actif
    plutot qu'empilees en conflit : mobile = barre basse sur fond "carte"
    (theme-adaptif) ; a bp860, la nav rejoint l'en-tete toujours sombre. */
function classeOnglet({ isActive }: { isActive: boolean }) {
  const commun =
    'grid place-items-center min-h-cible border-t-[3px] font-semibold text-sm no-underline ' +
    'bp860:min-h-0 bp860:py-e2 bp860:border-t-0 bp860:border-b-[3px] bp860:hover:text-chrome-texte';
  const etat = isActive
    ? 'text-encre border-t-encre bp860:text-chrome-texte bp860:border-b-accent'
    : 'text-encre-douce border-t-transparent bp860:text-chrome-texte-douce bp860:border-b-transparent';
  return `${commun} ${etat}`;
}

export default function App() {
  const { t } = useTraduction();
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [alerte, setAlerte] = useState<string | null>(null);

  const ONGLETS: [string, string][] = [
    ['/', t.chrome.nav.accueil],
    ['/diagnostic', t.chrome.nav.diagnostic],
    ['/historique', t.chrome.nav.historique],
    ['/carte', t.chrome.nav.carte],
  ];

  useEffect(() => {
    const majEtat = () => setEnLigne(navigator.onLine);
    window.addEventListener('online', majEtat);
    window.addEventListener('offline', majEtat);
    return () => {
      window.removeEventListener('online', majEtat);
      window.removeEventListener('offline', majEtat);
    };
  }, []);

  // Controle d'integrite : le referentiel de classes de l'application doit
  // correspondre exactement a celui livre avec les poids. Une divergence
  // rendrait tous les diagnostics faux sans lever la moindre erreur.
  useEffect(() => {
    verifierReferentiel().catch((e: Error) => setAlerte(e.message));
  }, []);

  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr] bg-papier">
      <header className="flex items-center gap-e5 bg-chrome px-[var(--pad-page)] pb-e3 pt-[max(var(--e3),env(safe-area-inset-top))] text-chrome-texte">
        <div className="mr-auto flex flex-col">
          <span className="font-titre text-lg font-extrabold leading-[1.1] tracking-[-0.03em]">
            {t.chrome.marque}
          </span>
          <span className="hidden bp600:block text-xs text-chrome-texte-douce">
            {t.chrome.sousTitre}
          </span>
        </div>

        {/* La navigation vit DANS l'en-tête. Sur téléphone, le CSS la détache
            en barre basse fixe, à portée de pouce ; sur grand écran elle reste
            en ligne. Un seul élément dans le DOM, donc un seul ordre de
            tabulation au clavier. */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-trait bg-carte pb-[env(safe-area-inset-bottom)] bp860:static bp860:grid-cols-none bp860:flex bp860:gap-e5 bp860:border-t-0 bp860:bg-transparent bp860:pb-0">
          {ONGLETS.map(([chemin, libelle]) => (
            <NavLink key={chemin} to={chemin} end={chemin === '/'} className={classeOnglet}>
              {libelle}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-e2">
          <ThemeToggle />
          <LanguageSelector />
          <span
            className="whitespace-nowrap rounded-sm bg-white/[0.14] px-e2 py-e1 font-donnee text-xs font-bold uppercase tracking-[0.08em] data-[hors=true]:bg-alerte data-[hors=true]:text-encre"
            data-hors={!enLigne}
          >
            {enLigne ? t.chrome.enLigne : t.chrome.horsLigne}
          </span>
        </div>
      </header>

      <main className="flex w-full flex-col gap-e4 px-[var(--pad-page)] pb-[calc(var(--cible)_+_env(safe-area-inset-bottom)_+_var(--e5))] pt-e4 bp860:pb-e7">
        {alerte && (
          <p className="avis avis--erreur">
            <strong>{t.chrome.modeleIncompatible}</strong> {alerte}
          </p>
        )}

        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/historique" element={<Historique />} />
          <Route
            path="/carte"
            element={
              <Suspense fallback={<p>Chargement de la carte…</p>}>
                <Carte />
              </Suspense>
            }
          />
        </Routes>
      </main>

      <Assistant />
    </div>
  );
}
