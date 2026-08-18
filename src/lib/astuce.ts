/**
 * Astuce de sensibilisation affichee sur la page diagnostic.
 *
 * En ligne, elle est generee par Groq (voir api/astuce.ts) pour une maladie
 * tiree au hasard parmi les trois cultures reconnues - jamais toujours la
 * meme. Hors ligne, ou si l'appel echoue, on retombe sur les astuces ecrites
 * en dur dans data/sensibilisation.ts : l'ecran de capture ne doit jamais
 * rester sans rien a montrer.
 */

import { CLASSES } from './classes';
import { astuceAleatoire } from '../data/sensibilisation';

const MALADIES = CLASSES.filter((c) => c.gravite !== 'sain');

/** Astuce locale, disponible immediatement (hors ligne ou en attendant Groq). */
export function astuceHorsLigne(): string {
  return astuceAleatoire();
}

/** Astuce Groq, sur une maladie choisie au hasard. Null si indisponible. */
export async function astuceEnLigne(): Promise<string | null> {
  if (!navigator.onLine) return null;

  const classe = MALADIES[Math.floor(Math.random() * MALADIES.length)];

  try {
    const reponse = await fetch('/api/astuce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maladie: classe.nom,
        culture: classe.culture,
        agent: classe.agent ?? null,
      }),
    });
    if (!reponse.ok) return null;

    const data = await reponse.json();
    const astuce = typeof data.astuce === 'string' ? data.astuce.trim() : '';
    return astuce || null;
  } catch {
    return null;
  }
}
