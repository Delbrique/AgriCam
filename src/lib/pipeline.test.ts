/**
 * graviteMax determine le badge de gravite affiche pour une photo entiere a
 * partir de plusieurs fruits detectes : une erreur d'ordre masquerait un
 * fruit "grave" derriere un fruit "sain" voisin. couleurJet est la palette
 * utilisee pour la carte de chaleur Grad-CAM/CAM ; elle doit rester une
 * vraie rampe bleu -> rouge pour que l'explication reste lisible.
 */
import { describe, expect, it } from 'vitest';
import { Gravite } from './classes';
import { couleurJet, graviteMax } from './pipeline';

describe('graviteMax', () => {
  it('une liste vide est consideree saine par defaut', () => {
    expect(graviteMax([])).toBe('sain');
  });

  it('respecte l’ordre sain < alerte < atteint < grave', () => {
    expect(graviteMax(['sain', 'alerte'])).toBe('alerte');
    expect(graviteMax(['alerte', 'atteint'])).toBe('atteint');
    expect(graviteMax(['atteint', 'grave'])).toBe('grave');
  });

  it('n’est pas sensible a l’ordre des elements', () => {
    const entrees: Gravite[] = ['grave', 'sain', 'atteint', 'alerte'];
    expect(graviteMax(entrees)).toBe('grave');
    expect(graviteMax([...entrees].reverse())).toBe('grave');
  });

  it('un seul niveau repete renvoie ce niveau', () => {
    expect(graviteMax(['atteint', 'atteint', 'atteint'])).toBe('atteint');
  });
});

describe('couleurJet', () => {
  it('v=0 est franchement bleu (rouge et vert quasi nuls)', () => {
    const [r, g, b] = couleurJet(0);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('v=1 est dominante rouge (bleu et vert nuls)', () => {
    const [r, g, b] = couleurJet(1);
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(g);
  });

  it('le pic de rouge (v=0.75), de vert (v=0.5) et de bleu (v=0.25) atteint 255', () => {
    expect(couleurJet(0.75)[0]).toBe(255);
    expect(couleurJet(0.5)[1]).toBe(255);
    expect(couleurJet(0.25)[2]).toBe(255);
  });

  it('v=0.5 est dominante verte, au centre de la rampe', () => {
    const [r, g, b] = couleurJet(0.5);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('les composantes restent toujours dans [0, 255]', () => {
    for (const v of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      for (const canal of couleurJet(v)) {
        expect(canal).toBeGreaterThanOrEqual(0);
        expect(canal).toBeLessThanOrEqual(255);
      }
    }
  });
});
