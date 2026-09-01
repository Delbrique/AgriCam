/**
 * Communaute : discussion en direct entre producteurs.
 *
 * Seule partie d'AgriCam qui a besoin d'un compte et d'un serveur partage
 * (Supabase Auth + Postgres + Realtime, voir lib/supabase.ts) - le reste de
 * l'application (diagnostic, historique, carte, parcelles) reste local par
 * conception (voir lib/stockage.ts). Les messages sont ecrits via le backend
 * FastAPI (api/py/index.py, cle service_role) qui verifie le jeton Supabase
 * envoye en en-tete plutot que de laisser le client ecrire directement dans
 * la base ; la reception en direct, elle, passe par un abonnement Realtime
 * cote client (lecture seule, deja ouverte par les policies RLS).
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, Send } from 'lucide-react';
import { communauteDisponible, supabase } from '../lib/supabase';
import { Squelette } from '../components/Squelette';
import { useTraduction } from '../lib/traduction';

interface Message {
  id: string;
  salon: string;
  user_id: string;
  pseudo: string;
  contenu: string;
  created_at: string;
}

const SALON = 'general';

export function Communaute() {
  const { t } = useTraduction();
  if (!communauteDisponible()) {
    return (
      <div className="avis avis--incertain">
        <p>{t.communaute.indisponible}</p>
      </div>
    );
  }
  return <CommunauteConnectee />;
}

function CommunauteConnectee() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: abonnement } = supabase!.auth.onAuthStateChange((_evenement, s) => setSession(s));
    return () => abonnement.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="carte mx-auto flex w-full max-w-sm flex-col gap-e3">
        <Squelette className="h-6 w-2/3" />
        <Squelette className="h-4 w-full" />
        <Squelette className="h-10 w-full" />
      </div>
    );
  }
  if (!session) return <Connexion />;
  return <FenetreChat session={session} />;
}

function Connexion() {
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
        // changement d'etat remonte tout seul jusqu'a CommunauteConnectee
        // (via onAuthStateChange) qui bascule alors sur la fenetre de
        // discussion sans qu'on ait besoin de le faire ici.
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
    <div className="carte mx-auto flex w-full max-w-sm flex-col gap-e4">
      <div>
        <h1 className="m-0 font-titre text-lg font-bold text-encre">
          {inscription ? t.communaute.rejoindre : t.communaute.seConnecter}
        </h1>
        <p className="m-0 mt-1 text-sm text-encre-douce">{t.communaute.intro}</p>
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
          />
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
  );
}

function FenetreChat({ session }: { session: Session }) {
  const { t } = useTraduction();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const finListe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    fetch(`/api/py/chat/messages?salon=${SALON}`)
      .then((r) => r.json())
      .then((d: { messages: Message[] }) => {
        if (!annule) setMessages(d.messages);
      })
      .catch(() => {
        if (!annule) setErreur(t.communaute.erreurChargement);
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    const canal = supabase!
      .channel(`messages:${SALON}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `salon=eq.${SALON}` },
        (charge) => {
          const nouveau = charge.new as Message;
          setMessages((m) => (m ?? []).some((x) => x.id === nouveau.id) ? m : [...(m ?? []), nouveau]);
        },
      )
      .subscribe();
    return () => {
      supabase!.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    finListe.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const contenu = saisie.trim();
    if (!contenu || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch('/api/py/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ salon: SALON, contenu }),
      });
      if (!reponse.ok) {
        const detail = await reponse.json().catch(() => null);
        throw new Error(detail?.detail || t.communaute.erreurEnvoi);
      }
      setSaisie('');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t.communaute.erreurEnvoi);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="carte flex h-[70vh] flex-col p-0">
      <div className="flex items-center justify-between gap-e3 border-b border-trait px-e4 py-e3">
        <span className="text-sm text-encre-douce">
          {t.communaute.salonGeneralPrefixe}{' '}
          <strong className="text-encre">{session.user.user_metadata.pseudo ?? session.user.email}</strong>
        </span>
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-trait/40"
          onClick={() => supabase!.auth.signOut()}
          aria-label={t.communaute.seDeconnecter}
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-e4">
        {messages === null && (
          <div className="flex flex-col gap-e3">
            <Squelette className="h-12 w-2/3 self-start" />
            <Squelette className="h-12 w-1/2 self-end" />
            <Squelette className="h-12 w-3/5 self-start" />
          </div>
        )}
        {messages?.length === 0 && (
          <p className="m-0 text-sm text-encre-douce">{t.communaute.aucunMessage}</p>
        )}

        <div className="flex flex-col gap-e3">
          {messages?.map((m) => {
            const deMoi = m.user_id === session.user.id;
            return (
              <div key={m.id} className={`flex flex-col gap-1 ${deMoi ? 'items-end' : 'items-start'}`}>
                {!deMoi && <span className="px-1 text-xs font-semibold text-encre-douce">{m.pseudo}</span>}
                <div
                  className={`max-w-[85%] rounded-2xl px-e3 py-e2 text-sm leading-[1.45] ${
                    deMoi
                      ? 'rounded-br-sm bg-vert-fonce text-white'
                      : 'rounded-bl-sm border border-trait bg-carte text-encre'
                  }`}
                >
                  <p className="m-0 whitespace-pre-wrap">{m.contenu}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={finListe} />
      </div>

      {erreur && <p className="avis avis--erreur m-e3 mt-0">{erreur}</p>}

      <form className="flex items-center gap-e2 border-t border-trait p-e3" onSubmit={envoyer}>
        <input
          className="min-h-cible flex-1 rounded-xl border border-trait bg-papier px-e3 text-sm text-encre"
          placeholder={t.communaute.placeholderMessage}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          maxLength={500}
          disabled={envoi}
        />
        <button
          type="submit"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-0 bg-vert-fonce text-white disabled:bg-encre-douce"
          disabled={envoi || !saisie.trim()}
          aria-label={t.communaute.envoyer}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
