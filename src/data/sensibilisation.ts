/**
 * Astuces de sensibilisation, affichees en rotation sur la page diagnostic.
 *
 * Meme exigence que la conduite a tenir (voir data/conduites.ts) : un fait qui
 * change une pratique, jamais une curiosite ornementale. Bilingue (contrairement
 * a la conduite a tenir elle-meme, plus longue) : ce fait tient en une phrase,
 * le traduire est un cout raisonnable pour une astuce toujours visible a
 * l'ecran, meme quand l'interface est basculee en anglais.
 */

interface Astuce {
  fr: string;
  en: string;
}

export const ASTUCES: Astuce[] = [
  {
    fr: 'L’anthracnose se propage par les éclaboussures de pluie : arroser au pied plutôt que sur le feuillage limite sa progression.',
    en: 'Anthracnose spreads through rain splashes: watering at the base rather than the foliage slows its spread.',
  },
  {
    fr: 'La pourriture apicale de la tomate n’est pas une maladie : c’est un manque de calcium lié à un arrosage irrégulier.',
    en: "Blossom end rot on tomatoes isn't a disease: it's a calcium deficiency caused by irregular watering.",
  },
  {
    fr: 'Le virus de la maladie bronzée est transmis par les thrips, pas de plant à plant : il faut lutter contre l’insecte, pas seulement retirer les fruits atteints.',
    en: 'Tomato spotted wilt virus is spread by thrips, not plant to plant: you need to control the insect, not just remove the affected fruit.',
  },
  {
    fr: 'Aucun fongicide ne soigne une bactérie. La tache bactérienne se prévient avec des traitements à base de cuivre ; elle ne se soigne pas après coup.',
    en: "No fungicide cures a bacterium. Bacterial spot is prevented with copper-based treatments; it can't be cured after the fact.",
  },
  {
    fr: 'Un bulbe d’oignon humide ou blessé ne doit jamais être stocké : une seule pourriture peut contaminer toute une caisse.',
    en: 'A damp or damaged onion bulb should never be stored: a single rotten one can contaminate an entire crate.',
  },
  {
    fr: 'Récolter les fruits mûrs sans attendre réduit les pertes : plus un fruit reste au champ, plus il est vulnérable aux champignons.',
    en: 'Harvesting ripe fruit promptly reduces losses: the longer a fruit stays in the field, the more vulnerable it is to fungi.',
  },
];

export function astuceAleatoire(langue: 'fr' | 'en'): string {
  const astuce = ASTUCES[Math.floor(Math.random() * ASTUCES.length)];
  return langue === 'en' ? astuce.en : astuce.fr;
}
