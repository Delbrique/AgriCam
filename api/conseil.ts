/**
 * Fonction serverless Vercel : /api/conseil
 *
 * Elle sert d'intermediaire entre l'application (navigateur) et l'API Groq.
 * La cle GROQ_API_KEY reste ICI, cote serveur, dans les variables
 * d'environnement Vercel : elle n'est jamais envoyee au navigateur, donc
 * jamais exposee publiquement.
 *
 *   App  ->  /api/conseil (cette fonction, garde la cle)  ->  Groq  ->  retour
 *
 * C'est le NIVEAU 2 du conseil : detaille, en ligne. Le niveau 1 (conduite en
 * dur, hors-ligne) reste affiche en toutes circonstances dans l'application.
 */

interface CorpsRequete {
  maladie: string;
  culture?: string;
  agent?: string | null;
  gravite?: string;
  confiance?: number;
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

  // Le corps peut arriver deja parse (Vercel) ou en chaine, selon le runtime.
  const corps: CorpsRequete =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};

  const { maladie, culture, agent, gravite, confiance } = corps;
  if (!maladie) {
    res.status(400).json({ erreur: 'Diagnostic manquant.' });
    return;
  }

  const contexte = [
    `Maladie diagnostiqu\u00e9e : ${maladie}`,
    culture ? `Culture : ${culture}` : '',
    agent ? `Agent responsable : ${agent}` : '',
    gravite ? `Gravit\u00e9 : ${gravite}` : '',
    typeof confiance === 'number' ? `Confiance du mod\u00e8le : ${confiance} %` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systeme =
    "Tu es un conseiller agricole qui s'adresse DIRECTEMENT \u00e0 un producteur " +
    "mara\u00eecher au Cameroun (tomate, piment, oignon). Ton lecteur cultive lui-m\u00eame " +
    "ses parcelles ; il n'est pas ing\u00e9nieur. \u00c9cris dans un fran\u00e7ais simple, clair " +
    'et direct, \u00e0 la deuxi\u00e8me personne (\u00ab vous \u00bb). Donne des gestes concrets, ' +
    "r\u00e9alisables avec des moyens locaux et peu co\u00fbteux. Quand tu emploies un terme " +
    "technique (nom d'un champignon, d'une mati\u00e8re active), explique-le en quelques " +
    "mots entre parenth\u00e8ses. Reste factuel : ne promets pas de gu\u00e9rison miracle, et " +
    "rappelle d'aller voir un technicien agricole quand la situation le d\u00e9passe. " +
    "N'utilise AUCUN symbole de mise en forme (pas d'ast\u00e9risques, pas de #). " +
    'Structure ta r\u00e9ponse EXACTEMENT avec ces cinq titres en MAJUSCULES, chacun ' +
    'sur sa propre ligne, suivi de lignes commen\u00e7ant par un tiret :\n' +
    'CE QUI ARRIVE À VOTRE CULTURE\n' +
    'À FAIRE MAINTENANT\n' +
    'À NE PAS FAIRE\n' +
    'ÉVITER QUE CELA REVIENNE\n' +
    'QUAND APPELER UN TECHNICIEN';

  const utilisateur =
    `Voici le diagnostic pos\u00e9 sur une photo de la parcelle :\n\n${contexte}\n\n` +
    "R\u00e9dige un conseil de traitement complet et tr\u00e8s explicite pour ce producteur, " +
    'en respectant scrupuleusement la structure demand\u00e9e.';

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
          temperature: 0.4,
          max_tokens: 1100,
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
    const conseil: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!conseil) {
      res.status(502).json({ erreur: 'Réponse vide du service de conseil.' });
      return;
    }

    res.status(200).json({ conseil });
  } catch (e) {
    res.status(500).json({
      erreur: "L'appel au service de conseil a échoué. Réessayez plus tard.",
    });
  }
}