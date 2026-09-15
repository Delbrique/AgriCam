/**
 * Ecran de connexion, affiche par App.tsx tant qu'aucune session Supabase
 * n'est active - c'est desormais la porte d'entree de toute l'application,
 * pas seulement de la Communaute (voir App.tsx). Une fois connecte, la
 * session persiste normalement (comportement standard de Supabase Auth) :
 * pas de reconnexion a chaque actualisation, seulement apres deconnexion
 * explicite.
 *
 * Mise en page a deux colonnes (panneau de marque + formulaire), repere sur
 * l'ecran de connexion d'un projet voisin (DataScope) - le panneau de
 * gauche se masque sous le point de rupture large, la page reste un simple
 * formulaire centre sur telephone, ou l'essentiel des connexions se fait.
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
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-lg border border-trait shadow-carte lg:grid-cols-[1.1fr_0.9fr]">
        {/* Panneau de marque : masque sous lg, la page reste un simple
            formulaire centre sur telephone - l'essentiel du trafic. */}
        <div
          className="hidden flex-col justify-between gap-e6 p-e6 text-white lg:flex"
          style={{ background: 'linear-gradient(135deg, var(--vert-fonce), var(--vert-moyen))' }}
        >
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
              {t.connexion.eyebrowHero}
            </p>
            <h1 className="m-0 mt-e4 max-w-xs font-titre text-3xl font-bold leading-tight tracking-[-0.02em]">
              {t.connexion.titreHero}
            </h1>
            <p className="m-0 mt-e3 max-w-xs text-sm leading-relaxed text-white/85">
              {t.connexion.texteHero}
            </p>
          </div>
          <div className="grid gap-e3 bp600:grid-cols-2">
            <div className="rounded-lg bg-white/15 p-e4 backdrop-blur">
              <p className="m-0 text-sm font-semibold">{t.connexion.atout1Titre}</p>
              <p className="m-0 mt-e1 text-xs leading-relaxed text-white/80">
                {t.connexion.atout1Texte}
              </p>
            </div>
            <div className="rounded-lg bg-white/15 p-e4 backdrop-blur">
              <p className="m-0 text-sm font-semibold">{t.connexion.atout2Titre}</p>
              <p className="m-0 mt-e1 text-xs leading-relaxed text-white/80">
                {t.connexion.atout2Texte}
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col gap-e4 bg-carte p-e6">
          <div className="flex items-center gap-e2">
            <img src="/images/agricam-icone.png" alt="" className="h-10 w-10 shrink-0" aria-hidden="true" />
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-encre-douce">
                {t.connexion.eyebrowFormulaire}
              </p>
              <h2 className="m-0 font-titre text-xl font-bold tracking-[-0.02em] text-encre">
                {t.chrome.marque}
              </h2>
            </div>
          </div>

          <p className="m-0 text-sm text-encre-douce">
            {inscription ? t.connexion.texteHero : t.communaute.intro}
          </p>

          <form className="flex flex-col gap-e3" onSubmit={soumettre}>
            {inscription && (
              <label className="flex flex-col gap-1 text-sm text-encre">
                {t.communaute.pseudoLabel}
                <input
                  className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre shadow-sm outline-none transition-colors focus:border-accent"
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
                className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre shadow-sm outline-none transition-colors focus:border-accent"
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
                className="min-h-cible rounded-xl border border-trait bg-papier px-e3 text-sm text-encre shadow-sm outline-none transition-colors focus:border-accent"
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

          <p className="m-0 mt-auto border-t border-trait pt-e3 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-encre-douce">
            {t.connexion.piedDePage}
          </p>
        </div>
      </div>
    </div>
  );
}
