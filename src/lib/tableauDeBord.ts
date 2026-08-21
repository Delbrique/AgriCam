/**
 * Fonctions pures d'agregation pour le tableau de bord.
 *
 * Tout est calcule a partir de l'historique local (voir lib/stockage.ts) :
 * aucune donnee inventee, aucune requete reseau, aucune moyenne regionale ou
 * meteo qui n'existerait pas sur cet appareil. Separees de la page pour
 * rester testables sans DOM ni IndexedDB simulee.
 */

import { classeParId, type Classe } from './classes';
import { conduitePour, type Conduite } from '../data/conduites';
import type { DiagnosticFruit } from './pipeline';
import type { Consultation } from './stockage';

export type Periode = 'jour' | 'semaine' | 'mois' | 'tout';

const JOUR_MS = 24 * 3600 * 1000;

function debutPeriode(periode: Periode, maintenant: number): number {
  switch (periode) {
    case 'jour':
      return maintenant - JOUR_MS;
    case 'semaine':
      return maintenant - 7 * JOUR_MS;
    case 'mois':
      return maintenant - 30 * JOUR_MS;
    case 'tout':
      return 0;
  }
}

export function filtrerParPeriode(
  consultations: Consultation[],
  periode: Periode,
  maintenant: number,
): Consultation[] {
  const debut = debutPeriode(periode, maintenant);
  return consultations.filter((c) => c.horodatage >= debut);
}

/** La periode "tout" n'a pas d'equivalent precedent de meme duree : la
 * variation n'a alors aucun sens et ne doit pas etre affichee. */
export function filtrerPeriodePrecedente(
  consultations: Consultation[],
  periode: Periode,
  maintenant: number,
): Consultation[] | null {
  if (periode === 'tout') return null;
  const debutActuelle = debutPeriode(periode, maintenant);
  const duree = maintenant - debutActuelle;
  const debutPrecedente = debutActuelle - duree;
  return consultations.filter(
    (c) => c.horodatage >= debutPrecedente && c.horodatage < debutActuelle,
  );
}

/** Un fruit compte dans les statistiques des lors que le classifieur a pu
 * trancher : ni hors sujet (aucune culture reconnue), ni incertain (sous le
 * seuil de confiance) - les memes criteres que le reste de l'application
 * (voir lib/pipeline.ts). */
function estExploitable(f: DiagnosticFruit): boolean {
  return !f.horsSujet && !f.incertain;
}

/** Seuil de confiance au-dela du seuil de base (0,6, voir classes.ts) a
 * partir duquel un cas "atteint" est signale comme critique meme sans etre
 * au niveau de gravite le plus eleve - un cas "grave" l'est toujours,
 * quelle que soit la confiance. */
const SEUIL_CONFIANCE_ELEVEE = 0.85;

function estAlerteCritique(f: DiagnosticFruit): boolean {
  if (!estExploitable(f)) return false;
  if (f.classe.gravite === 'grave') return true;
  return f.classe.gravite === 'atteint' && f.confiance >= SEUIL_CONFIANCE_ELEVEE;
}

export type StatutDiagnostic = 'sain' | 'surveiller' | 'critique';

/** Reduit un fruit exploitable a l'un des 3 statuts affiches dans la liste
 * des derniers diagnostics - la meme regle que le compte d'alertes
 * critiques ci-dessus, pour que les deux se recoupent toujours. A n'appeler
 * que sur un fruit exploitable (ni hors sujet ni incertain) : ces deux cas
 * se traitent a part, comme partout ailleurs dans l'application (voir
 * FicheResultat.tsx). */
export function statutFruit(f: DiagnosticFruit): StatutDiagnostic {
  if (estAlerteCritique(f)) return 'critique';
  if (f.classe.gravite === 'sain') return 'sain';
  return 'surveiller';
}

export interface KpiTableauDeBord {
  nbDiagnostics: number;
  /** Part des fruits surs juges sains, sur 0-1 ; `null` sans fruit exploitable. */
  tauxSain: number | null;
  nbAlertesCritiques: number;
  maladiePredominante: { classe: Classe; nombre: number } | null;
  /** Confiance moyenne du modele sur les fruits surs, sur 0-1. */
  confianceMoyenne: number | null;
}

export function calculerKpis(consultations: Consultation[]): KpiTableauDeBord {
  let totalSurs = 0;
  let totalSains = 0;
  let totalConfiance = 0;
  let nbAlertesCritiques = 0;
  const compteParMaladie = new Map<string, number>();

  consultations.forEach((c) => {
    c.fruits.forEach((f) => {
      if (!estExploitable(f)) return;
      totalSurs += 1;
      totalConfiance += f.confiance;
      if (f.classe.gravite === 'sain') {
        totalSains += 1;
      } else {
        compteParMaladie.set(f.classe.id, (compteParMaladie.get(f.classe.id) ?? 0) + 1);
      }
      if (estAlerteCritique(f)) nbAlertesCritiques += 1;
    });
  });

  let maladiePredominante: KpiTableauDeBord['maladiePredominante'] = null;
  for (const [classeId, nombre] of compteParMaladie) {
    const classe = classeParId(classeId);
    if (!classe) continue;
    if (!maladiePredominante || nombre > maladiePredominante.nombre) {
      maladiePredominante = { classe, nombre };
    }
  }

  return {
    nbDiagnostics: consultations.length,
    tauxSain: totalSurs > 0 ? totalSains / totalSurs : null,
    nbAlertesCritiques,
    maladiePredominante,
    confianceMoyenne: totalSurs > 0 ? totalConfiance / totalSurs : null,
  };
}

export interface PartMaladie {
  classe: Classe;
  nombre: number;
  /** Sur 0-1, part parmi les fruits malades (sain exclu : un donut de
   * repartition des MALADIES n'a pas a compter les fruits sains). */
  part: number;
}

/** Repartition des maladies detectees (sain exclu), triee de la plus
 * frequente a la plus rare - alimente le donut. */
export function repartitionMaladies(consultations: Consultation[]): PartMaladie[] {
  const compte = new Map<string, number>();
  let total = 0;

  consultations.forEach((c) => {
    c.fruits.forEach((f) => {
      if (!estExploitable(f) || f.classe.gravite === 'sain') return;
      compte.set(f.classe.id, (compte.get(f.classe.id) ?? 0) + 1);
      total += 1;
    });
  });

  return Array.from(compte.entries())
    .map(([classeId, nombre]) => ({
      classe: classeParId(classeId) as Classe,
      nombre,
      part: total > 0 ? nombre / total : 0,
    }))
    .filter((p) => p.classe)
    .sort((a, b) => b.nombre - a.nombre);
}

export interface StatCulture {
  culture: Classe['culture'];
  nombre: number;
  nombreAtteints: number;
}

/** Nombre de fruits diagnostiques par culture, et combien sont atteints/
 * graves parmi eux - alimente les barres horizontales. */
export function repartitionCultures(consultations: Consultation[]): StatCulture[] {
  const parCulture = new Map<Classe['culture'], { nombre: number; atteints: number }>();

  consultations.forEach((c) => {
    c.fruits.forEach((f) => {
      if (!estExploitable(f)) return;
      const entree = parCulture.get(f.classe.culture) ?? { nombre: 0, atteints: 0 };
      entree.nombre += 1;
      if (f.classe.gravite === 'atteint' || f.classe.gravite === 'grave') {
        entree.atteints += 1;
      }
      parCulture.set(f.classe.culture, entree);
    });
  });

  return Array.from(parCulture.entries())
    .map(([culture, { nombre, atteints }]) => ({ culture, nombre, nombreAtteints: atteints }))
    .sort((a, b) => b.nombre - a.nombre);
}

export interface PointSerie {
  /** Jour au format AAAA-MM-JJ (UTC - un decalage d'un jour est possible
   * selon le fuseau du producteur, sans consequence sur une courbe de
   * tendance). */
  date: string;
  total: number;
  /** Nombre de fruits malades (sain exclu) ce jour-la, par identifiant de classe. */
  parMaladie: Record<string, number>;
}

/** Nombre de diagnostics par jour, avec repartition par maladie - alimente
 * la courbe d'evolution temporelle. */
export function serieTemporelle(consultations: Consultation[]): PointSerie[] {
  const parJour = new Map<string, { total: number; parMaladie: Record<string, number> }>();

  consultations.forEach((c) => {
    const cle = new Date(c.horodatage).toISOString().slice(0, 10);
    const entree = parJour.get(cle) ?? { total: 0, parMaladie: {} };
    entree.total += 1;
    c.fruits.forEach((f) => {
      if (!estExploitable(f) || f.classe.gravite === 'sain') return;
      entree.parMaladie[f.classe.id] = (entree.parMaladie[f.classe.id] ?? 0) + 1;
    });
    parJour.set(cle, entree);
  });

  return Array.from(parJour.entries())
    .map(([date, valeurs]) => ({ date, ...valeurs }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface RecommandationAgregee {
  consultationId: string;
  classe: Classe;
  horodatage: number;
  conduite: Conduite | undefined;
}

/** Reprend la conduite a tenir DEJA definie localement (data/conduites.ts)
 * pour les cas critiques les plus recents - jamais un nouvel appel reseau :
 * le tableau de bord reste utilisable hors ligne. */
export function recommandationsCritiques(
  consultations: Consultation[],
  limite = 5,
): RecommandationAgregee[] {
  const critiques: RecommandationAgregee[] = [];

  consultations.forEach((c) => {
    c.fruits.forEach((f) => {
      if (!estAlerteCritique(f)) return;
      critiques.push({
        consultationId: c.id,
        classe: f.classe,
        horodatage: c.horodatage,
        conduite: conduitePour(f.classe.id),
      });
    });
  });

  return critiques.sort((a, b) => b.horodatage - a.horodatage).slice(0, limite);
}
