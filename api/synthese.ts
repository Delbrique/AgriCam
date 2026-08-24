/**
 * Fonction serverless Vercel : /api/synthese
 *
 * Contrairement a /api/conseil (un conseil de traitement pour UN diagnostic
 * precis, affiche sur la fiche de resultat), cet endpoint analyse l'etat
 * D'ENSEMBLE du tableau de bord d'un producteur : plusieurs diagnostics
 * accumules sur une periode, toutes cultures et maladies confondues. Le
 * role n'est pas de decrire chaque maladie une par une, mais de degager une
 * priorite parmi tout ce qui a ete diagnostique. Meme principe que les
 * autres endpoints : la cle GROQ_API_KEY reste ici, cote serveur.
 */

interface RepartitionMaladie {
  nom: string;
  nombre: number;
  part: number;
}

interface RepartitionCulture {
  nom: string;
  nombre: number;
  nombreAtteints: number;
}

interface MaladieCritique {
  nom: string;
  occurrences: number;
}

interface CorpsRequete {
  periode: string;
  nbDiagnostics: number;
  tauxSain: number | null;
  nbAlertesCritiques: number;
  confianceMoyenne: number | null;
  maladiePredominante: string | null;
  maladiesCritiques?: MaladieCritique[];
  repartitionMaladies?: RepartitionMaladie[];
  repartitionCultures?: RepartitionCulture[];
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

  const { nbDiagnostics } = corps;
  if (!nbDiagnostics || nbDiagnostics <= 0) {
    res.status(400).json({ erreur: 'Aucun diagnostic à analyser.' });
    return;
  }

  const {
    periode,
    tauxSain,
    nbAlertesCritiques,
    confianceMoyenne,
    maladiePredominante,
    maladiesCritiques = [],
    repartitionMaladies = [],
    repartitionCultures = [],
  } = corps;

  const contexte = [
    `Période analysée : ${periode}`,
    `Nombre de diagnostics : ${nbDiagnostics}`,
    tauxSain !== null ? `Taux de plants sains : ${Math.round(tauxSain * 100)} %` : '',
    `Alertes critiques : ${nbAlertesCritiques}`,
    confianceMoyenne !== null
      ? `Confiance moyenne du modèle : ${Math.round(confianceMoyenne * 100)} %`
      : '',
    maladiePredominante ? `Maladie la plus fréquente : ${maladiePredominante}` : '',
    maladiesCritiques.length > 0
      ? 'Maladies critiques détectées :\n' +
        maladiesCritiques.map((m) => `  - ${m.nom} : ${m.occurrences} cas`).join('\n')
      : '',
    repartitionMaladies.length > 0
      ? 'Répartition de toutes les maladies détectées :\n' +
        repartitionMaladies
          .map((m) => `  - ${m.nom} : ${m.nombre} cas (${Math.round(m.part * 100)} %)`)
          .join('\n')
      : '',
    repartitionCultures.length > 0
      ? 'Répartition par culture :\n' +
        repartitionCultures
          .map((c) => `  - ${c.nom} : ${c.nombre} fruits diagnostiqués, dont ${c.nombreAtteints} atteints`)
          .join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systeme =
    "Tu es un conseiller agricole qui analyse le TABLEAU DE BORD complet d'un " +
    'producteur maraîcher au Cameroun (tomate, piment, oignon) - plusieurs ' +
    "diagnostics accumulés sur une période, pas un seul. Ton lecteur cultive " +
    "lui-même ses parcelles ; il n'est pas ingénieur. Ton rôle n'est PAS de " +
    "décrire chaque maladie une par une (il a déjà le détail ailleurs dans " +
    "l'application) : dégage une vision d'ensemble et une priorité claire. " +
    'Écris en français simple et direct, à la deuxième personne (« vous »). ' +
    "Reste factuel, base-toi UNIQUEMENT sur les chiffres fournis, n'invente " +
    "aucune donnée (pas de météo, pas de superficie, pas de tendance " +
    "régionale). N'utilise AUCUN symbole de mise en forme (pas d'astérisques, " +
    'pas de #). Structure ta réponse EXACTEMENT avec ces trois titres en ' +
    'MAJUSCULES, chacun sur sa propre ligne, suivi de lignes commençant par ' +
    'un tiret :\n' +
    'SITUATION GÉNÉRALE\n' +
    'PRIORITÉ DE LA SEMAINE\n' +
    'À SURVEILLER';

  const utilisateur =
    `Voici l'état actuel du tableau de bord de ce producteur :\n\n${contexte}\n\n` +
    "Rédige une analyse d'ensemble courte et actionnable, en respectant " +
    'scrupuleusement la structure demandée.';

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: utilisateur },
        ],
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      res.status(502).json({
        erreur: 'Le service de synthèse a refusé la demande.',
        detail: detail.slice(0, 300),
      });
      return;
    }

    const data = await reponse.json();
    const synthese: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!synthese) {
      res.status(502).json({ erreur: 'Réponse vide du service de synthèse.' });
      return;
    }

    res.status(200).json({ synthese });
  } catch (e) {
    res.status(500).json({
      erreur: "L'appel au service de synthèse a échoué. Réessayez plus tard.",
    });
  }
}
