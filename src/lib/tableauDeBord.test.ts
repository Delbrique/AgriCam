/**
 * calculerKpis, repartitionMaladies, repartitionCultures, serieTemporelle et
 * recommandationsCritiques alimentent directement le tableau de bord :
 * une erreur ici afficherait un taux de sante ou une maladie predominante
 * faux au producteur, sans qu'il ait moyen de le remarquer.
 */
import { describe, expect, it } from 'vitest';
import { classeParId } from './classes';
import type { DiagnosticFruit } from './pipeline';
import type { Consultation } from './stockage';
import {
  calculerKpis,
  filtrerParPeriode,
  filtrerPeriodePrecedente,
  recommandationsCritiques,
  repartitionCultures,
  repartitionMaladies,
  serieTemporelle,
  statutFruit,
} from './tableauDeBord';

const MAINTENANT = Date.parse('2026-08-21T12:00:00Z');
const JOUR = 24 * 3600 * 1000;

function fruit(
  classeId: string,
  confiance: number,
  options: { incertain?: boolean; horsSujet?: boolean } = {},
): DiagnosticFruit {
  return {
    classe: classeParId(classeId),
    confiance,
    incertain: options.incertain ?? false,
    horsSujet: options.horsSujet ?? false,
  } as DiagnosticFruit;
}

function consultation(
  id: string,
  joursAvant: number,
  fruits: DiagnosticFruit[],
): Consultation {
  return {
    id,
    horodatage: MAINTENANT - joursAvant * JOUR,
    fruits,
  } as Consultation;
}

describe('filtrerParPeriode / filtrerPeriodePrecedente', () => {
  const consultations = [
    consultation('recent', 0.5, []),
    consultation('semaine', 5, []),
    consultation('mois', 20, []),
    consultation('vieux', 40, []),
  ];

  it('"jour" ne garde que les dernieres 24h', () => {
    expect(filtrerParPeriode(consultations, 'jour', MAINTENANT).map((c) => c.id)).toEqual([
      'recent',
    ]);
  });

  it('"tout" garde tout l\'historique', () => {
    expect(filtrerParPeriode(consultations, 'tout', MAINTENANT)).toHaveLength(4);
  });

  it('"tout" n\'a pas de periode precedente', () => {
    expect(filtrerPeriodePrecedente(consultations, 'tout', MAINTENANT)).toBeNull();
  });

  it('la periode precedente couvre la fenetre juste avant la periode actuelle', () => {
    // "mois" = 30 jours ; la precedente couvre J-60 a J-30. "vieux" (J-40) y tombe.
    const precedente = filtrerPeriodePrecedente(consultations, 'mois', MAINTENANT);
    expect(precedente?.map((c) => c.id)).toEqual(['vieux']);
  });
});

describe('calculerKpis', () => {
  it('sans aucune consultation, tout est indetermine sauf le compte', () => {
    const kpis = calculerKpis([]);
    expect(kpis.nbDiagnostics).toBe(0);
    expect(kpis.tauxSain).toBeNull();
    expect(kpis.confianceMoyenne).toBeNull();
    expect(kpis.maladiePredominante).toBeNull();
    expect(kpis.nbAlertesCritiques).toBe(0);
  });

  it('ecarte les fruits hors sujet et incertains du taux de sante', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Healthy', 0.9),
        fruit('Tomato___Anthracnose', 0.9, { horsSujet: true }),
        fruit('Tomato___Anthracnose', 0.5, { incertain: true }),
      ]),
    ];
    const kpis = calculerKpis(consultations);
    expect(kpis.tauxSain).toBe(1); // le seul fruit exploitable est sain
  });

  it('calcule un taux de sante et une confiance moyenne corrects', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Healthy', 1),
        fruit('Tomato___Anthracnose', 0.8),
      ]),
    ];
    const kpis = calculerKpis(consultations);
    expect(kpis.tauxSain).toBeCloseTo(0.5, 5);
    expect(kpis.confianceMoyenne).toBeCloseTo(0.9, 5);
  });

  it('identifie la maladie predominante (sain exclu)', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Anthracnose', 0.9),
        fruit('Tomato___Anthracnose', 0.9),
        fruit('Pepper___Anthracnose', 0.9),
        fruit('Tomato___Healthy', 0.9),
      ]),
    ];
    const kpis = calculerKpis(consultations);
    expect(kpis.maladiePredominante?.classe.id).toBe('Tomato___Anthracnose');
    expect(kpis.maladiePredominante?.nombre).toBe(2);
  });

  it('compte un cas "grave" comme alerte critique quelle que soit la confiance', () => {
    const consultations = [
      consultation('a', 1, [fruit('Tomato___Spotted_wilt_Virus', 0.61)]),
    ];
    expect(calculerKpis(consultations).nbAlertesCritiques).toBe(1);
  });

  it('ne compte un cas "atteint" comme critique qu’au-dela du seuil de confiance elevee', () => {
    const bas = calculerKpis([consultation('a', 1, [fruit('Tomato___Anthracnose', 0.7)])]);
    const haut = calculerKpis([consultation('b', 1, [fruit('Tomato___Anthracnose', 0.9)])]);
    expect(bas.nbAlertesCritiques).toBe(0);
    expect(haut.nbAlertesCritiques).toBe(1);
  });
});

describe('statutFruit', () => {
  it('sain reste sain', () => {
    expect(statutFruit(fruit('Tomato___Healthy', 0.95))).toBe('sain');
  });

  it('grave est toujours critique', () => {
    expect(statutFruit(fruit('Tomato___Spotted_wilt_Virus', 0.61))).toBe('critique');
  });

  it('atteint est "a surveiller" sous le seuil de confiance elevee, critique au-dela', () => {
    expect(statutFruit(fruit('Tomato___Anthracnose', 0.7))).toBe('surveiller');
    expect(statutFruit(fruit('Tomato___Anthracnose', 0.9))).toBe('critique');
  });
});

describe('repartitionMaladies', () => {
  it('exclut les fruits sains et trie du plus frequent au plus rare', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Healthy', 0.9),
        fruit('Tomato___Anthracnose', 0.9),
        fruit('Tomato___Anthracnose', 0.9),
        fruit('Pepper___Anthracnose', 0.9),
      ]),
    ];
    const repartition = repartitionMaladies(consultations);
    expect(repartition.map((r) => r.classe.id)).toEqual([
      'Tomato___Anthracnose',
      'Pepper___Anthracnose',
    ]);
    expect(repartition[0].nombre).toBe(2);
    expect(repartition[0].part).toBeCloseTo(2 / 3, 5);
  });
});

describe('repartitionCultures', () => {
  it('compte les fruits et les atteints par culture', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Anthracnose', 0.9),
        fruit('Tomato___Healthy', 0.9),
        fruit('Pepper___Anthracnose', 0.9),
      ]),
    ];
    const repartition = repartitionCultures(consultations);
    const tomate = repartition.find((r) => r.culture === 'tomate');
    expect(tomate?.nombre).toBe(2);
    expect(tomate?.nombreAtteints).toBe(1);
  });
});

describe('serieTemporelle', () => {
  it('regroupe par jour et trie chronologiquement', () => {
    const consultations = [
      consultation('recent', 0, [fruit('Tomato___Anthracnose', 0.9)]),
      consultation('ancien', 5, [fruit('Tomato___Healthy', 0.9)]),
    ];
    const serie = serieTemporelle(consultations);
    expect(serie).toHaveLength(2);
    expect(serie[0].date < serie[1].date).toBe(true);
    expect(serie[1].total).toBe(1);
  });
});

describe('recommandationsCritiques', () => {
  it('regroupe les fruits critiques d’une meme maladie plutot que de repeter une carte par fruit', () => {
    const consultations = [
      consultation('a', 10, [fruit('Tomato___Spotted_wilt_Virus', 0.9)]),
      consultation('b', 1, [fruit('Tomato___Spotted_wilt_Virus', 0.9)]),
      consultation('c', 1, [fruit('Tomato___Healthy', 0.9)]),
    ];
    const recos = recommandationsCritiques(consultations);
    expect(recos).toHaveLength(1);
    expect(recos[0].classe.id).toBe('Tomato___Spotted_wilt_Virus');
    expect(recos[0].occurrences).toBe(2);
    expect(recos[0].conduite).toBeDefined();
  });

  it('deux fruits critiques dans la meme consultation comptent pour deux occurrences', () => {
    const consultations = [
      consultation('a', 1, [
        fruit('Tomato___Spotted_wilt_Virus', 0.9),
        fruit('Tomato___Spotted_wilt_Virus', 0.9),
      ]),
    ];
    expect(recommandationsCritiques(consultations)[0].occurrences).toBe(2);
  });

  it('garde la premiere et la derniere date d’apparition de chaque maladie', () => {
    const consultations = [
      consultation('ancien', 10, [fruit('Tomato___Spotted_wilt_Virus', 0.9)]),
      consultation('recent', 1, [fruit('Tomato___Spotted_wilt_Virus', 0.9)]),
    ];
    const [reco] = recommandationsCritiques(consultations);
    expect(reco.derniereFois).toBeGreaterThan(reco.premiereFois);
  });

  it('trie les maladies par derniere apparition, la plus recente d’abord', () => {
    const consultations = [
      consultation('a', 10, [fruit('Tomato___Spotted_wilt_Virus', 0.9)]),
      consultation('b', 1, [fruit('Tomato___Anthracnose', 0.9)]),
    ];
    const recos = recommandationsCritiques(consultations);
    expect(recos.map((r) => r.classe.id)).toEqual([
      'Tomato___Anthracnose',
      'Tomato___Spotted_wilt_Virus',
    ]);
  });

  it('respecte la limite demandee', () => {
    const maladies = [
      'Tomato___Spotted_wilt_Virus',
      'Tomato___Anthracnose',
      'Pepper___Anthracnose',
      'Onion___Diseased',
      'Tomato___Bacterial_Spot',
    ];
    const consultations = maladies.map((id, i) => consultation(`c${i}`, i, [fruit(id, 0.9)]));
    expect(recommandationsCritiques(consultations, 3)).toHaveLength(3);
  });
});
