/**
 * Coque de l'application : en-tete, routes, navigation.
 *
 * Deux pages. Le tableau de bord est devenu l'ecran d'accueil : il fusionne
 * l'ancien historique et l'ancienne carte, pour ne plus disperser le suivi
 * sur trois onglets differents. La navigation reste en bas, a portee de
 * pouce, parce que l'outil s'utilise debout, une main occupee par le fruit.
 */

import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { TableauDeBord } from './pages/TableauDeBord';
import { Diagnostic } from './pages/Diagnostic';
import { Communaute } from './pages/Communaute';
import { verifierReferentiel } from './lib/classes';
import { useTraduction } from './lib/traduction';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSelector } from './components/LanguageSelector';
import { Assistant } from './components/Assistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationsFoyers } from './components/NotificationsFoyers';

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
  const location = useLocation();
  const [alerte, setAlerte] = useState<string | null>(null);

  const ONGLETS: [string, string][] = [
    ['/', t.chrome.nav.tableauDeBord],
    ['/diagnostic', t.chrome.nav.diagnostic],
    ['/communaute', t.chrome.nav.communaute],
  ];

  // Controle d'integrite : le referentiel de classes de l'application doit
  // correspondre exactement a celui livre avec les poids. Une divergence
  // rendrait tous les diagnostics faux sans lever la moindre erreur.
  // verifierReferentiel() reessaie deja 2 fois en cas d'echec reseau (voir
  // classes.ts) ; ce bouton couvre le residu - une connexion vraiment
  // coupee plus longtemps qu'une poignee de secondes.
  function verifier() {
    setAlerte(null);
    verifierReferentiel().catch((e: Error) => setAlerte(e.message));
  }

  useEffect(() => {
    verifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr] bg-papier">
      <header
        className="flex items-center gap-e5 px-[var(--pad-page)] pb-e3 pt-[max(var(--e3),env(safe-area-inset-top))] text-chrome-texte"
        style={{ background: 'linear-gradient(120deg, var(--vert-fonce), var(--vert-moyen))' }}
      >
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
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-trait bg-carte pb-[env(safe-area-inset-bottom)] bp860:static bp860:grid-cols-none bp860:flex bp860:gap-e5 bp860:border-t-0 bp860:bg-transparent bp860:pb-0">
          {ONGLETS.map(([chemin, libelle]) => (
            <NavLink key={chemin} to={chemin} end={chemin === '/'} className={classeOnglet}>
              {libelle}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-e2">
          <NotificationsFoyers />
          <ThemeToggle />
          <LanguageSelector />
        </div>
      </header>

      <main className="flex w-full flex-col gap-e4 px-[var(--pad-page)] pb-[calc(var(--cible)_+_env(safe-area-inset-bottom)_+_var(--e5))] pt-e4 bp860:pb-e7">
        {alerte && (
          <div className="avis avis--erreur">
            <p className="m-0">
              <strong>{t.chrome.modeleIncompatible}</strong> {alerte}
            </p>
            <button className="bouton-second self-start" onClick={verifier}>
              Réessayer
            </button>
          </div>
        )}

        {/* key={pathname} : une erreur de rendu remplace la page par un
            message plutot que de planter l'app, mais un ErrorBoundary ne se
            reinitialise jamais tout seul. Le forcer a se remonter a chaque
            changement de route evite qu'une erreur sur /diagnostic reste
            affichee apres avoir clique sur "Tableau de bord". */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<TableauDeBord />} />
            <Route path="/diagnostic" element={<Diagnostic />} />
            <Route path="/communaute" element={<Communaute />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <Assistant />
    </div>
  );
}
