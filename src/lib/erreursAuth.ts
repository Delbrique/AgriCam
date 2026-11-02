/**
 * Traduction des erreurs Supabase Auth. Le serveur renvoie ses messages en
 * anglais ("Invalid login credentials"...) : on reconnait les cas courants
 * par leur code (plus stable que le texte), sinon par le message, et on
 * retombe sur le message brut pour tout le reste plutot que de le masquer.
 */
import type { Traductions } from './traduction';

export function traduireErreurAuth(err: unknown, t: Traductions): string {
  if (!(err instanceof Error)) return t.communaute.erreurGenerique;
  const code = (err as Error & { code?: string }).code;
  const message = err.message.toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return t.connexion.erreurIdentifiants;
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return t.connexion.erreurEmailNonConfirme;
  }
  if (code === 'same_password' || message.includes('different from the old password')) {
    return t.connexion.erreurMemeMotDePasse;
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return t.connexion.erreurTropDeDemandes;
  }
  if (code === 'user_already_exists' || message.includes('already registered')) {
    return t.connexion.erreurDejaInscrit;
  }
  return err.message;
}
