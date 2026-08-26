/**
 * Localisation des fruits par YOLOv8n, dans le navigateur.
 *
 * Le classifieur a ete entraine sur des fruits cadres. Sur une photo de
 * terrain - une branche entiere, du feuillage, un sol - il n'a aucun moyen de
 * savoir OU regarder. Le detecteur resout ce probleme en isolant chaque fruit
 * avant la classification.
 *
 * Deux consequences directes, toutes deux visibles dans l'interface :
 *   - le diagnostic porte sur le fruit, pas sur la scene ;
 *   - une photo contenant plusieurs fruits produit plusieurs diagnostics, donc
 *     un taux d'infestation.
 *
 * Le modele est execute via onnxruntime-web plutot que TensorFlow.js : la
 * conversion depuis les poids Ultralytics y est directe et fiable, la
 * conversion vers TF.js ne l'est pas.
 */

import * as ort from 'onnxruntime-web';

const CHEMIN_MODELE = '/models/detecteur.onnx';

/** Resolution d'entree de YOLO, distincte du 224 du classifieur. */
export const COTE_DETECTION = 640;

/** Score minimal pour retenir une boite. Releve de 0,3 a 0,45 : un seuil trop
 * permissif laissait passer des detections hasardeuses sur des scenes sans
 * rapport (voir le profil de classe cote classifieur pour le filet de
 * securite complementaire, sur des photos qui n'ont aucun fruit du tout). */
const SEUIL_OBJET = 0.45;
/** Recouvrement au-dela duquel deux boites sont considerees redondantes. */
const SEUIL_NMS = 0.45;
/** Au-dela, la scene est trop chargee pour un diagnostic utile. */
const MAX_BOITES = 20;

export interface Boite {
  /** Coordonnees en pixels dans l'image d'origine. */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  score: number;
}

let session: ort.InferenceSession | null = null;
let chargement: Promise<void> | null = null;

export async function chargerDetecteur(
  suivi?: (fraction: number, etape: string) => void,
): Promise<void> {
  if (session) return;
  if (chargement) return chargement;

  async function tenter(): Promise<void> {
    suivi?.(0.1, 'Chargement du détecteur');
    // Les binaires WebAssembly sont servis depuis l'application elle-meme, et
    // non depuis un CDN : sans cela, le detecteur cesserait de fonctionner des
    // que la connexion disparait - c'est-a-dire au champ.
    ort.env.wasm.wasmPaths = '/ort/';
    ort.env.wasm.numThreads = 1; // les telephones vises n'ont pas de threads WASM
    ort.env.wasm.simd = true;
    session = await ort.InferenceSession.create(CHEMIN_MODELE, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    suivi?.(1, 'Détecteur prêt');
  }

  chargement = (async () => {
    try {
      await tenter();
    } catch (premiereErreur) {
      // Meme logique que chargerClassifieur() : un telechargement a froid
      // echoue parfois sur un simple accroc reseau, un seul nouvel essai
      // suffit generalement.
      session = null;
      await new Promise((r) => setTimeout(r, 1500));
      try {
        await tenter();
      } catch {
        throw premiereErreur;
      }
    }
  })();

  try {
    await chargement;
  } finally {
    chargement = null;
  }
}

export function detecteurPret(): boolean {
  return session !== null;
}

/** Redimensionne en conservant les proportions, avec bandes grises. */
function preparer(image: CanvasImageSource, largeurSrc: number, hauteurSrc: number) {
  const echelle = Math.min(COTE_DETECTION / largeurSrc, COTE_DETECTION / hauteurSrc);
  const l = Math.round(largeurSrc * echelle);
  const h = Math.round(hauteurSrc * echelle);
  const decalageX = (COTE_DETECTION - l) / 2;
  const decalageY = (COTE_DETECTION - h) / 2;

  const toile = document.createElement('canvas');
  toile.width = COTE_DETECTION;
  toile.height = COTE_DETECTION;
  const ctx = toile.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, COTE_DETECTION, COTE_DETECTION);
  ctx.drawImage(image, decalageX, decalageY, l, h);

  const { data } = ctx.getImageData(0, 0, COTE_DETECTION, COTE_DETECTION);
  const surface = COTE_DETECTION * COTE_DETECTION;

  // YOLO attend un tenseur NCHW normalise sur 0-1.
  const entree = new Float32Array(3 * surface);
  for (let p = 0; p < surface; p += 1) {
    entree[p] = data[p * 4] / 255;
    entree[surface + p] = data[p * 4 + 1] / 255;
    entree[2 * surface + p] = data[p * 4 + 2] / 255;
  }

  return { entree, echelle, decalageX, decalageY };
}

function intersectionSurUnion(a: Boite, b: Boite): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.largeur, b.x + b.largeur);
  const y2 = Math.min(a.y + a.hauteur, b.y + b.hauteur);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.largeur * a.hauteur + b.largeur * b.hauteur - inter;
  return union > 0 ? inter / union : 0;
}

/** Suppression des non-maxima : ne garde qu'une boite par fruit. */
function supprimerRedondances(boites: Boite[]): Boite[] {
  const tri = [...boites].sort((x, y) => y.score - x.score);
  const gardees: Boite[] = [];
  for (const candidate of tri) {
    if (gardees.every((g) => intersectionSurUnion(candidate, g) < SEUIL_NMS)) {
      gardees.push(candidate);
    }
    if (gardees.length >= MAX_BOITES) break;
  }
  return gardees;
}

/**
 * Detecte les fruits presents dans l'image.
 * Renvoie un tableau vide si aucun objet ne depasse le seuil : l'appelant
 * bascule alors sur un diagnostic pleine image.
 */
export async function detecter(
  image: CanvasImageSource,
  largeurSrc: number,
  hauteurSrc: number,
): Promise<Boite[]> {
  if (!session) throw new Error("Le détecteur n'est pas chargé.");

  const { entree, echelle, decalageX, decalageY } = preparer(
    image,
    largeurSrc,
    hauteurSrc,
  );

  const tenseur = new ort.Tensor('float32', entree, [1, 3, COTE_DETECTION, COTE_DETECTION]);
  const sortie = await session.run({ [session.inputNames[0]]: tenseur });
  const resultat = sortie[session.outputNames[0]];

  // YOLOv8 sort [1, 4 + nbClasses, nbAncres] : quatre coordonnees puis les
  // scores de classe, transposes par rapport a l'intuition.
  const [, lignes, ancres] = resultat.dims as number[];
  const valeurs = resultat.data as Float32Array;
  const nbClasses = lignes - 4;

  const brutes: Boite[] = [];
  for (let a = 0; a < ancres; a += 1) {
    let meilleur = 0;
    for (let c = 1; c < nbClasses; c += 1) {
      if (valeurs[(4 + c) * ancres + a] > valeurs[(4 + meilleur) * ancres + a]) {
        meilleur = c;
      }
    }
    const score = valeurs[(4 + meilleur) * ancres + a];
    if (score < SEUIL_OBJET) continue;

    // Centre + dimensions, dans le repere 640x640 avec bandes.
    const cx = valeurs[a];
    const cy = valeurs[ancres + a];
    const l = valeurs[2 * ancres + a];
    const h = valeurs[3 * ancres + a];

    // Retour au repere de l'image d'origine.
    const x = (cx - l / 2 - decalageX) / echelle;
    const y = (cy - h / 2 - decalageY) / echelle;

    brutes.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      largeur: Math.min(l / echelle, largeurSrc - Math.max(0, x)),
      hauteur: Math.min(h / echelle, hauteurSrc - Math.max(0, y)),
      score,
    });
  }

  return supprimerRedondances(brutes);
}
