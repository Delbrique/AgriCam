/**
 * Assistant conversationnel flottant.
 *
 * Icone deplacable n'importe ou sur l'ecran (glisser-deposer, souris et
 * tactile, via les Pointer Events) : un clic sans deplacement ouvre le
 * panneau de discussion, un glisser la repositionne. Aide le producteur a
 * comprendre un diagnostic, une recommandation ou le fonctionnement de
 * l'application (voir api/assistant.ts pour le cadrage exact) via Groq
 * (voir lib/assistant.ts), capable de lire une image jointe (modele vision -
 * utile pour une photo de culture) ou un document (PDF, DOCX, texte :
 * converti en texte cote client, voir lib/documents.ts). Monte une seule
 * fois, au niveau de App.tsx, pour rester accessible sur toutes les pages.
 *
 * Necessite une connexion : hors ligne, l'icone reste visible mais le
 * panneau le signale clairement plutot que d'echouer en silence.
 */

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { FileText, Maximize2, MessageCircle, Minimize2, Paperclip, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { demanderAssistant, type MessageChat } from '../lib/assistant';

/** Mise en forme des reponses de l'assistant (voir le systeme de prompt
 * dans api/assistant.ts, qui autorise desormais un Markdown mesure) - les
 * messages de l'utilisateur restent du texte brut, lui n'ecrit jamais de
 * Markdown volontairement. */
const COMPOSANTS_MARKDOWN = {
  a: (props: ComponentProps<'a'>) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="text-vert-moyen underline hover:text-vert-fonce"
    />
  ),
  p: (props: ComponentProps<'p'>) => <p {...props} className="m-0 mt-e2 first:mt-0" />,
  ul: (props: ComponentProps<'ul'>) => (
    <ul {...props} className="m-0 mt-e2 flex list-disc flex-col gap-1 pl-[1.15rem] first:mt-0" />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol {...props} className="m-0 mt-e2 flex list-decimal flex-col gap-1 pl-[1.15rem] first:mt-0" />
  ),
  strong: (props: ComponentProps<'strong'>) => <strong {...props} className="font-semibold" />,
  code: (props: ComponentProps<'code'>) => (
    <code
      {...props}
      className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
    />
  ),
  pre: (props: ComponentProps<'pre'>) => (
    <pre
      {...props}
      className="overflow-x-auto rounded bg-black/5 p-e2 font-mono text-[0.85em] dark:bg-white/10"
    />
  ),
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote {...props} className="border-l-2 border-vert-clair pl-e3 italic text-encre-douce" />
  ),
  table: (props: ComponentProps<'table'>) => (
    <div className="overflow-x-auto">
      <table {...props} className="w-full border-collapse text-xs" />
    </div>
  ),
  thead: (props: ComponentProps<'thead'>) => <thead {...props} className="bg-vert-moyen text-white" />,
  tr: (props: ComponentProps<'tr'>) => (
    <tr {...props} className="border-b border-trait even:bg-vert-soft/40" />
  ),
  th: (props: ComponentProps<'th'>) => <th {...props} className="px-e2 py-1 text-left font-semibold" />,
  td: (props: ComponentProps<'td'>) => <td {...props} className="px-e2 py-1" />,
};

const TAILLE_BOUTON = 56;
const MARGE = 16;
/** Degage la barre de navigation basse sur telephone. */
const MARGE_BAS_INITIALE = 96;
/** Au-dela de ce deplacement (px), un pointerdown/up devient un glisser, pas
 * un clic - assez petit pour rester reactif, assez grand pour absorber le
 * tremblement naturel d'un doigt ou d'une souris. */
const SEUIL_GLISSER = 6;

type PieceJointe =
  | { type: 'image'; nom: string; dataUrl: string }
  | { type: 'document'; nom: string; texte: string };

function positionInitiale() {
  return {
    x: window.innerWidth - TAILLE_BOUTON - MARGE,
    y: window.innerHeight - TAILLE_BOUTON - MARGE - MARGE_BAS_INITIALE,
  };
}

export function Assistant() {
  const [position, setPosition] = useState(positionInitiale);
  const [ouvert, setOuvert] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [piece, setPiece] = useState<PieceJointe | null>(null);
  const [lecturePiece, setLecturePiece] = useState(false);

  const glisse = useRef(false);
  const depart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const finListe = useRef<HTMLDivElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finListe.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, enCours]);

  // Garde l'icone dans l'ecran si la fenetre est redimensionnee ou pivotee.
  useEffect(() => {
    function surRedimensionnement() {
      setPosition((p) => ({
        x: Math.min(p.x, window.innerWidth - TAILLE_BOUTON - MARGE),
        y: Math.min(p.y, window.innerHeight - TAILLE_BOUTON - MARGE),
      }));
    }
    window.addEventListener('resize', surRedimensionnement);
    return () => window.removeEventListener('resize', surRedimensionnement);
  }, []);

  function surPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    glisse.current = false;
    depart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  }

  function surPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.buttons === 0) return;
    const dx = e.clientX - depart.current.x;
    const dy = e.clientY - depart.current.y;
    if (!glisse.current && Math.hypot(dx, dy) < SEUIL_GLISSER) return;
    glisse.current = true;

    setPosition({
      x: clamp(depart.current.posX + dx, MARGE, window.innerWidth - TAILLE_BOUTON - MARGE),
      y: clamp(depart.current.posY + dy, MARGE, window.innerHeight - TAILLE_BOUTON - MARGE),
    });
  }

  function surPointerUp() {
    if (!glisse.current) setOuvert((v) => !v);
    glisse.current = false;
  }

  async function surFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;

    setErreur(null);

    if (fichier.type.startsWith('image/')) {
      try {
        const dataUrl = await lireCommeDataUrl(fichier);
        setPiece({ type: 'image', nom: fichier.name, dataUrl });
      } catch {
        setErreur("Cette image n'a pas pu être lue.");
      }
      return;
    }

    setLecturePiece(true);
    try {
      const { extraireTexte } = await import('../lib/documents');
      const texte = await extraireTexte(fichier);
      if (!texte) throw new Error('Aucun texte trouvé dans ce document.');
      setPiece({ type: 'document', nom: fichier.name, texte });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Ce document n'a pas pu être lu.");
    } finally {
      setLecturePiece(false);
    }
  }

  async function envoyer() {
    const texte = saisie.trim();
    if ((!texte && !piece) || enCours) return;

    setErreur(null);
    setSaisie('');
    const pieceEnvoyee = piece;
    setPiece(null);

    const message: MessageChat = construireMessage(texte, pieceEnvoyee);
    const historique = [...messages, message];
    setMessages(historique);
    setEnCours(true);

    try {
      const reponse = await demanderAssistant(historique);
      setMessages((m) => [...m, { role: 'assistant', contenu: reponse }]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'assistant n'a pas pu répondre.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <button
        className="fixed z-30 grid h-14 w-14 touch-none place-items-center rounded-full border-0 bg-encre text-papier shadow-carte active:scale-95"
        style={{ left: position.x, top: position.y }}
        onPointerDown={surPointerDown}
        onPointerMove={surPointerMove}
        onPointerUp={surPointerUp}
        aria-label={ouvert ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        aria-expanded={ouvert}
      >
        {ouvert ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {ouvert && (
        <div
          className={
            pleinEcran
              ? 'fixed inset-0 z-30 flex flex-col overflow-hidden bg-carte'
              : 'fixed inset-x-e4 bottom-[calc(var(--cible)+env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto flex max-h-[70vh] w-auto max-w-[380px] flex-col overflow-hidden rounded-lg border border-trait bg-carte shadow-carte bp600:inset-x-auto bp600:right-e5'
          }
        >
          <div
            className="flex items-center justify-between gap-e3 bg-encre px-e4 py-e3"
            style={pleinEcran ? { paddingTop: 'max(var(--e3), env(safe-area-inset-top))' } : undefined}
          >
            <span className="font-titre text-md font-bold text-papier">Assistant AgriCam</span>
            <div className="flex items-center gap-e2">
              <button
                className="grid h-8 w-8 place-items-center rounded-full border-0 bg-transparent text-papier hover:bg-white/10"
                onClick={() => setPleinEcran((v) => !v)}
                aria-label={pleinEcran ? 'Réduire l’assistant' : 'Agrandir l’assistant'}
                aria-pressed={pleinEcran}
              >
                {pleinEcran ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-full border-0 bg-transparent text-papier hover:bg-white/10"
                onClick={() => setOuvert(false)}
                aria-label="Fermer l'assistant"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-e4">
            {messages.length === 0 && (
              <p className="m-0 text-sm text-encre-douce">
                Une maladie, un diagnostic ou une recommandation que vous ne
                comprenez pas&nbsp;? Vous pouvez aussi joindre une photo de votre
                culture ou un document à faire lire.
              </p>
            )}

            <div className="flex flex-col gap-e3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.image && (
                    <img
                      src={m.image}
                      alt="Image jointe"
                      className="max-h-32 max-w-[70%] rounded-lg border border-trait object-cover"
                    />
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-e3 py-e2 text-sm leading-[1.45] ${
                      m.role === 'user'
                        ? 'rounded-br-sm bg-vert-fonce text-white'
                        : 'rounded-bl-sm border border-trait bg-carte text-encre'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <p className="m-0 whitespace-pre-wrap">{m.resume ?? m.contenu}</p>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPOSANTS_MARKDOWN}>
                        {m.resume ?? m.contenu}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
              {enCours && (
                <p className="m-0 self-start text-sm text-encre-douce">
                  L&apos;assistant réfléchit…
                </p>
              )}
            </div>
            <div ref={finListe} />
          </div>

          {erreur && <p className="avis avis--erreur m-e3 mt-0">{erreur}</p>}

          {!navigator.onLine && (
            <p className="m-e3 mt-0 text-xs text-encre-douce">
              Une connexion est nécessaire pour parler à l&apos;assistant.
            </p>
          )}

          {piece && (
            <div className="flex items-center gap-e2 border-t border-trait px-e3 py-e2 text-xs text-encre-douce">
              {piece.type === 'image' ? (
                <img src={piece.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <FileText size={16} className="shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{piece.nom}</span>
              <button
                type="button"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-trait"
                onClick={() => setPiece(null)}
                aria-label="Retirer la pièce jointe"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {lecturePiece && (
            <p className="m-0 border-t border-trait px-e3 py-e2 text-xs text-encre-douce">
              Lecture du document…
            </p>
          )}

          <form
            className="flex items-center gap-e2 border-t border-trait p-e3"
            onSubmit={(e) => {
              e.preventDefault();
              envoyer();
            }}
          >
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded border border-trait bg-transparent text-encre hover:bg-trait/30"
              onClick={() => fichierRef.current?.click()}
              disabled={lecturePiece}
              aria-label="Joindre un fichier"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fichierRef}
              type="file"
              accept="image/*,.pdf,.docx,.txt"
              onChange={surFichier}
              hidden
            />
            <input
              className="min-h-[40px] flex-1 rounded border border-trait bg-papier px-e3 text-sm text-encre"
              placeholder="Votre question…"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              disabled={enCours}
            />
            <button
              type="submit"
              className="grid h-10 w-10 shrink-0 place-items-center rounded border-0 bg-encre text-papier disabled:bg-encre-douce"
              disabled={enCours || (!saisie.trim() && !piece)}
              aria-label="Envoyer"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function construireMessage(texte: string, piece: PieceJointe | null): MessageChat {
  if (piece?.type === 'image') {
    return {
      role: 'user',
      contenu: texte || 'Que peux-tu me dire sur cette image ?',
      image: piece.dataUrl,
    };
  }

  if (piece?.type === 'document') {
    const contenuDocument = `Voici le contenu du document « ${piece.nom} » :\n\n${piece.texte}`;
    return {
      role: 'user',
      contenu: texte ? `${texte}\n\n${contenuDocument}` : contenuDocument,
      resume: texte ? `${texte}\n\n📄 ${piece.nom}` : `📄 ${piece.nom}`,
    };
  }

  return { role: 'user', contenu: texte };
}

function lireCommeDataUrl(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result as string);
    lecteur.onerror = () => rejeter(new Error('Image illisible.'));
    lecteur.readAsDataURL(fichier);
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
