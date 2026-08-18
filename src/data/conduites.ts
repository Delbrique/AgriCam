/**
 * Conduite a tenir, par etat sanitaire.
 *
 * C'est le contenu qui justifie l'existence de l'outil. Un producteur ouvre
 * l'application parce qu'il ne sait pas ce qu'a son fruit ; lui repondre par
 * un nom de maladie sans lui dire quoi faire ne change rien a sa recolte.
 *
 * Trois principes de redaction :
 *
 *   - Des gestes, pas des concepts. « Retirez le fruit et enfouissez-le loin
 *     des pieds » plutot que « procedez a l'assainissement sanitaire ».
 *   - Ce qu'il NE FAUT PAS faire compte autant. La pourriture apicale est un
 *     trouble physiologique : traiter au fongicide coute de l'argent et ne
 *     sert a rien. C'est une erreur frequente et couteuse.
 *   - Aucune posologie precise. Les produits homologues varient selon les
 *     pays et les annees ; l'application oriente, elle ne prescrit pas. Le
 *     choix du produit et sa dose relevent d'un technicien.
 */

export type Urgence = 'aucune' | 'surveiller' | 'sous_48h' | 'immediat';

export interface Conduite {
  /** Delai dans lequel agir. */
  urgence: Urgence;
  /** Phrase unique resumant la situation, en langage de terrain. */
  resume: string;
  /** Gestes a poser, dans l'ordre. */
  gestes: string[];
  /** Erreur courante a eviter, quand il y en a une. */
  eviter?: string;
  /** Comment limiter la reapparition la saison suivante. */
  prevention?: string;
}

export const LIBELLE_URGENCE: Record<Urgence, string> = {
  aucune: 'Rien à faire',
  surveiller: 'À surveiller',
  sous_48h: 'Agir sous 48 heures',
  immediat: 'Agir aujourd’hui',
};

export const CONDUITES: Record<string, Conduite> = {
  Onion___Diseased: {
    urgence: 'sous_48h',
    resume:
      'Ce bulbe est atteint. Le danger principal est la contamination du reste de la récolte au stockage.',
    gestes: [
      'Écartez ce bulbe des bulbes sains, dès maintenant.',
      'Inspectez les bulbes voisins dans la même caisse ou le même rang.',
      'Faites sécher les bulbes sains à l’air libre avant de les stocker.',
      'Ne stockez jamais un bulbe humide ou blessé.',
    ],
    eviter:
      'Ne remettez pas ce bulbe dans le tas en pensant le trier plus tard : une seule pourriture contamine une caisse entière.',
    prevention:
      'Récoltez par temps sec, laissez ressuyer au champ, et stockez dans un endroit aéré.',
  },

  Onion___Healthy: {
    urgence: 'aucune',
    resume: 'Ce bulbe est sain.',
    gestes: [
      'Poursuivez la récolte normalement.',
      'Vérifiez quelques bulbes par rang plutôt qu’un seul, pour avoir une idée du lot.',
    ],
  },

  Pepper___Anthracnose: {
    urgence: 'sous_48h',
    resume:
      'Champignon qui se propage par les éclaboussures de pluie et d’arrosage. Les fruits touchés ne se rattrapent pas.',
    gestes: [
      'Retirez les fruits atteints et enfouissez-les loin de la parcelle.',
      'Récoltez les fruits mûrs sans attendre : ce sont les plus vulnérables.',
      'Arrosez au pied, jamais sur le feuillage.',
      'Voyez un technicien pour un traitement fongicide homologué.',
    ],
    eviter:
      'Ne laissez pas les fruits atteints au sol : ils réensemencent la parcelle à chaque pluie.',
    prevention:
      'Espacez les plants pour que le feuillage sèche vite, et évitez de replanter du piment au même endroit deux saisons de suite.',
  },

  Pepper___Healthy: {
    urgence: 'aucune',
    resume: 'Ce piment est sain.',
    gestes: [
      'Poursuivez la récolte normalement.',
      'Repassez dans une semaine : l’anthracnose apparaît souvent après une période pluvieuse.',
    ],
  },

  Tomato___Anthracnose: {
    urgence: 'sous_48h',
    resume:
      'Champignon des fruits mûrs, favorisé par la pluie et la chaleur. Il progresse vite en saison humide.',
    gestes: [
      'Retirez les fruits atteints et enfouissez-les hors de la parcelle.',
      'Récoltez les tomates à maturité sans attendre : un fruit trop mûr est bien plus vulnérable.',
      'Arrosez au pied, tôt le matin.',
      'Voyez un technicien pour un traitement fongicide homologué.',
    ],
    eviter:
      'Ne compostez pas les fruits atteints avec les déchets qui retourneront au champ.',
    prevention:
      'Tuteurez les plants pour éloigner les fruits du sol, et paillez pour limiter les éclaboussures.',
  },

  Tomato___Bacterial_Spot: {
    urgence: 'immediat',
    resume:
      'Bactérie qui se transmet par l’eau, les outils et les mains. Elle se répand d’un plant à l’autre très rapidement.',
    gestes: [
      'Retirez les fruits et les feuilles atteints aujourd’hui même.',
      'Ne travaillez pas dans la parcelle quand le feuillage est mouillé.',
      'Lavez vos mains et vos outils avant de passer à un autre rang.',
      'Voyez un technicien : les traitements à base de cuivre sont les seuls réellement utiles, et seulement en préventif.',
    ],
    eviter:
      'Aucun fongicide ne soigne une bactérie. Traiter au fongicide ici, c’est dépenser sans effet.',
    prevention:
      'Utilisez des semences saines, pratiquez la rotation, et évitez l’arrosage par aspersion.',
  },

  Tomato___Blossom_end_rot: {
    urgence: 'surveiller',
    resume:
      'Ce n’est pas une maladie. C’est un trouble de nutrition : la plante n’a pas pu amener assez de calcium jusqu’au fruit, presque toujours parce que les arrosages sont irréguliers.',
    gestes: [
      'Retirez les fruits touchés : ils ne se rétabliront pas.',
      'Arrosez régulièrement, en petites quantités fréquentes plutôt qu’un gros apport espacé.',
      'Paillez le pied pour que le sol garde son humidité.',
      'Faites analyser le sol si le problème revient chaque saison.',
    ],
    eviter:
      'Ne traitez surtout pas au fongicide : rien ne se transmet, et le problème reviendra tant que l’arrosage sera irrégulier.',
    prevention:
      'Un apport de calcium au sol avant plantation aide, mais la régularité de l’eau reste le facteur principal.',
  },

  Tomato___Healthy: {
    urgence: 'aucune',
    resume: 'Cette tomate est saine.',
    gestes: [
      'Poursuivez la récolte normalement.',
      'Contrôlez plusieurs fruits sur des pieds différents : un fruit sain ne garantit pas une parcelle saine.',
    ],
  },

  Tomato___Spotted_wilt_Virus: {
    urgence: 'immediat',
    resume:
      'Virus transmis par les thrips, de minuscules insectes. Un plant infecté ne guérit pas : il devient une source de contamination pour toute la parcelle.',
    gestes: [
      'Arrachez le plant entier aujourd’hui, pas seulement le fruit.',
      'Sortez-le de la parcelle et brûlez-le ou enfouissez-le profondément.',
      'Inspectez les plants voisins : feuilles bronzées, anneaux concentriques sur les fruits.',
      'Voyez un technicien pour lutter contre les thrips, seule action réellement préventive.',
    ],
    eviter:
      'Ne vous contentez pas de retirer les fruits atteints : le virus est dans toute la plante, et les thrips continueront de le diffuser.',
    prevention:
      'Éliminez les mauvaises herbes autour de la parcelle, qui abritent les thrips entre deux cultures.',
  },
};

export function conduitePour(classeId: string): Conduite | undefined {
  return CONDUITES[classeId];
}
