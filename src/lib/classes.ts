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
  /** Version anglaise de `nom`, affichee quand la langue de l'interface est
   * l'anglais (voir nomClasse ci-dessous) - absente pour aucune entree, mais
   * optionnelle dans le type pour ne pas casser un futur ajout de classe qui
   * l'oublierait au lieu de planter silencieusement sur un `nom` vide. */
  nomEn?: string;
  /** Agent en cause, quand il est identifie. */
  agent?: string;
  /** Version anglaise de `agent`, seulement quand ce n'est pas deja un nom
   * scientifique latin (donc identique dans les deux langues). */
  agentEn?: string;
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
    nomEn: 'Diseased bulb',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Onion___Healthy',
    culture: 'oignon',
    organe: 'bulbe',
    nom: 'Oignon sain',
    nomEn: 'Healthy onion',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Pepper___Anthracnose',
    culture: 'piment',
    organe: 'fruit',
    nom: 'Anthracnose du piment',
    nomEn: 'Pepper anthracnose',
    agent: 'Colletotrichum spp.',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Pepper___Healthy',
    culture: 'piment',
    organe: 'fruit',
    nom: 'Piment sain',
    nomEn: 'Healthy pepper',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Tomato___Anthracnose',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Anthracnose de la tomate',
    nomEn: 'Tomato anthracnose',
    agent: 'Colletotrichum spp.',
    gravite: 'atteint',
    contagieux: true,
  },
  {
    id: 'Tomato___Bacterial_Spot',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Tache bacterienne',
    nomEn: 'Bacterial spot',
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
    nomEn: 'Blossom end rot',
    agent: 'Carence en calcium, liee a l\u2019irregularite des arrosages',
    agentEn: 'Calcium deficiency, linked to irregular watering',
    gravite: 'alerte',
    contagieux: false,
  },
  {
    id: 'Tomato___Healthy',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Tomate saine',
    nomEn: 'Healthy tomato',
    gravite: 'sain',
    contagieux: false,
  },
  {
    id: 'Tomato___Spotted_wilt_Virus',
    culture: 'tomate',
    organe: 'fruit',
    nom: 'Virus de la maladie bronzée',
    nomEn: 'Tomato spotted wilt virus',
    agent: 'Tomato spotted wilt virus, transmis par les thrips',
    agentEn: 'Tomato spotted wilt virus, transmitted by thrips',
    gravite: 'grave',
    contagieux: true,
  },
];

/** Resout toujours via le referentiel CLASSES en vigueur, par id, plutot que
 * de faire confiance a l'objet `classe` recu : une Consultation enregistree
 * dans IndexedDB avant l'ajout de nomEn/agentEn contient un CLONE fige de la
 * classe telle qu'elle etait a l'epoque (structured clone, pas une reference
 * vivante) - sans cette resolution, les diagnostics deja stockes resteraient
 * bloques en francais meme apres bascule en anglais. */
function classeVivante(c: Classe): Classe {
  return CLASSES.find((x) => x.id === c.id) ?? c;
}

/** Nom localise d'une classe - retombe sur le francais si la langue est
 * l'anglais mais qu'aucune traduction n'est enregistree (ne devrait pas
 * arriver, toutes les entrees ci-dessus en ont une). */
export function nomClasse(c: Classe, langue: 'fr' | 'en'): string {
  const actuel = classeVivante(c);
  return langue === 'en' && actuel.nomEn ? actuel.nomEn : actuel.nom;
}

/** Agent localise - la plupart des noms scientifiques latins sont deja
 * identiques dans les deux langues, seules les explications en langue
 * naturelle (ex. carence en calcium) ont une version anglaise distincte. */
export function agentClasse(c: Classe, langue: 'fr' | 'en'): string | undefined {
  const actuel = classeVivante(c);
  return langue === 'en' && actuel.agentEn ? actuel.agentEn : actuel.agent;
}

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

/** Memes teintes que couleurGravite, en hexadecimal fige : necessaire pour
 * tout rendu hors de la cascade CSS normale (Leaflet, Recharts, jsPDF), ou
 * var(--x) ne serait pas resolu. A tenir synchronise avec tokens.css. */
export const COULEUR_GRAVITE_HEX: Record<Gravite, string> = {
  sain: '#1f7a4d',
  alerte: '#d98a04',
  atteint: '#b3411a',
  grave: '#6e1f14',
};

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

function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/** Tente de recuperer classes.json, avec deux nouvelles tentatives en cas
 * d'echec reseau ou de reponse non disponible - une connexion mobile
 * flechit un instant bien plus souvent qu'un deploiement n'est reellement
 * incomplet. Sans retry, un simple accroc LTE affichait aux producteurs un
 * message ecrit pour un developpeur ("Relancez les scripts d'export...").
 * Le type de contenu et le JSON, eux, ne sont pas des soucis reseau : une
 * mauvaise reponse la n'a aucune chance de passer au prochain essai. */
async function recupererClassesJson(tentative = 0): Promise<unknown> {
  let reponse: Response;
  try {
    reponse = await fetch('/models/classes.json', { cache: 'no-cache' });
  } catch {
    if (tentative < 2) {
      await attendre(700 * (tentative + 1));
      return recupererClassesJson(tentative + 1);
    }
    throw new ModelesAbsents();
  }

  if (!reponse.ok) {
    if (tentative < 2) {
      await attendre(700 * (tentative + 1));
      return recupererClassesJson(tentative + 1);
    }
    throw new ModelesAbsents();
  }

  // Le serveur de developpement renvoie index.html pour tout chemin inconnu,
  // avec un code 200. Le type de contenu est donc le seul signal fiable.
  const type = reponse.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new ModelesAbsents();

  try {
    return await reponse.json();
  } catch {
    throw new ModelesAbsents();
  }
}

export async function verifierReferentiel(): Promise<void> {
  const officiel = await recupererClassesJson();

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