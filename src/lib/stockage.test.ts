/**
 * calculerStatutParcelle decide la puce de couleur et la fleche de tendance
 * affichees sur chaque parcelle de la carte - une inversion ici afficherait
 * "ça s'améliore" a un producteur alors que l'infestation empire.
 */
import { describe, expect, it } from 'vitest';
import { calculerStatutParcelle, type Consultation } from './stockage';

const JOUR = 24 * 3600 * 1000;
const MAINTENANT = Date.parse('2026-08-20T12:00:00Z');

function fixture(joursAvant: number, tauxInfestation: number, graviteGlobale: Consultation['graviteGlobale']): Consultation {
  return {
    horodatage: MAINTENANT - joursAvant * JOUR,
    tauxInfestation,
    graviteGlobale,
  } as Consultation;
}

describe('calculerStatutParcelle', () => {
  it('sans aucune consultation, tout est indetermine', () => {
    const statut = calculerStatutParcelle([], MAINTENANT);
    expect(statut.tauxRecent).toBeNull();
    expect(statut.tauxPrecedent).toBeNull();
    expect(statut.gravitePire).toBeNull();
    expect(statut.tendance).toBeNull();
  });

  it('sans fenetre precedente, la tendance reste indeterminee (pas de faux "stable")', () => {
    const statut = calculerStatutParcelle([fixture(5, 0.6, 'atteint')], MAINTENANT);
    expect(statut.tauxRecent).toBeCloseTo(0.6, 5);
    expect(statut.nbRecent).toBe(1);
    expect(statut.tauxPrecedent).toBeNull();
    expect(statut.tendance).toBeNull();
  });

  it('detecte une aggravation quand le taux recent depasse nettement le precedent', () => {
    const consultations = [fixture(45, 0.1, 'alerte'), fixture(5, 0.5, 'grave')];
    const statut = calculerStatutParcelle(consultations, MAINTENANT);
    expect(statut.tendance).toBe('aggravation');
  });

  it('detecte une amelioration quand le taux recent chute nettement', () => {
    const consultations = [fixture(45, 0.5, 'grave'), fixture(5, 0.1, 'alerte')];
    const statut = calculerStatutParcelle(consultations, MAINTENANT);
    expect(statut.tendance).toBe('amelioration');
  });

  it('un ecart infime entre les deux fenetres reste "stable"', () => {
    const consultations = [fixture(45, 0.3, 'atteint'), fixture(5, 0.32, 'atteint')];
    const statut = calculerStatutParcelle(consultations, MAINTENANT);
    expect(statut.tendance).toBe('stable');
  });

  it('ignore les consultations plus vieilles que les deux fenetres', () => {
    const consultations = [fixture(90, 0.9, 'grave'), fixture(5, 0.1, 'sain')];
    const statut = calculerStatutParcelle(consultations, MAINTENANT);
    expect(statut.nbPrecedent).toBe(0);
    expect(statut.tauxPrecedent).toBeNull();
    expect(statut.nbRecent).toBe(1);
  });

  it('gravitePire retient la pire gravite parmi les consultations recentes seulement', () => {
    const consultations = [
      fixture(50, 0.9, 'grave'), // dans la fenetre precedente, exclue du calcul de gravitePire
      fixture(3, 0.2, 'alerte'),
      fixture(1, 0.4, 'atteint'),
    ];
    const statut = calculerStatutParcelle(consultations, MAINTENANT);
    expect(statut.gravitePire).toBe('atteint');
  });
});
