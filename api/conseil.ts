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
 *
 * Bilingue (parametre `langue`) : le contenu genere ici est reutilise tel
 * quel dans le PDF telecharge (voir ConduiteATenir.tsx), donc le traduire a
 * la source evite d'avoir un document au corps francais et aux en-tetes
 * anglais.
 */

interface CorpsRequete {
  maladie: string;
  culture?: string;
  agent?: string | null;
  gravite?: string;
  confiance?: number;
  /** Renseignes depuis le tableau de bord (voir PanneauRecommandations.tsx) :
   * nombre de fois que cette maladie a ete diagnostiquee sur la periode, et
   * la fenetre de dates correspondante - permet au conseil de reconnaitre
   * une situation qui se repete plutot que de decrire la maladie dans
   * l'abstrait a chaque fois. */
  occurrences?: number;
  premiereVue?: string;
  derniereVue?: string;
  langue?: 'fr' | 'en';
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

  const {
    maladie,
    culture,
    agent,
    gravite,
    confiance,
    occurrences,
    premiereVue,
    derniereVue,
    langue,
  } = corps;
  if (!maladie) {
    res.status(400).json({ erreur: 'Diagnostic manquant.' });
    return;
  }

  const enAnglais = langue === 'en';

  const recurrence = enAnglais
    ? typeof occurrences === 'number' && occurrences > 1
      ? `Repeated cases: ${occurrences} diagnoses of this disease on this plot` +
        (premiereVue && derniereVue ? ` between ${premiereVue} and ${derniereVue}` : '') +
        '.'
      : ''
    : typeof occurrences === 'number' && occurrences > 1
      ? `Cas répétés : ${occurrences} diagnostics de cette maladie sur cette parcelle` +
        (premiereVue && derniereVue ? ` entre le ${premiereVue} et le ${derniereVue}` : '') +
        '.'
      : '';

  const contexte = enAnglais
    ? [
        `Diagnosed disease: ${maladie}`,
        culture ? `Crop: ${culture}` : '',
        agent ? `Responsible agent: ${agent}` : '',
        gravite ? `Severity: ${gravite}` : '',
        typeof confiance === 'number' ? `Model confidence: ${confiance}%` : '',
        recurrence,
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `Maladie diagnostiquée : ${maladie}`,
        culture ? `Culture : ${culture}` : '',
        agent ? `Agent responsable : ${agent}` : '',
        gravite ? `Gravité : ${gravite}` : '',
        typeof confiance === 'number' ? `Confiance du modèle : ${confiance} %` : '',
        recurrence,
      ]
        .filter(Boolean)
        .join('\n');

  const systeme = enAnglais
    ? "You are an agricultural advisor speaking DIRECTLY to a vegetable grower " +
      "in Cameroon (tomato, pepper, onion). Your reader farms their own plots " +
      "themselves; they are not an engineer. Write in simple, clear, direct " +
      "English, addressed to the grower ('you'). Give concrete steps that are " +
      "achievable with local, low-cost means. When you use a technical term " +
      "(the name of a fungus, an active ingredient), explain it briefly in " +
      "parentheses. Stay factual: never promise a miracle cure, and remind " +
      "the reader to see an agricultural technician when the situation is " +
      "beyond home remedies. Use NO formatting symbols (no asterisks, no #). " +
      "Structure your answer with EXACTLY these five headings in UPPERCASE, " +
      "each on its own line, followed by lines starting with a dash:\n" +
      "WHAT'S HAPPENING TO YOUR CROP\n" +
      "WHAT TO DO NOW\n" +
      "WHAT NOT TO DO\n" +
      "PREVENT IT FROM COMING BACK\n" +
      "WHEN TO CALL A TECHNICIAN"
    : "Tu es un conseiller agricole qui s'adresse DIRECTEMENT à un producteur " +
      "maraîcher au Cameroun (tomate, piment, oignon). Ton lecteur cultive lui-même " +
      "ses parcelles ; il n'est pas ingénieur. Écris dans un français simple, clair " +
      'et direct, à la deuxième personne (« vous »). Donne des gestes concrets, ' +
      "réalisables avec des moyens locaux et peu coûteux. Quand tu emploies un terme " +
      "technique (nom d'un champignon, d'une matière active), explique-le en quelques " +
      "mots entre parenthèses. Reste factuel : ne promets pas de guérison miracle, et " +
      "rappelle d'aller voir un technicien agricole quand la situation le dépasse. " +
      "N'utilise AUCUN symbole de mise en forme (pas d'astérisques, pas de #). " +
      'Structure ta réponse EXACTEMENT avec ces cinq titres en MAJUSCULES, chacun ' +
      'sur sa propre ligne, suivi de lignes commençant par un tiret :\n' +
      'CE QUI ARRIVE À VOTRE CULTURE\n' +
      'À FAIRE MAINTENANT\n' +
      'À NE PAS FAIRE\n' +
      'ÉVITER QUE CELA REVIENNE\n' +
      'QUAND APPELER UN TECHNICIEN';

  const utilisateur = enAnglais
    ? `Here is the diagnosis made from a photo of the plot:\n\n${contexte}\n\n` +
      'Write a complete, very explicit treatment plan for this grower, ' +
      'strictly following the requested structure.' +
      (recurrence
        ? ' The situation IS RECURRING (see "Repeated cases" above): state this ' +
          'clearly at the start of "WHAT\'S HAPPENING TO YOUR CROP", and adjust the ' +
          'tone accordingly - more urgent than a first isolated case, especially in ' +
          '"WHAT TO DO NOW" and "WHEN TO CALL A TECHNICIAN".'
        : '')
    : `Voici le diagnostic posé sur une photo de la parcelle :\n\n${contexte}\n\n` +
      'Rédige un conseil de traitement complet et très explicite pour ce producteur, ' +
      'en respectant scrupuleusement la structure demandée.' +
      (recurrence
        ? ' La situation SE RÉPÈTE (voir « Cas répétés » ci-dessus) : dis-le clairement au ' +
          'début de "CE QUI ARRIVE À VOTRE CULTURE", et adapte le ton en conséquence - ' +
          'plus pressant qu’un premier cas isolé, notamment sur "À FAIRE MAINTENANT" et ' +
          '"QUAND APPELER UN TECHNICIEN".'
        : '');

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
          model: 'openai/gpt-oss-120b',
          reasoning_effort: 'low',
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
