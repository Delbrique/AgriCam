/**
 * Referentiel des classes reconnues par le modele.
 *
 * ATTENTION - L'ORDRE EST CRITIQUE.
 * Il reproduit exactement celui de class_names.json, tel que produit par
 * l'ETL et verifie a l'export du 25/07/2026 :
 *
 *   0 Onion___Diseased          5 Tomato___Bacterial_Spot
 *   1 Onion___Healthy           6 Tomato___Blossom_end_rot
 *   2 Pepper___Anthracnose      7 Tomato___Healthy
 *   3 Pepper___Healthy          8 Tomato___Spotted_wilt_Virus
 *   4 Tomato___Anthracnose
 *
 * C'est cet ordre qui indexe les sorties du softmax. Une seule permutation
 * suffirait a rendre tous les diagnostics faux, sans qu'aucune erreur ne soit
 * levee : le modele repondrait avec assurance, et se tromperait de maladie.
 * L'ordre alphabetique observe ici n'est pas un hasard - il vient de la
 * lecture des dossiers par image_dataset_from_directory.
 */

export type Gravite = 'sain' | 'alerte' | 'atteint' | 'grave';

export interface Classe {
  /** Identifiant technique, tel qu'il sort du modele. */
  id: string;
  culture: 'tomate' | 'piment' | 'oignon';
  /** Organe observe : le modele est entraine sur l'organe recolte. */
  organe: 'fruit' | 'bulbe';
  /** Libelle affiche a l'utilisateur. */
  nom: string;
  /** Agent en cause, quand il est identifie. */
  agent?: string;
  gravite: Gravite;
  /**
   * Vrai si l'atteinte se transmet aux organes voisins. Determine l'urgence du
   * geste a poser : une maladie contagieuse impose de retirer le fruit, un
   * trouble physiologique non.
   */
  contagieux: boolean;
}

export const CLASSES: Classe[] = [
  {
    id: 'Onion___Diseased',
    culture: 'oignon',
    organe: 'bulbe',
    nom: 'Bulbe atteint',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Onion___Healthy',
    culture: 'oignon',
    organe: 'bulbe',
    nom: 'Oignon sain',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Pepper___Anthracnose',
    culture: 'piment',
    organe: 'fruit',
    nom: 'Anthracnose du piment',
    agent: 'Colletotrichum spp.',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Pepper___Healthy',
    culture: 'piment',
    organe: 'fruit',
    nom: 'Piment sain',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Tomato___Anthracnose',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Anthracnose de la tomate',
    agent: 'Colletotrichum spp.',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Tomato___Bacterial_Spot',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Tache bacterienne',
    agent: 'Xanthomonas spp.',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    // Trouble physiologique, non un agent pathogene : la conduite a tenir est
    // radicalement differente, d'ou une gravite moindre malgre l'aspect
    // spectaculaire de la lesion.
    id: 'Tomato___Blossom_end_rot',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Pourriture apicale',
    agent: 'Carence en calcium, liee a l\u2019irregularite des arrosages',
    gravite: 'alerte',
    contagieux: false,
  },
  {
    id: 'Tomato___Healthy',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Tomate saine',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Tomato___Spotted_wilt_Virus',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Virus de la maladie bronzee',
    agent: 'Tomato spotted wilt virus, transmis par les thrips',
    gravite: 'grave',
    contagieux: true,
  },
];

export const NB_CLASSES = CLASSES.length;

export function classeParIndice(i: number): Classe {
  const c = CLASSES[i];
  if (!c) throw new Error(`Indice de classe hors du referentiel : ${i}`);
  return c;
}

export function classeParId(id: string): Classe | undefined {
  return CLASSES.find((c) => c.id === id);
}

export function indiceDeClasse(id: string): number {
  return CLASSES.findIndex((c) => c.id === id);
}

/** Couleur CSS associee a un niveau de gravite. */
export function couleurGravite(g: Gravite): string {
  return {
    sain: 'var(--sain)',
    alerte: 'var(--alerte)',
    atteint: 'var(--atteint)',
    grave: 'var(--grave)',
  }[g];
}

/**
 * Seuil de confiance en deca duquel on refuse de trancher.
 *
 * Ce n'est pas un reglage cosmetique. L'evaluation du modele a montre que les
 * predictions sous ce seuil sont majoritairement fausses : afficher une
 * etiquette peu fiable serait plus nuisible que d'avouer l'incertitude,
 * puisque le producteur pourrait traiter - ou s'abstenir - a tort.
 */
export const SEUIL_CONFIANCE = 0.6;

/**
 * Controle d'integrite du referentiel, execute au demarrage.
 *
 * Le fichier classes.json accompagne les poids : il enonce l'ordre exact des
 * classes tel que le modele les a apprises. Si cet ordre diverge de celui
 * declare ci-dessus, les diagnostics seraient faux SANS QU'AUCUNE ERREUR NE
 * SOIT LEVEE - le modele repondrait avec assurance, et se tromperait de
 * maladie. D'ou ce controle.
 *
 * Trois situations a distinguer, car elles n'appellent pas la meme reaction :
 *
 *   1. Modeles absents. En developpement, le serveur renvoie index.html pour
 *      tout chemin inconnu : la reponse est un 200 contenant du HTML. Sans
 *      verification du type de contenu, l'analyse JSON echoue sur
 *      « Unexpected token '<' » - un message qui ne dit rien du vrai probleme.
 *   2. Referentiel divergent. La situation grave : on refuse de continuer.
 *   3. Tout concorde. On se tait.
 */

export class ModelesAbsents extends Error {
  constructor() {
    super(
      "Les modèles ne sont pas installés. Le dossier public/models doit contenir " +
        "classes.json, tete.json, tronc/ et detecteur.onnx. Relancez les scripts " +
        "d'export : python scripts\\exporter_modeles.py puis, dans l'environnement " +
        "yolo, python scripts\\exporter_detecteur.py",
    );
    this.name = 'ModelesAbsents';
  }
}

export class ReferentielDivergent extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferentielDivergent';
  }
}

export async function verifierReferentiel(): Promise<void> {
  let reponse: Response;
  try {
    reponse = await fetch('/models/classes.json', { cache: 'no-cache' });
  } catch {
    throw new ModelesAbsents();
  }

  if (!reponse.ok) throw new ModelesAbsents();

  // Le serveur de developpement renvoie index.html pour tout chemin inconnu,
  // avec un code 200. Le type de contenu est donc le seul signal fiable.
  const type = reponse.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new ModelesAbsents();

  let officiel: unknown;
  try {
    officiel = await reponse.json();
  } catch {
    throw new ModelesAbsents();
  }

  // Le fichier peut etre une liste, ou un objet indexe par numero de classe.
  const liste: string[] = Array.isArray(officiel)
    ? officiel
    : Object.entries(officiel as Record<string, string>)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, nom]) => nom);

  if (liste.length === 0) throw new ModelesAbsents();

  const local = CLASSES.map((c) => c.id);

  if (liste.length !== local.length) {
    throw new ReferentielDivergent(
      `Le modèle déclare ${liste.length} classes, l'application en connaît ${local.length}.`,
    );
  }

  const ecart = liste.findIndex((id, i) => id !== local[i]);
  if (ecart !== -1) {
    throw new ReferentielDivergent(
      `Classe ${ecart} : le modèle annonce « ${liste[ecart]} », l'application attend ` +
        `« ${local[ecart]} ». Les diagnostics seraient faux. Mettez à jour ` +
        'src/lib/classes.ts pour reproduire exactement l\'ordre de classes.json.',
    );
  }
}