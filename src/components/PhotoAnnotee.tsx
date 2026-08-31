/**
 * Photo d'origine surmontee des boites du detecteur.
 *
 * C'est la demonstration visuelle du pipeline hybride : on voit ce que le
 * detecteur a trouve, et la couleur de chaque boite dit deja l'etat du fruit
 * avant meme d'ouvrir le detail.
 */

import { couleurGravite, nomClasse } from '../lib/classes';
import type { DiagnosticFruit } from '../lib/pipeline';
import { useEffect, useRef, useState } from 'react';
import { useTraduction } from '../lib/traduction';

interface Props {
  photo: string;
  fruits: DiagnosticFruit[];
  selection: number;
  onSelection: (i: number) => void;
}

export function PhotoAnnotee({ photo, fruits, selection, onSelection }: Props) {
  const { t, langue } = useTraduction();
  const conteneur = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ largeur: 1, hauteur: 1 });

  // Les boites sont exprimees en pixels de l'apercu ; on les repositionne en
  // pourcentages pour qu'elles suivent le redimensionnement de l'image.
  useEffect(() => {
    const image = new Image();
    image.onload = () =>
      setDimensions({ largeur: image.width, hauteur: image.height });
    image.src = photo;
  }, [photo]);

  const unique = fruits.length === 1;

  return (
    <div
      className="relative mx-auto max-h-[300px] w-fit max-w-full overflow-hidden rounded-lg bg-encre leading-[0]"
      ref={conteneur}
    >
      <img
        className="block h-auto max-h-[300px] w-auto max-w-full"
        src={photo}
        alt={t.photoAnnotee.altPhoto}
      />

      {!unique &&
        fruits.map((fruit, i) => {
          const { boite } = fruit;
          const couleur = fruit.incertain || fruit.horsSujet
            ? 'var(--inconnu)'
            : couleurGravite(fruit.classe.gravite);
          const active = i === selection;

          return (
            <button
              key={i}
              className={`absolute min-h-0 rounded-[3px] border-[2.5px] bg-transparent p-0 ${active ? 'border-[4px] shadow-[0_0_0_2px_rgba(255,255,255,0.7)]' : ''}`}
              style={{
                left: `${(boite.x / dimensions.largeur) * 100}%`,
                top: `${(boite.y / dimensions.hauteur) * 100}%`,
                width: `${(boite.largeur / dimensions.largeur) * 100}%`,
                height: `${(boite.hauteur / dimensions.hauteur) * 100}%`,
                borderColor: couleur,
              }}
              onClick={() => onSelection(i)}
              aria-label={t.photoAnnotee.fruitLabel(
                i + 1,
                fruit.horsSujet ? t.photoAnnotee.photoNonReconnue : nomClasse(fruit.classe, langue),
              )}
              aria-pressed={i === selection}
            >
              <span
                className="donnee absolute -left-0.5 -top-0.5 grid h-[22px] min-w-[22px] place-items-center text-xs font-bold leading-none text-white"
                style={{ background: couleur }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
    </div>
  );
}
