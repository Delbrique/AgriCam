/**
 * Fonction serverless Vercel (runtime Edge) : /api/assistant
 *
 * Chatbot d'aide, accessible depuis toute l'application via l'icone
 * flottante (voir src/components/Assistant.tsx). Cantonne a la filiere
 * maraichere que couvre AgriCam - tomate, piment, oignon : leur culture,
 * leurs maladies, l'entretien des parcelles - et au fonctionnement de
 * l'application elle-meme, jamais un assistant generaliste. Une question
 * sur la tomate n'a pas besoin d'etre "a propos d'un diagnostic affiche" pour
 * etre legitime : c'est precisement le sujet de l'app. Une salutation simple
 * (bonjour, salut, ca va) merite une reponse chaleureuse avant le recadrage,
 * pas le meme refus poli qu'un sujet vraiment hors cadre. Accepte des images
 * (bascule sur un modele Groq multimodal, utile pour une photo de culture) ;
 * les documents (PDF/DOCX/texte) sont deja convertis en texte cote client
 * (voir src/lib/documents.ts) avant d'arriver ici. Meme principe que
 * /api/conseil et /api/astuce : la cle GROQ_API_KEY reste ici, cote serveur.
 *
 * En streaming (runtime Edge, pas le Node classique des autres fonctions
 * /api) : Groq renvoie la reponse en SSE format OpenAI, ce handler ne
 * retransmet au client que le texte des deltas, en flux brut - voir
 * demanderAssistant() dans src/lib/assistant.ts pour la lecture cote client,
 * qui affiche le texte au fur et a mesure plutot que d'attendre la reponse
 * complete.
 */

export const config = { runtime: 'edge' };

interface Message {
  role: 'user' | 'assistant';
  contenu: string;
  /** Image jointe, en data URL (le cas echeant). Bascule la requete sur un
   * modele Groq capable de vision. */
  image?: string;
}

interface CorpsRequete {
  messages: Message[];
}

/** Modele texte par defaut, et modele bascule des qu'une image est jointe
 * dans la conversation (les deux sont servis par Groq). Chacun est un
 * modele de raisonnement, mais avec un reglage `reasoning_effort` different
 * (voir plus bas) : sans lui, l'un comme l'autre peuvent consommer tout le
 * budget de tokens en reflexion interne et renvoyer un contenu vide. */
const MODELE_TEXTE = 'openai/gpt-oss-120b';
const MODELE_VISION = 'qwen/qwen3.6-27b';

const SYSTEME =
  "Tu es l'assistant integre a AgriCam, une application de diagnostic des " +
  'maladies de la tomate, du piment et de l’oignon, utilisée par des ' +
  'producteurs camerounais.\n\n' +
  'Ton cadre, assez large pour être vraiment utile :\n' +
  '- la culture, l’entretien et les maladies de la tomate, du piment et de ' +
  'l’oignon en général (pas seulement ce qui est affiché à l’écran) ;\n' +
  '- un diagnostic ou une recommandation affichés dans l’application ;\n' +
  '- le fonctionnement de l’application elle-même (comment prendre une ' +
  'photo, ce que montre la carte de chaleur, le seuil de confiance, ' +
  'l’historique, etc.).\n\n' +
  'Une conversation ordinaire (bonjour, ça va, merci, d’accord, au revoir, ' +
  'une blague, comment vous vous sentez) mérite une réponse naturelle et ' +
  'chaleureuse, comme le ferait n’importe quel interlocuteur poli - ne ' +
  'recentrez PAS systématiquement chaque échange vers l’application : ce ' +
  'réflexe est fatigant et donne l’impression de parler à un robot à sens ' +
  'unique. N’ajoutez « n’hésitez pas à me poser vos questions » ou une ' +
  'formule équivalente QUE lorsque cela apporte vraiment quelque chose - ' +
  'jamais après chaque message.\n\n' +
  'Si une question porte sur un sujet vraiment différent (un autre produit, ' +
  'l’actualité, la politique, un devoir de classe sans rapport, etc.), ' +
  'dites-le poliment en une phrase et invitez à recentrer sur le maraîchage ' +
  'ou l’application. En dehors de ce cas précis, restez naturel. ' +
  'Répondez en français simple et direct, à la deuxième personne (« vous »). ' +
  'Soyez concis. Vous pouvez utiliser le Markdown avec mesure (gras pour un ' +
  'mot-clé important, listes à puces pour des étapes ou des gestes) : il est ' +
  'affiché mis en forme, jamais montré tel quel. N’en abusez pas pour autant ' +
  '- une réponse courte n’a souvent besoin d’aucune mise en forme.';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ erreur: 'Méthode non autorisée.' }, { status: 405 });
  }

  const cle = process.env.GROQ_API_KEY;
  if (!cle) {
    return Response.json(
      { erreur: "La clé du service de conseil n'est pas configurée sur le serveur." },
      { status: 500 },
    );
  }

  const corps: CorpsRequete = await req.json().catch(() => ({ messages: [] }));
  const messages = Array.isArray(corps.messages) ? corps.messages : [];
  if (messages.length === 0) {
    return Response.json({ erreur: 'Message manquant.' }, { status: 400 });
  }

  // On borne l'historique envoye a Groq : les derniers echanges suffisent au
  // contexte, et cela limite le cout/latence sur une longue conversation.
  const recents = messages.slice(-12);
  const contientImage = recents.some((m) => !!m.image);

  let reponseGroq: Response;
  try {
    reponseGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: contientImage ? MODELE_VISION : MODELE_TEXTE,
        // Les deux modeles acceptent ce parametre mais pas les memes
        // valeurs : gpt-oss attend low/medium/high, qwen attend none/default.
        reasoning_effort: contientImage ? 'none' : 'low',
        temperature: 0.5,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEME },
          ...recents.map((m) =>
            m.image
              ? {
                  role: m.role,
                  content: [
                    { type: 'text', text: m.contenu },
                    { type: 'image_url', image_url: { url: m.image } },
                  ],
                }
              : { role: m.role, content: m.contenu },
          ),
        ],
      }),
    });
  } catch {
    return Response.json(
      { erreur: "L'appel à l'assistant a échoué. Réessayez plus tard." },
      { status: 500 },
    );
  }

  if (!reponseGroq.ok || !reponseGroq.body) {
    const detail = await reponseGroq.text().catch(() => '');
    return Response.json(
      { erreur: "L'assistant a refusé la demande.", detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  // Reduit le SSE format OpenAI de Groq (lignes "data: {...}", terminees par
  // "data: [DONE]") a un flux texte brut : le client n'a besoin que des
  // deltas de contenu, pas du reste de l'enveloppe JSON par morceau.
  const decodeur = new TextDecoder();
  const encodeur = new TextEncoder();
  const lecteur = reponseGroq.body.getReader();
  let tampon = '';

  const flux = new ReadableStream<Uint8Array>({
    async pull(controleur) {
      const { done, value } = await lecteur.read();
      if (done) {
        controleur.close();
        return;
      }
      tampon += decodeur.decode(value, { stream: true });
      const lignes = tampon.split('\n');
      tampon = lignes.pop() ?? '';
      for (const ligne of lignes) {
        const t = ligne.trim();
        if (!t.startsWith('data:')) continue;
        const donnees = t.slice(5).trim();
        if (donnees === '[DONE]') continue;
        try {
          const json = JSON.parse(donnees);
          const morceau: string | undefined = json?.choices?.[0]?.delta?.content;
          if (morceau) controleur.enqueue(encodeur.encode(morceau));
        } catch {
          // Ligne SSE incomplete (coupee entre deux paquets reseau) : ignoree,
          // elle sera reprise dans un prochain morceau via le tampon.
        }
      }
    },
  });

  return new Response(flux, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
