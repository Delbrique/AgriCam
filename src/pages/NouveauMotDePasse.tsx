/**
 * Ecran de choix d'un nouveau mot de passe, affiche par App.tsx quand le
 * producteur arrive depuis le lien de l'e-mail "mot de passe oublie" (voir
 * Connexion.tsx). Supabase l'a deja connecte via ce lien - une session de
 * recuperation - ce qui autorise updateUser() sans l'ancien mot de passe.
 * Tant que ce formulaire n'est pas valide, App.tsx n'ouvre pas le reste de
 * l'application : sans quoi le lien servirait de connexion sans jamais
 * changer le mot de passe oublie.
 */
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useTraduction } from '../lib/traduction';
import { traduireErreurAuth } from '../lib/erreursAuth';

export function NouveauMotDePasse({
  email,
  onTermine,
  onAnnuler,
}: {
  email: string;
  onTermine: () => void;
  /** Absent en recuperation (ecran impose), present quand le producteur a
   * ouvert l'ecran lui-meme depuis l'en-tete. */
  onAnnuler?: () => void;
}) {
  const { t } = useTraduction();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse !== confirmation) {
      setErreur(t.connexion.motsDePasseDifferents);
      return;
    }
    setEnCours(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      onTermine();
    } catch (err) {
      setErreur(traduireErreurAuth(err, t));
    } finally {
      setEnCours(false);
    }
  }

  const classeChamp =
    'min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre shadow-sm outline-none transition-colors focus:border-accent';

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-papier px-[var(--pad-page)] py-e6">
      <div className="flex w-full max-w-[420px] flex-col gap-e4 rounded-lg border border-trait bg-carte p-e6 shadow-carte">
        <div className="flex items-center gap-e2">
          <img src="/images/agricam-icone.png" alt="" className="h-10 w-10 shrink-0" aria-hidden="true" />
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-encre-douce">
              {t.chrome.marque}
            </p>
            <h2 className="m-0 font-titre text-xl font-bold tracking-[-0.02em] text-encre">
              {t.connexion.titreNouveauMotDePasse}
            </h2>
          </div>
        </div>

        <p className="m-0 text-sm text-encre-douce">{t.connexion.texteNouveauMotDePasse}</p>

        <form className="flex flex-col gap-e3" onSubmit={soumettre}>
          {/* Champ cache portant l'e-mail du compte : sans lui, le
              gestionnaire de mots de passe du navigateur enregistre le
              nouveau mot de passe sans identifiant (ou avec un mauvais). */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          <label className="flex flex-col gap-1 text-sm text-encre">
            {t.connexion.nouveauMotDePasseLabel}
            <input
              type="password"
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              className={classeChamp}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-encre">
            {t.connexion.confirmationLabel}
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={classeChamp}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>

          {erreur && <p className="avis avis--erreur">{erreur}</p>}

          <button type="submit" className="bouton-principal min-h-cible" disabled={enCours}>
            {enCours ? t.communaute.unInstant : t.connexion.enregistrerMotDePasse}
          </button>
          {onAnnuler && (
            <button type="button" className="bouton-second min-h-cible" onClick={onAnnuler} disabled={enCours}>
              {t.connexion.annuler}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
