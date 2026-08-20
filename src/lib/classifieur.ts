/**
 * Classification et explicabilite, entierement dans le navigateur.
 *
 * -------------------------------------------------------------------------
 * Pourquoi le modele est coupe en deux
 * -------------------------------------------------------------------------
 * TensorFlow.js ne calcule pas de gradients sur un modele converti
 * (GraphModel). Grad-CAM, qui repose precisement sur ces gradients, y est donc
 * hors d'atteinte. L'explicabilite - le coeur du projet - semblait perdue au
 * deploiement.
 *
 * L'architecture retenue s'acheve par GlobalAveragePooling -> Dense(softmax).
 * Dans ce cas particulier, le score de la classe c s'ecrit
 *
 *     score_c = somme_k [ w_kc * GAP(A_k) ]
 *
 * d'ou, pour toute position (i, j) de la carte d'activation A_k :
 *
 *     d(score_c) / d(A_k)_ij = w_kc / Z          (constante sur la carte)
 *     alpha_k^c = (1/Z) * somme_ij [ ... ] = w_kc / Z
 *
 * Les coefficients de Grad-CAM sont donc proportionnels aux poids de la couche
 * dense. La carte de chaleur se reduit a
 *
 *     L_c = ReLU( somme_k [ w_kc * A_k ] )
 *
 * soit le CAM original de Zhou et al. (2016), mathematiquement identique a
 * Grad-CAM pour cette architecture et calculable sans aucun gradient.
 *
 * On exporte donc uniquement le tronc convolutif vers TensorFlow.js ; la
 * moyenne spatiale, la couche dense et le softmax sont reimplementes ici, ce
 * qui livre les cartes d'activation ET les predictions en un seul passage.
 */

import * as tf from '@tensorflow/tfjs';
import { NB_CLASSES } from './classes';

const CHEMIN_TRONC = '/models/tronc/model.json';
const CHEMIN_TETE = '/models/tete.json';
const CHEMIN_PROFILS = '/models/profils.json';

/** Cote d'entree du reseau, impose a l'entrainement. */
export const COTE_ENTREE = 224;

interface Tete {
  /** Matrice des poids, aplatie en (canaux x classes). */
  poids: number[];
  biais: number[];
  canaux: number;
  classes: number;
}

interface ProfilClasse {
  classe: string;
  /** Vecteur moyen (normalise) des images d'entrainement de cette classe. */
  centroide: number[];
  /** Similarite cosinus en-deca de laquelle une image ne ressemble pas assez
   * a cette classe pour qu'on la lui attribue - voir scripts/calculer_profils.py. */
  seuil: number;
}

interface Profils {
  canaux: number;
  profils: ProfilClasse[];
}

export interface Prediction {
  /** Probabilites par classe, dans l'ordre du referentiel. */
  probabilites: Float32Array;
  indice: number;
  confiance: number;
  /** Carte de chaleur normalisee sur 0-1, en resolution native (7x7). */
  chaleur: Float32Array;
  chaleurCote: number;
  /** Vrai si l'image ne ressemble a aucune des 9 classes connues : le
   * classifieur a quand meme du choisir une classe (softmax oblige), mais
   * elle est trop peu fiable pour etre affichee comme un diagnostic. */
  horsSujet: boolean;
  /** Vecteur de caracteristiques (sortie du GAP, avant la couche de
   * decision) - la meme empreinte visuelle qui sert deja a la detection hors
   * sujet, reutilisee pour rapprocher deux photos qui se ressemblent (voir
   * lib/similarite.ts). */
  embedding: Float32Array;
}

let tronc: tf.GraphModel | null = null;
let tete: Tete | null = null;
/** Facultatifs : sans eux, on classe toujours, simplement sans le garde-fou
 * "hors sujet". Un fichier absent ne doit jamais bloquer un diagnostic. */
let profils: Profils | null = null;
let chargement: Promise<void> | null = null;

export type SuiviChargement = (fraction: number, etape: string) => void;

/**
 * Charge les deux artefacts. Idempotent : les appels concurrents partagent la
 * meme promesse, ce qui evite de telecharger le reseau deux fois si
 * l'utilisateur declenche deux diagnostics coup sur coup.
 */
export async function chargerClassifieur(suivi?: SuiviChargement): Promise<void> {
  if (tronc && tete) return;
  if (chargement) return chargement;

  chargement = (async () => {
    suivi?.(0.05, 'Préparation du moteur de calcul');
    await tf.ready();

    suivi?.(0.15, 'Chargement du réseau de reconnaissance');
    tronc = await tf.loadGraphModel(CHEMIN_TRONC, {
      onProgress: (f) => suivi?.(0.15 + f * 0.7, 'Chargement du réseau'),
    });

    suivi?.(0.9, 'Chargement de la couche de décision');
    const reponse = await fetch(CHEMIN_TETE);
    if (!reponse.ok) {
      throw new Error("La couche de décision du modèle est introuvable.");
    }
    tete = (await reponse.json()) as Tete;

    if (tete.classes !== NB_CLASSES) {
      throw new Error(
        `Le modèle annonce ${tete.classes} classes, le référentiel en déclare ${NB_CLASSES}.`,
      );
    }

    // Le garde-fou "hors sujet" degrade silencieusement s'il est absent OU
    // trop lent : preferer un diagnostic sans ce filet plutot que bloquer
    // l'application, potentiellement tres longtemps, pour un fichier annexe
    // sur une connexion mobile lente ou instable.
    try {
      const limite = AbortSignal.timeout(4000);
      const reponseProfils = await fetch(CHEMIN_PROFILS, { signal: limite });
      if (reponseProfils.ok) profils = (await reponseProfils.json()) as Profils;
    } catch {
      /* silencieux : voir commentaire ci-dessus */
    }

    // Un passage a blanc compile les noyaux WebGL : la premiere vraie
    // prediction n'aura plus a payer ce cout.
    suivi?.(0.96, 'Mise en chauffe');
    tf.tidy(() => {
      const vide = tf.zeros([1, COTE_ENTREE, COTE_ENTREE, 3]);
      (tronc as tf.GraphModel).execute(vide);
    });

    suivi?.(1, 'Prêt');
  })();

  try {
    await chargement;
  } finally {
    chargement = null;
  }
}

export function classifieurPret(): boolean {
  return tronc !== null && tete !== null;
}

/** Moyenne spatiale (Global Average Pooling) : reduit une carte
 * d'activation (surface x canaux, aplatie) a un seul vecteur de
 * caracteristiques. Pure, testable sans TF.js ni tronc reel. */
export function moyenneSpatiale(
  brut: Float32Array,
  surface: number,
  canaux: number,
): Float32Array {
  const moyennes = new Float32Array(canaux);
  for (let p = 0; p < surface; p += 1) {
    const base = p * canaux;
    for (let k = 0; k < canaux; k += 1) moyennes[k] += brut[base + k];
  }
  for (let k = 0; k < canaux; k += 1) moyennes[k] /= surface;
  return moyennes;
}

/** Softmax numeriquement stable, puis indice de la classe la plus probable. */
export function softmaxArgmax(
  scores: Float32Array,
): { probabilites: Float32Array; indice: number } {
  let max = -Infinity;
  for (let c = 0; c < scores.length; c += 1) if (scores[c] > max) max = scores[c];

  let total = 0;
  const probabilites = new Float32Array(scores.length);
  for (let c = 0; c < scores.length; c += 1) {
    probabilites[c] = Math.exp(scores[c] - max);
    total += probabilites[c];
  }
  for (let c = 0; c < scores.length; c += 1) probabilites[c] /= total;

  let indice = 0;
  for (let c = 1; c < scores.length; c += 1) {
    if (probabilites[c] > probabilites[indice]) indice = c;
  }
  return { probabilites, indice };
}

/** Similarite cosinus entre deux vecteurs de caracteristiques - le coeur du
 * calcul de detection hors sujet (contre un centroide de classe, voir
 * scripts/calculer_profils.py) et des diagnostics similaires (entre deux
 * photos, voir lib/similarite.ts). Pure, sans dependance au modele charge.
 * `ArrayLike` plutot que `Float32Array` : accepte aussi bien le vecteur brut
 * que celui relu depuis IndexedDB ou un centroide en simple tableau. */
export function similariteCosinus(vecteur: ArrayLike<number>, centroide: ArrayLike<number>): number {
  let norme = 0;
  for (let k = 0; k < vecteur.length; k += 1) norme += vecteur[k] * vecteur[k];
  norme = Math.sqrt(norme);
  if (norme === 0) return 0;

  let similarite = 0;
  for (let k = 0; k < vecteur.length; k += 1) {
    similarite += (vecteur[k] / norme) * centroide[k];
  }
  return similarite;
}

/**
 * Diagnostique une vignette deja recadree.
 *
 * ATTENTION : les pixels sont fournis bruts, dans l'intervalle 0-255.
 * EfficientNet embarque sa propre couche de normalisation ; diviser par 255
 * reviendrait a normaliser deux fois et degraderait fortement la precision,
 * sans lever la moindre erreur. C'est le piege le plus couteux du projet.
 */
export async function classifier(vignette: CanvasImageSource): Promise<Prediction> {
  if (!tronc || !tete) {
    throw new Error("Le modèle n'est pas encore chargé.");
  }
  const t = tete;

  const activations = tf.tidy(() => {
    const pixels = tf.browser
      .fromPixels(vignette as HTMLCanvasElement)
      .resizeBilinear([COTE_ENTREE, COTE_ENTREE])
      .toFloat()
      .expandDims(0);
    return (tronc as tf.GraphModel).execute(pixels) as tf.Tensor4D;
  });

  // Forme attendue : [1, cote, cote, canaux] - typiquement 1 x 7 x 7 x 1536.
  const [, cote, , canaux] = activations.shape;
  const brut = (await activations.data()) as Float32Array;
  activations.dispose();

  if (canaux !== t.canaux) {
    throw new Error(
      `Le tronc produit ${canaux} canaux, la tête en attend ${t.canaux}.`,
    );
  }

  const surface = cote * cote;

  const moyennes = moyenneSpatiale(brut, surface, canaux);

  // --- Couche dense -------------------------------------------------------
  const scores = new Float32Array(t.classes);
  for (let c = 0; c < t.classes; c += 1) {
    let s = t.biais[c];
    for (let k = 0; k < canaux; k += 1) {
      s += moyennes[k] * t.poids[k * t.classes + c];
    }
    scores[c] = s;
  }

  const { probabilites, indice } = softmaxArgmax(scores);

  // --- Hors sujet : l'image ressemble-t-elle a la classe retenue ? --------
  // Un classifieur "ensemble ferme" repartit TOUJOURS son verdict entre les
  // classes connues, meme sur une photo sans rapport (un humain, une scene
  // quelconque) - parfois avec une confiance elevee. On compare donc le
  // vecteur de caracteristiques de l'image (deja calcule ci-dessus, avant la
  // couche de decision) au profil moyen de la classe retenue, obtenu sur de
  // vraies images d'entrainement (voir scripts/calculer_profils.py). En
  // deca du seuil calibre pour cette classe, l'image ne lui ressemble pas
  // assez pour qu'on lui attribue un diagnostic.
  let horsSujet = false;
  if (profils) {
    const profil = profils.profils[indice];
    horsSujet = similariteCosinus(moyennes, profil.centroide) < profil.seuil;
  }

  // --- Carte d'activation de la classe retenue ---------------------------
  const chaleur = new Float32Array(surface);
  let chaleurMax = 0;
  for (let p = 0; p < surface; p += 1) {
    const base = p * canaux;
    let v = 0;
    for (let k = 0; k < canaux; k += 1) {
      v += brut[base + k] * t.poids[k * t.classes + indice];
    }
    const rectifie = v > 0 ? v : 0; // ReLU
    chaleur[p] = rectifie;
    if (rectifie > chaleurMax) chaleurMax = rectifie;
  }
  if (chaleurMax > 0) {
    for (let p = 0; p < surface; p += 1) chaleur[p] /= chaleurMax;
  }

  return {
    probabilites,
    indice,
    confiance: probabilites[indice],
    chaleur,
    chaleurCote: cote,
    horsSujet,
    embedding: moyennes,
  };
}
