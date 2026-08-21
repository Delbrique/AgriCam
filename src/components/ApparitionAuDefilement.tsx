/**
 * Fait apparaitre son contenu (fondu + legere montee) la premiere fois qu'il
 * entre dans la zone visible, plutot que tout afficher d'un bloc au
 * chargement - c'est ce qui donne au tableau de bord une sensation de
 * defilement vivant plutot que statique.
 *
 * Ne se declenche qu'une fois par montage (pas a chaque passage), et ne
 * fait rien du tout si l'utilisateur a demande moins de mouvement
 * (prefers-reduced-motion, deja respecte globalement - voir tailwind.css) :
 * le contenu reste alors simplement visible tout de suite.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Decalage en ms, pour faire apparaitre plusieurs blocs en cascade
   * plutot que tous en meme temps. */
  delai?: number;
  className?: string;
}

export function ApparitionAuDefilement({ children, delai = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${visible ? 'animate-montee-entree' : 'opacity-0'} ${className ?? ''}`}
      style={visible ? { animationDelay: `${delai}ms`, animationFillMode: 'backwards' } : undefined}
    >
      {children}
    </div>
  );
}
