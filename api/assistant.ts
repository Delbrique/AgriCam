/**
 * Fonction serverless Vercel : /api/assistant
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
 */

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
  'Une salutation simple (bonjour, salut, yo, ça va ?) mérite une réponse ' +
  'chaleureuse et brève, pas un refus - répondez-y naturellement, puis ' +
  'proposez votre aide.\n\n' +
  'Si une question sort clairement de ce cadre (un sujet sans rapport avec ' +
  'le maraîchage ou l’application), dites-le poliment en une phrase et ' +
  'invitez à recentrer - ne répondez jamais sur un sujet entièrement ' +
  'étranger à l’agriculture ou à l’application. ' +
  'Répondez en français simple et direct, à la deuxième personne (« vous »). ' +
  'Soyez concis. N’utilisez aucun symbole de mise en forme (pas ' +
  'd’astérisques, pas de #).';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'Méthode non autorisée.' });
    return;
  }

  const cle = process.env.GROQ_API_KEY;
  if (!cle) {
    res.status(500).json({
      erreur: "La clé du service de conseil n'est pas configurée sur le serveur.",
    });
    return;
  }

  const corps: CorpsRequete =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};

  const messages = Array.isArray(corps.messages) ? corps.messages : [];
  if (messages.length === 0) {
    res.status(400).json({ erreur: 'Message manquant.' });
    return;
  }

  // On borne l'historique envoye a Groq : les derniers echanges suffisent au
  // contexte, et cela limite le cout/latence sur une longue conversation.
  const recents = messages.slice(-12);
  const contientImage = recents.some((m) => !!m.image);

  try {
    const reponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
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
      },
    );

    if (!reponse.ok) {
      const detail = await reponse.text();
      res.status(502).json({
        erreur: "L'assistant a refusé la demande.",
        detail: detail.slice(0, 300),
      });
      return;
    }

    const data = await reponse.json();
    const contenu: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!contenu) {
      res.status(502).json({ erreur: "Réponse vide de l'assistant." });
      return;
    }

    res.status(200).json({ contenu });
  } catch (e) {
    res.status(500).json({
      erreur: "L'appel à l'assistant a échoué. Réessayez plus tard.",
    });
  }
}
