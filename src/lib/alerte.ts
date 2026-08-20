/**
 * Detection de foyers en expansion.
 *
 * A partir du seul historique geolocalise de CE telephone (l'application ne
 * partage aucune donnee entre producteurs - voir CarteFoyers.tsx) : un foyer,
 * c'est plusieurs diagnostics de LA MEME maladie, regroupes geographiquement,
 * sur une courte periode. Le signe qu'une maladie est en train de se
 * propager dans une zone du champ, et pas seulement un fruit isole.
 */

import { historique } from './stockage';

export interface PointDiagnostic {
  id: string;
  classeId: string;
  latitude: number;
  longitude: number;
  horodatage: number;
}

export interface Foyer {
  classeId: string;
  /** Tries par date, du plus ancien au plus recent. */
  points: PointDiagnostic[];
}

/** Rayon en-deca duquel deux points sont consideres dans la meme zone du
 * champ : assez large pour tolerer l'imprecision GPS d'un telephone en
 * exterieur (10-50 m courants), assez etroit pour ne pas regrouper deux
 * parcelles distinctes. */
export const RAYON_ALERTE_METRES = 300;

/** Fenetre volontairement plus courte que le suivi de parcelle (30 jours,
 * voir stockage.ts) : une propagation active se detecte a l'echelle de la
 * quinzaine, pas du mois. */
export const FENETRE_JOURS_ALERTE = 14;

/** Nombre minimal de points distincts pour parler de foyer plutot que de
 * coincidence (deux fruits voisins, dans un jardin, ne sont pas un foyer). */
export const SEUIL_POINTS_FOYER = 3;

const RAYON_TERRE_METRES = 6371000;

/** Distance a vol d'oiseau (formule de haversine) - suffisante a l'echelle
 * d'un champ, pas besoin d'un modele geodesique plus precis. */
export function distanceMetres(a: PointDiagnostic, b: PointDiagnostic): number {
  const versRadians = (d: number) => (d * Math.PI) / 180;
  const dLat = versRadians(b.latitude - a.latitude);
  const dLon = versRadians(b.longitude - a.longitude);
  const lat1 = versRadians(a.latitude);
  const lat2 = versRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Regroupe les points d'une meme maladie par proximite - composantes
 * connexes du graphe "a moins de RAYON_ALERTE_METRES l'un de l'autre" - puis
 * ne retient que les groupes assez grands pour signaler un foyer plutot
 * qu'une observation isolee. Pure : aucun acces IndexedDB, ce qui la rend
 * testable sans base de donnees simulee.
 */
export function detecterFoyers(points: PointDiagnostic[], maintenant: number): Foyer[] {
  const debut = maintenant - FENETRE_JOURS_ALERTE * 24 * 3600 * 1000;
  const recents = points.filter((p) => p.horodatage >= debut);

  const parMaladie = new Map<string, PointDiagnostic[]>();
  for (const p of recents) {
    const liste = parMaladie.get(p.classeId) ?? [];
    liste.push(p);
    parMaladie.set(p.classeId, liste);
  }

  const foyers: Foyer[] = [];

  for (const [classeId, liste] of parMaladie) {
    const visites = new Set<string>();

    for (const depart of liste) {
      if (visites.has(depart.id)) continue;

      // Parcours en largeur : la composante connexe de `depart` peut relier
      // des points au-dela du rayon direct, tant qu'un intermediaire les
      // relie - deux points a 350 m l'un de l'autre restent le meme foyer
      // s'ils passent tous les deux pres d'un troisieme.
      const groupe: PointDiagnostic[] = [];
      const file = [depart];
      visites.add(depart.id);

      while (file.length > 0) {
        const courant = file.shift() as PointDiagnostic;
        groupe.push(courant);
        for (const autre of liste) {
          if (visites.has(autre.id)) continue;
          if (distanceMetres(courant, autre) <= RAYON_ALERTE_METRES) {
            visites.add(autre.id);
            file.push(autre);
          }
        }
      }

      if (groupe.length >= SEUIL_POINTS_FOYER) {
        foyers.push({
          classeId,
          points: groupe.sort((a, b) => a.horodatage - b.horodatage),
        });
      }
    }
  }

  return foyers;
}

/** Lit l'historique local et en extrait les foyers actuels. Un seul point
 * par consultation (son fruit principal, hors sujet et sain exclus) : le
 * meme choix que la carte pour rester coherent avec ce que l'utilisateur y
 * voit deja (voir CarteFoyers.tsx). */
export async function foyersActuels(): Promise<Foyer[]> {
  const consultations = await historique();

  const points: PointDiagnostic[] = [];
  for (const c of consultations) {
    if (!c.position) continue;
    const principal = c.fruits.find((f) => !f.horsSujet);
    if (!principal || principal.classe.gravite === 'sain') continue;
    points.push({
      id: c.id,
      classeId: principal.classe.id,
      latitude: c.position.latitude,
      longitude: c.position.longitude,
      horodatage: c.horodatage,
    });
  }

  return detecterFoyers(points, Date.now());
}
