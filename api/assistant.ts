/**
 * Fonction serverless Vercel : /api/assistant
 *
 * Chatbot d'aide, accessible depuis toute l'application via l'icone
 * flottante (voir src/components/Assistant.tsx). Volontairement CANTONNE a
 * ce que fait AgriCam : les maladies reconnues, les diagnostics/
 * recommandations affiches, et le fonctionnement de l'application - jamais un
 * assistant generaliste. Accepte des images (bascule sur un modele Groq
 * multimodal, utile pour une photo de culture) ; les documents (PDF/DOCX/
 * texte) sont deja convertis en texte cote client (voir src/lib/documents.ts)
 * avant d'arriver ici. Meme principe que /api/conseil et /api/astuce : la cle
 * GROQ_API_KEY reste ici, cote serveur.
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
 * dans la conversation (les deux sont servis par Groq). */
const MODELE_TEXTE = 'llama-3.3-70b-versatile';
const MODELE_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEME =
  "Tu es l'assistant integre a AgriCam, une application de diagnostic des " +
  'maladies de la tomate, du piment et de l’oignon, utilisée par des ' +
  'producteurs camerounais. Tu réponds UNIQUEMENT aux questions sur : les ' +
  'maladies que l’application reconnaît, un diagnostic ou une recommandation ' +
  'affichés à l’écran, et le fonctionnement de l’application elle-même ' +
  '(comment prendre une photo, ce que montre la carte de chaleur, le seuil ' +
  'de confiance, l’historique, etc.). Si une question sort de ce cadre, ' +
  'dis-le poliment en une phrase et invite à recentrer sur l’usage de ' +
  'l’application - ne réponds jamais sur un autre sujet, même brièvement. ' +
  'Réponds en français simple et direct, à la deuxième personne (« vous »). ' +
  'Sois concis. N’utilise aucun symbole de mise en forme (pas d’astérisques, ' +
  'pas de #).';

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
