/**
 * detecterFoyers decide quand l'application avertit d'une propagation
 * active : un faux negatif laisse un vrai foyer passer inaperçu, un faux
 * positif use la confiance du producteur dans les alertes suivantes.
 */
import { describe, expect, it } from 'vitest';
import { detecterFoyers, distanceMetres, type PointDiagnostic } from './alerte';

const JOUR = 24 * 3600 * 1000;
const MAINTENANT = Date.parse('2026-08-20T12:00:00Z');

// Yaounde : ~0.0009 degre de latitude correspond a ~100 m.
const LAT_BASE = 3.848;
const LON_BASE = 11.502;

function point(
  id: string,
  classeId: string,
  decalageMetres: number,
  joursAvant: number,
): PointDiagnostic {
  return {
    id,
    classeId,
    latitude: LAT_BASE + decalageMetres * 0.000009,
    longitude: LON_BASE,
    horodatage: MAINTENANT - joursAvant * JOUR,
  };
}

describe('distanceMetres', () => {
  it('vaut 0 pour un point compare a lui-meme', () => {
    const p = point('a', 'x', 0, 0);
    expect(distanceMetres(p, p)).toBeCloseTo(0, 3);
  });

  it('respecte approximativement la conversion degre -> metre utilisee par les fixtures', () => {
    const a = point('a', 'x', 0, 0);
    const b = point('b', 'x', 100, 0);
    expect(distanceMetres(a, b)).toBeGreaterThan(90);
    expect(distanceMetres(a, b)).toBeLessThan(110);
  });
});

describe('detecterFoyers', () => {
  it('ne detecte rien avec moins de trois points', () => {
    const points = [point('a', 'X', 0, 1), point('b', 'X', 10, 2)];
    expect(detecterFoyers(points, MAINTENANT)).toHaveLength(0);
  });

  it('detecte un foyer avec trois points proches, meme maladie, recents', () => {
    const points = [
      point('a', 'X', 0, 1),
      point('b', 'X', 50, 3),
      point('c', 'X', 100, 5),
    ];
    const foyers = detecterFoyers(points, MAINTENANT);
    expect(foyers).toHaveLength(1);
    expect(foyers[0].classeId).toBe('X');
    expect(new Set(foyers[0].points.map((p) => p.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('ne regroupe pas des maladies differentes, meme au meme endroit', () => {
    const points = [
      point('a', 'X', 0, 1),
      point('b', 'Y', 10, 1),
      point('c', 'X', 20, 1),
    ];
    expect(detecterFoyers(points, MAINTENANT)).toHaveLength(0);
  });

  it('ne regroupe pas des points trop eloignes les uns des autres', () => {
    const points = [
      point('a', 'X', 0, 1),
      point('b', 'X', 5000, 1),
      point('c', 'X', 10000, 1),
    ];
    expect(detecterFoyers(points, MAINTENANT)).toHaveLength(0);
  });

  it('relie deux points distants via un intermediaire (composante connexe)', () => {
    // a-b : 250 m, b-c : 250 m, mais a-c : 500 m (hors du rayon direct de 300 m).
    const points = [
      point('a', 'X', 0, 1),
      point('b', 'X', 250, 2),
      point('c', 'X', 500, 3),
    ];
    const foyers = detecterFoyers(points, MAINTENANT);
    expect(foyers).toHaveLength(1);
    expect(foyers[0].points).toHaveLength(3);
  });

  it('ignore les diagnostics trop anciens pour la fenetre de propagation', () => {
    const points = [
      point('a', 'X', 0, 1),
      point('b', 'X', 10, 3),
      point('c', 'X', 20, 40), // hors des 14 jours
    ];
    expect(detecterFoyers(points, MAINTENANT)).toHaveLength(0);
  });

  it('trie les points du foyer du plus ancien au plus recent', () => {
    const points = [
      point('recent', 'X', 0, 1),
      point('ancien', 'X', 10, 10),
      point('milieu', 'X', 20, 5),
    ];
    const foyers = detecterFoyers(points, MAINTENANT);
    expect(foyers[0].points.map((p) => p.id)).toEqual(['ancien', 'milieu', 'recent']);
  });
});
