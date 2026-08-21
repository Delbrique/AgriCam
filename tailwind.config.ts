import type { Config } from 'tailwindcss';

/**
 * Les couleurs pointent vers les variables CSS de src/styles/tokens.css, pas
 * vers des valeurs figees : le mode sombre (":root.dark") redefinit ces
 * memes variables, donc "bg-papier"/"text-encre"/etc. suivent le theme sans
 * le moindre "dark:" a ecrire au niveau des classes utilitaires.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        papier: 'var(--papier)',
        carte: 'var(--carte)',
        encre: 'var(--encre)',
        'encre-douce': 'var(--encre-douce)',
        trait: 'var(--trait)',
        accent: 'var(--accent)',
        'accent-survol': 'var(--accent-survol)',
        chrome: 'var(--chrome-fond)',
        'chrome-texte': 'var(--chrome-texte)',
        'chrome-texte-douce': 'var(--chrome-texte-douce)',
        sain: 'var(--sain)',
        alerte: 'var(--alerte)',
        atteint: 'var(--atteint)',
        grave: 'var(--grave)',
        inconnu: 'var(--inconnu)',
        'sain-fond': 'var(--sain-fond)',
        'alerte-fond': 'var(--alerte-fond)',
        'atteint-fond': 'var(--atteint-fond)',
        'grave-fond': 'var(--grave-fond)',
        'inconnu-fond': 'var(--inconnu-fond)',
      },
      fontFamily: {
        titre: ['var(--police-titre)', 'system-ui', 'sans-serif'],
        texte: ['var(--police-texte)', 'system-ui', 'sans-serif'],
        donnee: ['var(--police-donnee)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: 'var(--t-xs)',
        sm: 'var(--t-sm)',
        md: 'var(--t-md)',
        base: 'var(--t-md)',
        lg: 'var(--t-lg)',
        xl: 'var(--t-xl)',
        '2xl': 'var(--t-2xl)',
      },
      spacing: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
        e4: 'var(--e4)',
        e5: 'var(--e5)',
        e6: 'var(--e6)',
        e7: 'var(--e7)',
      },
      borderRadius: {
        DEFAULT: 'var(--rayon)',
        lg: 'var(--rayon-l)',
      },
      minHeight: {
        cible: 'var(--cible)',
      },
      minWidth: {
        cible: 'var(--cible)',
      },
      boxShadow: {
        carte: 'var(--ombre)',
      },
      maxWidth: {
        page: 'var(--largeur-max)',
      },
      keyframes: {
        entree: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Meme principe que "entree", mais un peu plus ample : utilisee au
        // premier defilement d'une section dans la vue (voir
        // ApparitionAuDefilement.tsx), pas a chaque changement de contenu.
        monteeEntree: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Halo doux, pour un moment de satisfaction bref (ex. badge "pret
        // hors ligne" qui vient de passer au vert) - pas une boucle infinie.
        lueur: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(31, 122, 77, 0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(31, 122, 77, 0.18)' },
        },
        // Petit balancement de cloche, pour signaler une nouvelle alerte
        // sans etre aussi insistant qu'un clignotement.
        sonnerie: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-12deg)' },
          '40%': { transform: 'rotate(10deg)' },
          '60%': { transform: 'rotate(-6deg)' },
          '80%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        // Petite transition d'apparition, utilisee avec key={...} pour
        // rejouer l'animation a chaque changement de contenu (ex. l'astuce
        // de sensibilisation quand Groq remplace le repli local).
        entree: 'entree 420ms ease-out',
        'montee-entree': 'monteeEntree 560ms cubic-bezier(0.16, 1, 0.3, 1)',
        lueur: 'lueur 1.8s ease-out 2',
        sonnerie: 'sonnerie 700ms ease-in-out 1',
      },
      // Paliers reellement utilises par le CSS existant, en plus des
      // breakpoints par defaut de Tailwind (sm/md/lg/xl/2xl) - conserves
      // pour ne pas changer le comportement responsive deja regle.
      screens: {
        'bp480': '480px',
        'bp520': '520px',
        'bp560': '560px',
        'bp600': '600px',
        'bp640': '640px',
        'bp860': '860px',
        'bp900': '900px',
        'bp1000': '1000px',
      },
    },
  },
  plugins: [],
} satisfies Config;
