/**
 * Filet de securite contre les exceptions de rendu.
 *
 * Sans lui, une exception levee n'importe ou dans l'arbre de composants fait
 * planter l'application entiere : ecran blanc, sans message, sans recours.
 * Les erreurs de rendu React ne remontent jamais jusqu'a un try/catch
 * classique - seule une classe implementant getDerivedStateFromError peut
 * les intercepter (pas d'equivalent en hook a ce jour).
 *
 * Place autour de <Routes> (voir App.tsx), pas autour de toute l'app : l'en-
 * tete et la navigation restent fonctionnels meme si une page plante,
 * l'utilisateur peut changer de page sans recharger.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  erreur: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    // Seule trace disponible : aucun service de supervision cote serveur
    // n'est branche a ce jour (voir le README, section limites connues).
    console.error('Erreur non interceptee :', erreur, info.componentStack);
  }

  render() {
    if (this.state.erreur) {
      return (
        <div className="flex flex-col gap-e4 py-e6">
          <p className="avis avis--erreur">
            <strong>Une erreur inattendue est survenue.</strong> Vos
            diagnostics restent en sécurité dans l&apos;historique de
            l&apos;appareil. Essayez de recharger la page.
          </p>
          <button
            className="bouton-principal"
            onClick={() => window.location.reload()}
          >
            Recharger l&apos;application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
