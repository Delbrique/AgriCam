/**
 * Pont evenementiel minimal pour demander a l'assistant flottant (voir
 * components/Assistant.tsx) d'ouvrir son panneau et de repondre a une
 * question depuis n'importe quel point de l'application (ex. un foyer
 * signale par NotificationsFoyers) - les deux composants sont montes
 * independamment dans App.tsx, un evenement global evite de faire remonter
 * leur etat jusqu'a un ancetre commun pour un besoin aussi ponctuel.
 */
const EVENEMENT = 'agricam:ouvrir-assistant';

export function ouvrirAssistantAvecQuestion(question: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENEMENT, { detail: question }));
}

export function ecouterOuvertureAssistant(gestionnaire: (question: string) => void): () => void {
  function ecouteur(e: Event) {
    gestionnaire((e as CustomEvent<string>).detail);
  }
  window.addEventListener(EVENEMENT, ecouteur);
  return () => window.removeEventListener(EVENEMENT, ecouteur);
}
