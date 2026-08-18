/**
 * Astuces de sensibilisation, affichees en rotation sur la page diagnostic.
 *
 * Meme exigence que la conduite a tenir (voir data/conduites.ts) : un fait qui
 * change une pratique, jamais une curiosite ornementale.
 */

export const ASTUCES: string[] = [
  'L’anthracnose se propage par les éclaboussures de pluie : arroser au pied plutôt que sur le feuillage limite sa progression.',
  'La pourriture apicale de la tomate n’est pas une maladie : c’est un manque de calcium lié à un arrosage irrégulier.',
  'Le virus de la maladie bronzée est transmis par les thrips, pas de plant à plant : il faut lutter contre l’insecte, pas seulement retirer les fruits atteints.',
  'Aucun fongicide ne soigne une bactérie. La tache bactérienne se prévient avec des traitements à base de cuivre ; elle ne se soigne pas après coup.',
  'Un bulbe d’oignon humide ou blessé ne doit jamais être stocké : une seule pourriture peut contaminer toute une caisse.',
  'Récolter les fruits mûrs sans attendre réduit les pertes : plus un fruit reste au champ, plus il est vulnérable aux champignons.',
];

export function astuceAleatoire(): string {
  return ASTUCES[Math.floor(Math.random() * ASTUCES.length)];
}
