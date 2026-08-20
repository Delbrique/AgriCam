/**
 * Le referentiel des classes indexe directement les sorties du softmax : une
 * permutation ou une erreur d'indexation ici rendrait tous les diagnostics
 * faux sans lever la moindre erreur (voir le commentaire en tete de
 * classes.ts). C'est exactement le genre de regression silencieuse qu'un
 * test doit intercepter.
 */
import { describe, expect, it } from 'vitest';
import { CLASSES, NB_CLASSES, classeParId, classeParIndice, couleurGravite, indiceDeClasse } from './classes';

describe('referentiel des classes', () => {
  it('contient 9 classes, sans doublon d’identifiant', () => {
    expect(CLASSES).toHaveLength(9);
    expect(NB_CLASSES).toBe(9);
    const ids = new Set(CLASSES.map((c) => c.id));
    expect(ids.size).toBe(CLASSES.length);
  });

  it('classeParIndice renvoie la classe a la bonne position', () => {
    expect(classeParIndice(0).id).toBe(CLASSES[0].id);
    expect(classeParIndice(8).id).toBe(CLASSES[8].id);
  });

  it('classeParIndice refuse un indice hors du referentiel', () => {
    expect(() => classeParIndice(9)).toThrow();
    expect(() => classeParIndice(-1)).toThrow();
  });

  it('indiceDeClasse et classeParIndice sont l’inverse l’un de l’autre', () => {
    CLASSES.forEach((classe, i) => {
      expect(indiceDeClasse(classe.id)).toBe(i);
      expect(classeParIndice(indiceDeClasse(classe.id)).id).toBe(classe.id);
    });
  });

  it('classeParId retrouve chaque classe par son identifiant technique', () => {
    expect(classeParId('Tomato___Spotted_wilt_Virus')?.nom).toBe(
      'Virus de la maladie bronzée',
    );
    expect(classeParId('inexistant')).toBeUndefined();
  });

  it('couvre les trois cultures et les quatre niveaux de gravite', () => {
    const cultures = new Set(CLASSES.map((c) => c.culture));
    expect(cultures).toEqual(new Set(['tomate', 'piment', 'oignon']));

    const gravites = new Set(CLASSES.map((c) => c.gravite));
    expect(gravites).toEqual(new Set(['sain', 'alerte', 'atteint', 'grave']));
  });
});

describe('couleurGravite', () => {
  it('renvoie une variable CSS distincte par niveau de gravite', () => {
    const couleurs = ['sain', 'alerte', 'atteint', 'grave'] as const;
    const valeurs = couleurs.map(couleurGravite);
    expect(new Set(valeurs).size).toBe(4);
    valeurs.forEach((v) => expect(v).toMatch(/^var\(--/));
  });
});
