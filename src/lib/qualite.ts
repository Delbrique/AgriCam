/**
 * Controle de qualite de la photo, avant tout appel au modele.
 *
 * L'analyse Grad-CAM du memoire a montre que les echecs de localisation se
 * concentrent sur les images floues ou mal eclairees : l'attention du reseau
 * se deplace alors vers l'arriere-plan. Plutot que de subir ces cas, on les
 * intercepte en amont et on demande une reprise. Le controle tourne en
 * quelques millisecondes sur une vignette, sans toucher au modele.
 */

export type MotifRejet = 'flou' | 'sombre' | 'surexpose' | 'monotone';

export interface Qualite {
  acceptable: boolean;
  motif?: MotifRejet;
  conseil?: string;
  /** Variance du laplacien : plus elle est basse, plus l'image est floue. */
  nettete: number;
  /** Luminance moyenne, sur 0-255. */
  luminance: number;
  /** Ecart-type de la luminance : un contraste nul trahit une image vide. */
  contraste: number;
}

/* Seuils cales empiriquement sur des photos de terrain prises au telephone.
   Ils sont volontairement permissifs : mieux vaut laisser passer une image
   moyenne que renvoyer sans cesse un producteur a sa photo. */
const SEUIL_NETTETE = 55;
const SEUIL_SOMBRE = 45;
const SEUIL_CLAIR = 225;
const SEUIL_CONTRASTE = 12;

const COTE_ANALYSE = 256;

/** Reduit l'image a une vignette en niveaux de gris. */
function versGris(source: CanvasImageSource): {
  gris: Float32Array;
  largeur: number;
  hauteur: number;
} {
  const toile = document.createElement('canvas');
  toile.width = COTE_ANALYSE;
  toile.height = COTE_ANALYSE;
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Le navigateur n'a pas fourni de contexte 2D.");

  ctx.drawImage(source, 0, 0, COTE_ANALYSE, COTE_ANALYSE);
  const { data } = ctx.getImageData(0, 0, COTE_ANALYSE, COTE_ANALYSE);

  const gris = new Float32Array(COTE_ANALYSE * COTE_ANALYSE);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Ponderation Rec. 601 : correspond a la sensibilite de l'oeil.
    gris[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { gris, largeur: COTE_ANALYSE, hauteur: COTE_ANALYSE };
}

/**
 * Variance du laplacien : mesure de nettete classique en vision par
 * ordinateur. Le laplacien reagit aux transitions brusques ; une image floue
 * n'en contient presque pas, donc sa variance s'effondre.
 */
function varianceLaplacien(
  gris: Float32Array,
  largeur: number,
  hauteur: number,
): number {
  let somme = 0;
  let sommeCarres = 0;
  let n = 0;

  for (let y = 1; y < hauteur - 1; y += 1) {
    for (let x = 1; x < largeur - 1; x += 1) {
      const i = y * largeur + x;
      const l =
        4 * gris[i] -
        gris[i - 1] -
        gris[i + 1] -
        gris[i - largeur] -
        gris[i + largeur];
      somme += l;
      sommeCarres += l * l;
      n += 1;
    }
  }

  const moyenne = somme / n;
  return sommeCarres / n - moyenne * moyenne;
}

export function evaluerQualite(source: CanvasImageSource): Qualite {
  const { gris, largeur, hauteur } = versGris(source);

  let somme = 0;
  for (let i = 0; i < gris.length; i += 1) somme += gris[i];
  const luminance = somme / gris.length;

  let ecart = 0;
  for (let i = 0; i < gris.length; i += 1) {
    ecart += (gris[i] - luminance) ** 2;
  }
  const contraste = Math.sqrt(ecart / gris.length);

  const nettete = varianceLaplacien(gris, largeur, hauteur);

  const base = { nettete, luminance, contraste };

  if (luminance < SEUIL_SOMBRE) {
    return {
      ...base,
      acceptable: false,
      motif: 'sombre',
      conseil: "Photo trop sombre. Sortez de l'ombre ou approchez le fruit de la lumière.",
    };
  }
  if (luminance > SEUIL_CLAIR) {
    return {
      ...base,
      acceptable: false,
      motif: 'surexpose',
      conseil:
        'Photo br\u00fbl\u00e9e par le soleil. Placez-vous dos au soleil, ou faites de l\u2019ombre avec la main.',
    };
  }
  if (contraste < SEUIL_CONTRASTE) {
    return {
      ...base,
      acceptable: false,
      motif: 'monotone',
      conseil: "Aucun détail visible. Cadrez le fruit lui-même, pas le feuillage.",
    };
  }
  if (nettete < SEUIL_NETTETE) {
    return {
      ...base,
      acceptable: false,
      motif: 'flou',
      conseil:
        'Photo floue. Tenez le t\u00e9l\u00e9phone \u00e0 deux mains, touchez le fruit sur l\u2019\u00e9cran pour faire le point.',
    };
  }

  return { ...base, acceptable: true };
}
