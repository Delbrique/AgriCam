/**
 * plusSimilaires decide quels cas passes sont proposes comme "deja vus" :
 * un seuil trop bas rapprocherait des photos sans rapport, un tri inverse
 * mettrait le cas le moins ressemblant en premier.
 */
import { describe, expect, it } from 'vitest';
import { plusSimilaires } from './similarite';

describe('plusSimilaires', () => {
  it('classe les candidats du plus proche au plus eloigne', () => {
    const cible = [1, 0, 0];
    const candidats = [
      { id: 'lointain', embedding: [0.9, 0.44, 0] }, // ~0.9
      { id: 'proche', embedding: [1, 0.01, 0] }, // ~1
      { id: 'moyen', embedding: [0.95, 0.31, 0] }, // ~0.95
    ];
    const resultats = plusSimilaires(cible, candidats);
    expect(resultats.map((r) => r.candidat.id)).toEqual(['proche', 'moyen', 'lointain']);
  });

  it('ecarte les candidats sous le seuil de similarite', () => {
    const cible = [1, 0];
    const candidats = [
      { id: 'proche', embedding: [1, 0.05] },
      { id: 'sans-rapport', embedding: [0, 1] }, // orthogonal, similarite 0
    ];
    const resultats = plusSimilaires(cible, candidats);
    expect(resultats.map((r) => r.candidat.id)).toEqual(['proche']);
  });

  it('respecte la limite demandee', () => {
    const cible = [1, 0];
    const candidats = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      embedding: [1, 0],
    }));
    expect(plusSimilaires(cible, candidats, 2)).toHaveLength(2);
  });

  it('renvoie un tableau vide sans candidats', () => {
    expect(plusSimilaires([1, 0], [])).toEqual([]);
  });

  it('accepte des Float32Array comme cible et comme embeddings candidats', () => {
    const cible = new Float32Array([1, 0]);
    const candidats = [{ id: 'a', embedding: new Float32Array([1, 0]) }];
    const resultats = plusSimilaires(cible, candidats);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].similarite).toBeCloseTo(1, 5);
  });
});
