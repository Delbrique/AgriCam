/**
 * Client Supabase (chat communautaire + comptes) - la SEULE fonctionnalite
 * d'AgriCam qui a besoin d'un serveur partage. Tout le reste (diagnostic,
 * historique, carte, parcelles) reste 100% local par conception (voir
 * lib/stockage.ts) : ce client ne sert qu'a ce qui exige reellement des
 * donnees partagees entre producteurs.
 *
 * Necessite VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (variables Vercel,
 * prefixees VITE_ pour etre exposees au navigateur - la cle "anon" est
 * publique par conception chez Supabase, protegee par les policies RLS
 * cote base ; la cle service_role, elle, ne doit jamais quitter le
 * backend, voir api/py/index.py). Tant qu'elles ne sont pas configurees,
 * `supabase` vaut `null` et les fonctionnalites qui en dependent se
 * masquent proprement plutot que de planter l'application.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLE_ANON_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Vrai si la page s'ouvre depuis le lien de l'e-mail "mot de passe oublie"
 * (#...&type=recovery). Lu AVANT createClient : le client consomme puis
 * efface ce fragment de l'URL des son initialisation, et l'evenement
 * PASSWORD_RECOVERY qu'il emet peut partir avant qu'App.tsx soit abonne -
 * ce drapeau sert de filet pour ne jamais rater la page de nouveau mot de
 * passe. */
export const arriveeParLienRecuperation =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

export const supabase: SupabaseClient | null =
  URL_SUPABASE && CLE_ANON_SUPABASE ? createClient(URL_SUPABASE, CLE_ANON_SUPABASE) : null;

export function communauteDisponible(): boolean {
  return supabase !== null;
}
