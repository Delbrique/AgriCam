/**
 * Chaine complete du diagnostic.
 *
 *   photo -> controle qualite -> detection (YOLO) -> recadrage
 *         -> classification (EfficientNetB3) -> carte de chaleur
 *         -> agregation a l'echelle de la photo
 *
 * C'est ce pipeline hybride qui distingue AgriCam d'un simple classifieur : le
 * reseau ne voit jamais une scene entiere, seulement des fruits isoles, dans
 * les conditions de cadrage sur lesquelles il a ete entraine.
 */

import { classeParIndice, Classe, Gravite, SEUIL_CONFIANCE } from './classes';
import { chargerClassifieur, classifier, COTE_ENTREE, Prediction } from './classifieur';
import { Boite, chargerDetecteur, detecter } from './detecteur';
import { evaluerQualite, Qualite } from './qualite';

export interface DiagnosticFruit {
  boite: Boite;
  classe: Classe;
  confiance: number;
  /** Vrai si la confiance est trop basse pour trancher. */
  incertain: boolean;
  /** Vrai si l'image ne ressemble a aucune des cultures reconnues - ce n'est
   * pas de l'incertitude entre maladies connues, c'est une image hors sujet
   * (voir classifieur.ts). Prioritaire sur `incertain` a l'affichage. */
  horsSujet: boolean;
  /** Vignette recadree, en dataURL, pour l'affichage et l'historique. */
  vignette: string;
  /** Vignette recouverte de la carte de chaleur. */
  vignetteChaleur: string;
  probabilites: Float32Array;
  /** Empreinte visuelle du fruit (voir classifieur.ts) - sert a retrouver
   * des diagnostics similaires dans l'historique (lib/similarite.ts). */
  embedding: Float32Array;
}

export interface Diagnostic {
  horodatage: number;
  qualite: Qualite;
  /** Photo d'origine reduite, en dataURL. */
  photo: string;
  fruits: DiagnosticFruit[];
  /** Nombre de fruits juges atteints ou graves. */
  nbAtteints: number;
  /** Part des fruits diagnostiques qui sont atteints, sur 0-1. */
  tauxInfestation: number;
  /** Gravite retenue pour la photo entiere. */
  graviteGlobale: Gravite;
  /** Vrai si le detecteur n'a rien trouve : diagnostic pleine image. */
  sansDetection: boolean;
  dureeMs: number;
  position?: { latitude: number; longitude: number };
}

export type Etape =
  | 'chargement'
  | 'qualite'
  | 'detection'
  | 'classification'
  | 'termine';

export interface Progression {
  etape: Etape;
  fraction: number;
  message: string;
}

export class PhotoRejetee extends Error {
  constructor(public qualite: Qualite) {
    super(qualite.conseil ?? 'Photo inexploitable.');
    this.name = 'PhotoRejetee';
  }
}

const COTE_APERCU = 720;

function toileDepuis(image: HTMLImageElement, cote: number): HTMLCanvasElement {
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height);
  return toile;
}

/** Extrait une vignette carree autour d'une boite, avec une marge. */
function recadrer(source: CanvasImageSource, boite: Boite, marge = 0.12): HTMLCanvasElement {
  const cx = boite.x + boite.largeur / 2;
  const cy = boite.y + boite.hauteur / 2;
  const cote = Math.max(boite.largeur, boite.hauteur) * (1 + marge);

  const toile = document.createElement('canvas');
  toile.width = COTE_ENTREE;
  toile.height = COTE_ENTREE;
  const ctx = toile.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, COTE_ENTREE, COTE_ENTREE);
  ctx.drawImage(
    source,
    cx - cote / 2,
    cy - cote / 2,
    cote,
    cote,
    0,
    0,
    COTE_ENTREE,
    COTE_ENTREE,
  );
  return toile;
}

/**
 * Couleur de la palette « jet » de matplotlib, pour une valeur v dans [0, 1].
 * C'est la palette exacte du notebook : bleu fonce (froid) -> cyan -> jaune
 * -> rouge (chaud). Reproduire la meme palette est ce qui donne a la carte de
 * l'app le meme rendu net que la figure Python.
 */
export function couleurJet(v: number): [number, number, number] {
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 3)));
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 2)));
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Superpose la carte de chaleur a la vignette, a l'identique du notebook.
 *
 * Cote Python : la carte 7x7 est redimensionnee en bilineaire, coloree avec la
 * palette « jet », puis fondue sur TOUTE l'image a alpha = 0.45. Le fruit
 * entier est ainsi teinte, du bleu (zones froides) au rouge (zone decisive) -
 * et non de simples taches chaudes flottant sur l'image.
 *
 * On reproduit exactement ce comportement : palette jet opaque + fondu global
 * a 0.45, le lissage du navigateur tenant lieu d'interpolation bilineaire.
 */
const ALPHA_CHALEUR = 0.45;

function superposerChaleur(
  vignette: HTMLCanvasElement,
  prediction: Prediction,
): HTMLCanvasElement {
  const { chaleur, chaleurCote } = prediction;

  // Carte 7x7 coloree en jet, entierement opaque : c'est le fondu global qui
  // dose la transparence, pas la valeur pixel par pixel.
  const petite = document.createElement('canvas');
  petite.width = chaleurCote;
  petite.height = chaleurCote;
  const ctxPetite = petite.getContext('2d')!;
  const donnees = ctxPetite.createImageData(chaleurCote, chaleurCote);

  for (let p = 0; p < chaleur.length; p += 1) {
    const [r, g, b] = couleurJet(chaleur[p]);
    donnees.data[p * 4] = r;
    donnees.data[p * 4 + 1] = g;
    donnees.data[p * 4 + 2] = b;
    donnees.data[p * 4 + 3] = 255;
  }
  ctxPetite.putImageData(donnees, 0, 0);

  const sortie = document.createElement('canvas');
  sortie.width = vignette.width;
  sortie.height = vignette.height;
  const ctx = sortie.getContext('2d')!;

  // Image de fond, puis carte jet fondue par-dessus a 0.45 :
  //   sortie = vignette * 0.55 + chaleur_jet * 0.45   (idem notebook)
  ctx.drawImage(vignette, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = ALPHA_CHALEUR;
  ctx.drawImage(petite, 0, 0, sortie.width, sortie.height);
  ctx.globalAlpha = 1;
  return sortie;
}

const ORDRE_GRAVITE: Gravite[] = ['sain', 'alerte', 'atteint', 'grave'];

export function graviteMax(gravites: Gravite[]): Gravite {
  return gravites.reduce(
    (pire, g) => (ORDRE_GRAVITE.indexOf(g) > ORDRE_GRAVITE.indexOf(pire) ? g : pire),
    'sain' as Gravite,
  );
}

/** Precharge les deux reseaux. A appeler au premier lancement, en ligne. */
export async function prechargerModeles(
  suivi?: (p: Progression) => void,
): Promise<void> {
  await chargerClassifieur((f, etape) =>
    suivi?.({ etape: 'chargement', fraction: f * 0.7, message: etape }),
  );
  await chargerDetecteur((f, etape) =>
    suivi?.({ etape: 'chargement', fraction: 0.7 + f * 0.3, message: etape }),
  );
}

export async function diagnostiquer(
  image: HTMLImageElement,
  options: {
    suivi?: (p: Progression) => void;
    position?: { latitude: number; longitude: number };
    /** Ignorer le controle de qualite : l'utilisateur a insiste. */
    forcer?: boolean;
  } = {},
): Promise<Diagnostic> {
  const { suivi, position, forcer } = options;
  const debut = performance.now();

  suivi?.({ etape: 'chargement', fraction: 0, message: 'Préparation' });
  await prechargerModeles(suivi);

  const apercu = toileDepuis(image, COTE_APERCU);

  suivi?.({ etape: 'qualite', fraction: 0.75, message: 'Vérification de la photo' });
  const qualite = evaluerQualite(apercu);
  if (!qualite.acceptable && !forcer) {
    throw new PhotoRejetee(qualite);
  }

  suivi?.({ etape: 'detection', fraction: 0.8, message: 'Repérage des fruits' });
  let boites = await detecter(apercu, apercu.width, apercu.height);

  // Repli : si le detecteur ne trouve rien, on traite la photo entiere. Le
  // diagnostic reste possible, mais sera signale comme moins fiable.
  const sansDetection = boites.length === 0;
  if (sansDetection) {
    boites = [
      { x: 0, y: 0, largeur: apercu.width, hauteur: apercu.height, score: 0 },
    ];
  }

  const fruits: DiagnosticFruit[] = [];
  for (let i = 0; i < boites.length; i += 1) {
    suivi?.({
      etape: 'classification',
      fraction: 0.85 + (0.14 * i) / boites.length,
      message:
        boites.length > 1
          ? `Diagnostic du fruit ${i + 1} sur ${boites.length}`
          : 'Diagnostic en cours',
    });

    const vignette = recadrer(apercu, boites[i]);
    const prediction = await classifier(vignette);
    const chaleur = superposerChaleur(vignette, prediction);

    fruits.push({
      boite: boites[i],
      classe: classeParIndice(prediction.indice),
      confiance: prediction.confiance,
      incertain: prediction.confiance < SEUIL_CONFIANCE,
      horsSujet: prediction.horsSujet,
      vignette: vignette.toDataURL('image/jpeg', 0.8),
      vignetteChaleur: chaleur.toDataURL('image/jpeg', 0.8),
      probabilites: prediction.probabilites,
      embedding: prediction.embedding,
    });
  }

  const surs = fruits.filter((f) => !f.incertain && !f.horsSujet);
  const nbAtteints = surs.filter(
    (f) => f.classe.gravite === 'atteint' || f.classe.gravite === 'grave',
  ).length;

  suivi?.({ etape: 'termine', fraction: 1, message: 'Terminé' });

  return {
    horodatage: Date.now(),
    qualite,
    photo: apercu.toDataURL('image/jpeg', 0.75),
    fruits,
    nbAtteints,
    tauxInfestation: surs.length > 0 ? nbAtteints / surs.length : 0,
    graviteGlobale: graviteMax(surs.map((f) => f.classe.gravite)),
    sansDetection,
    dureeMs: Math.round(performance.now() - debut),
    position,
  };
}