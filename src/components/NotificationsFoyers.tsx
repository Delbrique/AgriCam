/**
 * Cloche de notifications - foyers de propagation.
 *
 * Remplace le bandeau autrefois affiche en permanence en haut de chaque
 * page (voir lib/alerte.ts pour la detection elle-meme) : les alertes
 * vivent maintenant dans un panneau qu'on ouvre volontairement, avec un
 * badge de compte sur la cloche pour signaler qu'il y a quelque chose a
 * voir. Montee une seule fois, dans l'en-tete de App.tsx, donc accessible
 * depuis toutes les pages.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircleQuestionMark, TriangleAlert, X } from 'lucide-react';
import { foyersActuels, type Foyer } from '../lib/alerte';
import { classeParId, nomClasse } from '../lib/classes';
import { ouvrirAssistantAvecQuestion } from '../lib/assistantBus';
import { useTraduction } from '../lib/traduction';

export function NotificationsFoyers() {
  const { t, langue } = useTraduction();
  const [foyers, setFoyers] = useState<Foyer[]>([]);
  const [fermes, setFermes] = useState<Set<string>>(new Set());
  const [ouvert, setOuvert] = useState(false);
  const [sonner, setSonner] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    foyersActuels().then((trouves) => {
      setFoyers(trouves);
      // Un petit signe au chargement, si l'application a deja quelque chose
      // a signaler : plus discret qu'un badge fixe, ca attire l'oeil une
      // fois puis se tait.
      if (trouves.length > 0) setSonner(true);
    });
  }, []);

  // Ferme le panneau sur un clic exterieur ou Echap - comportement attendu
  // d'un menu de notifications, contrairement au panneau de l'assistant qui
  // reste ouvert jusqu'a une fermeture explicite.
  useEffect(() => {
    if (!ouvert) return;

    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function surEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false);
    }

    document.addEventListener('mousedown', surClicExterieur);
    document.addEventListener('keydown', surEchap);
    return () => {
      document.removeEventListener('mousedown', surClicExterieur);
      document.removeEventListener('keydown', surEchap);
    };
  }, [ouvert]);

  const visibles = foyers.filter((f) => !fermes.has(f.classeId));

  function localiser(foyer: Foyer) {
    setOuvert(false);
    // La carte (sa propre page, voir pages/Carte.tsx) lit cet etat de
    // navigation a son montage pour se recentrer sur le foyer, sans avoir
    // besoin d'une reference partagee vers Leaflet.
    navigate('/carte', { state: { foyerACentrer: foyer } });
  }

  function demanderConseil(foyer: Foyer) {
    setOuvert(false);
    const nom = classeParId(foyer.classeId)?.nom ?? foyer.classeId;
    ouvrirAssistantAvecQuestion(
      `Un foyer possible de ${nom} vient d'être détecté (${foyer.points.length} ` +
        `diagnostics regroupés dans un même secteur ces deux dernières semaines). ` +
        `Que dois-je faire immédiatement ?`,
    );
  }

  return (
    <div className="relative" ref={conteneurRef}>
      <button
        type="button"
        className="relative grid min-h-cible min-w-cible place-items-center rounded bg-transparent text-chrome-texte hover:bg-white/10"
        onClick={() => setOuvert((v) => !v)}
        aria-label={
          visibles.length > 0
            ? t.notificationsFoyers.notificationsAvecCompte(visibles.length)
            : t.notificationsFoyers.notifications
        }
        aria-expanded={ouvert}
        onAnimationEnd={() => setSonner(false)}
      >
        <Bell
          className={`h-5 w-5 ${sonner ? 'animate-sonnerie' : ''}`}
          style={{ transformOrigin: 'top center' }}
          aria-hidden="true"
        />
        {visibles.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-atteint px-1 text-[10px] font-bold leading-none text-white">
            {visibles.length}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-e2 flex max-h-[70vh] w-[min(22rem,90vw)] flex-col gap-e2 overflow-y-auto rounded-lg border border-trait bg-carte p-e3 shadow-carte">
          {visibles.length === 0 ? (
            <p className="m-0 p-e2 text-sm text-encre-douce">{t.notificationsFoyers.aucuneAlerte}</p>
          ) : (
            visibles.map((foyer) => {
              const classe = classeParId(foyer.classeId);
              return (
                <div
                  key={foyer.classeId}
                  className="relative flex flex-col gap-e2 rounded-xl border border-atteint bg-atteint-fond p-e3 pr-e6"
                >
                  <button
                    type="button"
                    className="absolute right-e2 top-e2 grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-white/40"
                    onClick={() =>
                      setFermes((prev) => new Set(prev).add(foyer.classeId))
                    }
                    aria-label={t.notificationsFoyers.fermerAlerte}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>

                  <p className="m-0 flex items-center gap-e2 text-sm font-semibold text-encre">
                    <TriangleAlert size={16} aria-hidden="true" />
                    {t.notificationsFoyers.foyerPossible(
                      classe ? nomClasse(classe, langue) : foyer.classeId,
                    )}
                  </p>
                  <p className="m-0 text-xs leading-[1.5] text-encre-douce">
                    {t.notificationsFoyers.diagnosticsGroupes(foyer.points.length)}
                  </p>
                  <div className="flex flex-wrap gap-e2">
                    <button
                      className="bouton-second self-start text-xs"
                      onClick={() => localiser(foyer)}
                    >
                      {t.notificationsFoyers.localiserFoyer}
                    </button>
                    <button
                      className="bouton-second flex items-center gap-e1 self-start text-xs"
                      onClick={() => demanderConseil(foyer)}
                    >
                      <MessageCircleQuestionMark size={14} aria-hidden="true" />
                      {t.notificationsFoyers.demanderAssistant}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
