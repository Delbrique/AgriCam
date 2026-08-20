/**
 * Ces trois fonctions forment la partie "reimplementee a la main" du reseau
 * (voir le commentaire en tete de classifieur.ts : GAP -> dense -> softmax
 * sont reproduits hors TF.js pour recuperer Grad-CAM sans gradients). Une
 * erreur numerique ici degraderait silencieusement chaque diagnostic, sans
 * jamais lever d'exception.
 */
import { describe, expect, it } from 'vitest';
import { moyenneSpatiale, similariteCosinus, softmaxArgmax } from './classifieur';

describe('moyenneSpatiale', () => {
  it('moyenne chaque canal independamment sur toutes les positions', () => {
    // 2 positions, 3 canaux : [1,10,100, 3,20,200] -> moyennes [2,15,150]
    const brut = new Float32Array([1, 10, 100, 3, 20, 200]);
    const moyennes = moyenneSpatiale(brut, 2, 3);
    expect(Array.from(moyennes)).toEqual([2, 15, 150]);
  });

  it('une seule position renvoie cette position telle quelle', () => {
    const brut = new Float32Array([5, 6, 7]);
    const moyennes = moyenneSpatiale(brut, 1, 3);
    expect(Array.from(moyennes)).toEqual([5, 6, 7]);
  });
});

describe('softmaxArgmax', () => {
  it('les probabilites somment a 1', () => {
    const { probabilites } = softmaxArgmax(new Float32Array([1, 2, 3]));
    let total = 0;
    probabilites.forEach((p) => (total += p));
    expect(total).toBeCloseTo(1, 5);
  });

  it('designe l’indice du score le plus eleve', () => {
    const { indice } = softmaxArgmax(new Float32Array([0.1, 5, -3, 2]));
    expect(indice).toBe(1);
  });

  it('des scores identiques donnent une distribution uniforme', () => {
    const { probabilites, indice } = softmaxArgmax(new Float32Array([4, 4, 4]));
    expect(indice).toBe(0);
    probabilites.forEach((p) => expect(p).toBeCloseTo(1 / 3, 5));
  });

  it('reste stable sur de tres grands scores (pas de NaN/Infinity)', () => {
    const { probabilites, indice } = softmaxArgmax(new Float32Array([1000, 1001, 999]));
    expect(indice).toBe(1);
    probabilites.forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('similariteCosinus', () => {
  it('vaut 1 pour un vecteur identique (deja normalise) a son centroide', () => {
    const centroide = [0.6, 0.8];
    expect(similariteCosinus(new Float32Array([3, 4]), centroide)).toBeCloseTo(1, 5);
  });

  it('vaut 0 pour des vecteurs orthogonaux', () => {
    expect(similariteCosinus(new Float32Array([1, 0]), [0, 1])).toBeCloseTo(0, 5);
  });

  it('vaut -1 pour des vecteurs opposes', () => {
    expect(similariteCosinus(new Float32Array([1, 0]), [-1, 0])).toBeCloseTo(-1, 5);
  });

  it('renvoie 0, sans lever d’erreur, pour un vecteur nul', () => {
    expect(similariteCosinus(new Float32Array([0, 0, 0]), [1, 2, 3])).toBe(0);
  });

  it('reste bornee a [-1, 1] meme quand aucun des deux vecteurs n’est normalise', () => {
    // Regression : une version passee ne normalisait que le premier vecteur,
    // ce qui laissait le resultat filer bien au-dela de 1 des que le second
    // n'etait pas deja de norme 1 (cas reel : deux empreintes brutes issues
    // du GAP, voir lib/similarite.ts) - jusqu'a afficher "436 % de
    // ressemblance" dans l'interface.
    const a = [10, 0, 0];
    const b = [8, 6, 0]; // norme 10, tres different de 1
    const s = similariteCosinus(a, b);
    expect(s).toBeLessThanOrEqual(1);
    expect(s).toBeGreaterThanOrEqual(-1);
    expect(s).toBeCloseTo(0.8, 5);
  });

  it('est symetrique', () => {
    const a = [10, 0, 0];
    const b = [8, 6, 0];
    expect(similariteCosinus(a, b)).toBeCloseTo(similariteCosinus(b, a), 10);
  });
});
