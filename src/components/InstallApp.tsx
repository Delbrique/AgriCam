/**
 * Invite a installer l'application sur l'ecran d'accueil.
 *
 * Pourquoi c'est necessaire : un simple lien ouvert dans un onglet ne
 * garantit ni l'icone sur l'ecran d'accueil, ni la meme resilience de
 * stockage qu'une PWA installee. Sans ce bouton, l'utilisateur ne voit qu'une
 * petite icone discrete dans la barre d'adresse - beaucoup ne la remarquent
 * jamais.
 *
 * Rappel valable quelle que soit la methode d'installation : le tout premier
 * chargement DOIT se faire avec une connexion, le temps que le service
 * worker mette en cache les modeles (~35 Mo). Une fois installee, l'app
 * fonctionne ensuite entierement hors ligne.
 *
 * Seuls Chrome/Edge/Android exposent l'evenement "beforeinstallprompt", qu'on
 * declenche depuis ce bouton. iOS Safari ne le supporte pas du tout (aucun
 * site ne peut y declencher l'installation par lui-meme) : le composant reste
 * invisible sur iOS plutot que d'afficher une marche a suivre qui s'est
 * averee peu fiable en pratique - l'ecran de chargement hors ligne d'un
 * webapp iOS installe reste, de toute facon, une limite de la plateforme
 * (stockage isole entre Safari et l'icone sur l'ecran d'accueil), pas
 * quelque chose que ce bouton peut garantir.
 */

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function dejaInstallee(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriete non standard, mais c'est la seule detection fiable sur iOS.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallApp() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [installee, setInstallee] = useState(false);

  useEffect(() => {
    if (dejaInstallee()) {
      setInstallee(true);
      return;
    }

    function surPropose(e: Event) {
      e.preventDefault();
      setEvenement(e as EvenementInstallation);
    }
    window.addEventListener('beforeinstallprompt', surPropose);

    function surInstallee() {
      setInstallee(true);
      setEvenement(null);
    }
    window.addEventListener('appinstalled', surInstallee);

    return () => {
      window.removeEventListener('beforeinstallprompt', surPropose);
      window.removeEventListener('appinstalled', surInstallee);
    };
  }, []);

  if (installee || !evenement) return null;

  async function installer() {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === 'accepted') setInstallee(true);
    setEvenement(null);
  }

  return (
    <div className="flex flex-col gap-e2 rounded-lg border border-trait bg-carte p-e4 shadow-carte">
      <p className="m-0 text-sm text-encre-douce">
        Installez AgriCam sur votre écran d&apos;accueil : l&apos;application
        s&apos;ouvre alors comme les autres, et le mode hors ligne est bien
        plus fiable qu&apos;un simple lien.
      </p>

      <button
        className="bouton-principal flex items-center justify-center gap-e2"
        onClick={installer}
      >
        <Download size={18} />
        Installer l&apos;application
      </button>
    </div>
  );
}
