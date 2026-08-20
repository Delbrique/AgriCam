/**
 * evaluerStats porte les seuils de rejet d'une photo AVANT tout appel au
 * modele : une regression ici laisserait passer des photos inexploitables
 * (ou l'inverse, rejetterait des photos correctes). calculerStats est le
 * calcul purement numerique sous-jacent (nettete/luminance/contraste),
 * teste separement de l'extraction canvas qui le precede en production.
 */
import { describe, expect, it } from 'vitest';
import { calculerStats, evaluerStats } from './qualite';

describe('evaluerStats - seuils de rejet', () => {
  const stats = { nettete: 200, luminance: 128, contraste: 60 };

  it('accepte une photo nette, bien exposee et contrastee', () => {
    const resultat = evaluerStats(stats);
    expect(resultat.acceptable).toBe(true);
    expect(resultat.motif).toBeUndefined();
  });

  it('rejette une photo trop sombre', () => {
    const resultat = evaluerStats({ ...stats, luminance: 10 });
    expect(resultat.acceptable).toBe(false);
    expect(resultat.motif).toBe('sombre');
    expect(resultat.conseil).toBeTruthy();
  });

  it('rejette une photo surexposee', () => {
    const resultat = evaluerStats({ ...stats, luminance: 250 });
    expect(resultat.acceptable).toBe(false);
    expect(resultat.motif).toBe('surexpose');
  });

  it('rejette une image monotone (contraste nul)', () => {
    const resultat = evaluerStats({ ...stats, contraste: 0 });
    expect(resultat.acceptable).toBe(false);
    expect(resultat.motif).toBe('monotone');
  });

  it('rejette une photo floue', () => {
    const resultat = evaluerStats({ ...stats, nettete: 1 });
    expect(resultat.acceptable).toBe(false);
    expect(resultat.motif).toBe('flou');
  });

  it('conserve nettete/luminance/contraste dans le resultat, meme rejete', () => {
    const resultat = evaluerStats({ ...stats, luminance: 10 });
    expect(resultat.nettete).toBe(stats.nettete);
    expect(resultat.luminance).toBe(10);
    expect(resultat.contraste).toBe(stats.contraste);
  });
});

describe('calculerStats', () => {
  it('une image parfaitement unie a un contraste et une nettete nuls', () => {
    const gris = new Float32Array(16 * 16).fill(128);
    const stats = calculerStats(gris, 16, 16);
    expect(stats.luminance).toBeCloseTo(128, 5);
    expect(stats.contraste).toBeCloseTo(0, 5);
    expect(stats.nettete).toBeCloseTo(0, 5);
  });

  it('un damier tres contraste a une nettete elevee', () => {
    const cote = 16;
    const gris = new Float32Array(cote * cote);
    for (let y = 0; y < cote; y += 1) {
      for (let x = 0; x < cote; x += 1) {
        gris[y * cote + x] = (x + y) % 2 === 0 ? 0 : 255;
      }
    }
    const uni = new Float32Array(cote * cote).fill(128);

    const statsDamier = calculerStats(gris, cote, cote);
    const statsUni = calculerStats(uni, cote, cote);

    expect(statsDamier.nettete).toBeGreaterThan(statsUni.nettete);
    expect(statsDamier.contraste).toBeGreaterThan(statsUni.contraste);
  });
});
