/**
 * Ecran de connexion, affiche par App.tsx tant qu'aucune session Supabase
 * n'est active - c'est desormais la porte d'entree de toute l'application,
 * pas seulement de la Communaute (voir App.tsx). Une fois connecte, la
 * session persiste normalement (comportement standard de Supabase Auth) :
 * pas de reconnexion a chaque actualisation, seulement apres deconnexion
 * explicite.
 */
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useTraduction } from '../lib/traduction';

/** Liste blanche stricte : seuls ces fournisseurs grand public sont
 * acceptes a l'inscription, a l'exclusion de tout autre domaine (y compris
 * des domaines "reels" mais peu connus ou de complaisance, type
 * "toto@toto.com") - un choix delibere, pas une verification technique de
 * deliverabilite. */
const FOURNISSEURS_AUTORISES = ['gmail.com', 'yahoo.com', 'outlook.com'];

function fournisseurAutorise(email: string): boolean {
  const domaine = email.split('@')[1]?.trim().toLowerCase();
  return !!domaine && FOURNISSEURS_AUTORISES.includes(domaine);
}

export function Connexion() {
  const { t } = useTraduction();
  const [inscription, setInscription] = useState(false);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      if (inscription) {
        // Un <input type="email"> ne verifie que la SYNTAXE ("toto@toto.com"
        // la passe sans probleme, et un controle DNS generique aussi puisque
        // "toto.com" est un vrai domaine enregistre) - seuls les fournisseurs
        // grand public explicitement autorises passent, voir
        // FOURNISSEURS_AUTORISES ci-dessus.
        if (!fournisseurAutorise(email)) {
          throw new Error(t.communaute.emailInvalide);
        }

        const { data, error } = await supabase!.auth.signUp({
          email,
          password: motDePasse,
          options: { data: { pseudo: pseudo.trim() || t.communaute.producteur } },
        });
        if (error) throw error;
        // Si le projet Supabase exige la confirmation par e-mail, `session`
        // est nulle ici : il faut prevenir le producteur plutot que le
        // laisser croire que l'inscription l'a connecte. Si la confirmation
        // n'est PAS exigee, Supabase renvoie deja une session active - le
        // changement d'etat remonte tout seul jusqu'a App.tsx (via
        // onAuthStateChange) qui bascule alors sur l'application sans qu'on
        // ait besoin de le faire ici.
        if (!data.session) setInfo(t.communaute.compteCree);
      } else {
        const { error } = await supabase!.auth.signInWithPassword({ email, password: motDePasse });
        if (error) throw error;
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t.communaute.erreurGenerique);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-papier px-[var(--pad-page)] py-e6">
      <div className="carte flex w-full max-w-sm flex-col gap-e4 p-e5">
        <div className="flex flex-col items-center gap-e2 text-center">
          <img src="/images/agricam-icone.png" alt="" className="h-14 w-14" aria-hidden="true" />
          <h1 className="m-0 font-titre text-lg font-bold text-encre">
            {inscription ? t.communaute.rejoindre : t.communaute.seConnecter}
          </h1>
          <p className="m-0 text-sm text-encre-douce">{t.communaute.intro}</p>
        </div>

        <form className="flex flex-col gap-e3" onSubmit={soumettre}>
          {inscription && (
            <label className="flex flex-col gap-1 text-sm text-encre">
              {t.communaute.pseudoLabel}
              <input
                className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder={t.communaute.pseudoPlaceholder}
                maxLength={40}
                autoFocus
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-encre">
            {t.communaute.emailLabel}
            <input
              type="email"
              required
              className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={!inscription}
            />
            {inscription && (
              <span className="text-xs font-normal text-encre-douce">
                {t.communaute.fournisseursAcceptes}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm text-encre">
            {t.communaute.motDePasseLabel}
            <input
              type="password"
              required
              minLength={6}
              className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </label>

          {erreur && <p className="avis avis--erreur">{erreur}</p>}
          {info && <p className="avis avis--merci">{info}</p>}

          <button type="submit" className="bouton-principal min-h-cible" disabled={enCours}>
            {enCours
              ? t.communaute.unInstant
              : inscription
                ? t.communaute.creerMonCompte
                : t.communaute.seConnecter}
          </button>
        </form>

        <button
          type="button"
          className="bouton-second min-h-cible"
          onClick={() => {
            setInscription((v) => !v);
            setErreur(null);
            setInfo(null);
          }}
        >
          {inscription ? t.communaute.dejaCompte : t.communaute.creerCompte}
        </button>
      </div>
    </div>
  );
}
