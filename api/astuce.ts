/**
 * Fonction serverless Vercel : /api/astuce
 *
 * Genere le fait de sensibilisation (« Le saviez-vous ? ») affiche sur la
 * page diagnostic. Meme principe que /api/conseil : la cle GROQ_API_KEY reste
 * cote serveur. Le client choisit une maladie au hasard parmi les trois
 * cultures reconnues (tomate, piment, oignon) et l'envoie ici ; ce fichier ne
 * fait que reformuler cette maladie en un fait court et actionnable.
 *
 * Volontairement un texte COURT (une phrase) : contrairement au conseil de
 * traitement, ce n'est pas consulte a la demande, mais affiche en permanence
 * sur l'ecran de capture.
 */

interface CorpsRequete {
  maladie: string;
  culture?: string;
  agent?: string | null;
}

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

  const { maladie, culture, agent } = corps;
  if (!maladie) {
    res.status(400).json({ erreur: 'Maladie manquante.' });
    return;
  }

  const contexte = [
    `Maladie : ${maladie}`,
    culture ? `Culture : ${culture}` : '',
    agent ? `Agent responsable : ${agent}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systeme =
    "Tu rediges le fait du jour d'une application de diagnostic agricole, pour " +
    "des producteurs de tomate, piment et oignon au Cameroun. Ecris UNE SEULE " +
    "phrase en français simple et direct, à la deuxième personne (« vous ») ou " +
    "impersonnelle, qui enseigne quelque chose de concret et d'actionnable sur " +
    "la maladie donnée (comment elle se propage, un geste qui limite les pertes, " +
    "une erreur fréquente à éviter). Jamais de généralité vague. Pas de symbole " +
    "de mise en forme, pas de guillemets autour de la phrase, pas de préfixe " +
    "comme « Le saviez-vous » (l'application l'ajoute déjà). Une seule phrase, " +
    "40 mots maximum.";

  const utilisateur = `${contexte}\n\nDonne le fait du jour pour cette maladie.`;

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
          model: 'llama-3.3-70b-versatile',
          temperature: 0.6,
          max_tokens: 120,
          messages: [
            { role: 'system', content: systeme },
            { role: 'user', content: utilisateur },
          ],
        }),
      },
    );

    if (!reponse.ok) {
      const detail = await reponse.text();
      res.status(502).json({
        erreur: 'Le service de conseil a refusé la demande.',
        detail: detail.slice(0, 300),
      });
      return;
    }

    const data = await reponse.json();
    const astuce: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!astuce) {
      res.status(502).json({ erreur: 'Réponse vide du service de conseil.' });
      return;
    }

    res.status(200).json({ astuce });
  } catch (e) {
    res.status(500).json({
      erreur: "L'appel au service de conseil a échoué. Réessayez plus tard.",
    });
  }
}
