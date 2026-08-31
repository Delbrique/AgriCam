/**
 * Prise de vue.
 *
 * Une seule case pour la photo, sans attribut "capture" sur l'input : sur
 * mobile, le navigateur propose lui-meme le choix entre l'appareil photo et
 * la galerie, inutile de dupliquer ce choix avec deux boutons.
 *
 * A cote, la Tendance (historique reel) plutot qu'un widget decoratif ; et,
 * sous les deux cases, une astuce de sensibilisation generee par Groq (une
 * maladie differente a chaque visite, parmi les trois cultures reconnues),
 * avec repli sur une astuce locale hors ligne ou le temps que Groq reponde.
 */

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Lightbulb } from 'lucide-react';
import { Tendance } from './Tendance';
import { astuceEnLigne, astuceHorsLigne } from '../lib/astuce';
import type { Progression } from '../lib/pipeline';

interface Props {
  onImage: (fichier: File) => void;
  occupe: boolean;
  progression: Progression | null;
}

export function VueCapture({ onImage, occupe, progression }: Props) {
  const entree = useRef<HTMLInputElement>(null);
  const [astuce, setAstuce] = useState(astuceHorsLigne);

  useEffect(() => {
    let annule = false;
    astuceEnLigne().then((texte) => {
      if (!annule && texte) setAstuce(texte);
    });
    return () => {
      annule = true;
    };
  }, []);

  function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (fichier) onImage(fichier);
    e.target.value = ''; // permet de reprendre deux fois la meme photo
  }

  if (occupe) {
    return (
      <div className="flex flex-col items-center gap-e4 py-e7">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-trait"
          role="progressbar"
          aria-valuenow={Math.round((progression?.fraction ?? 0) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full bg-encre transition-[width] duration-[240ms] ease-in-out"
            style={{ width: `${(progression?.fraction ?? 0) * 100}%` }}
          />
        </div>
        <p className="text-sm text-encre-douce">{progression?.message ?? 'Analyse en cours'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-e4">
      <div className="flex items-center gap-e3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sain-fond text-sain"
          aria-hidden="true"
        >
          <Camera size={22} strokeWidth={1.75} />
        </span>
        <h2 className="text-xl tracking-[-0.025em]">Analyse d&apos;un fruit</h2>
      </div>
      <p className="-mt-e3 text-sm text-encre-douce">
        Photographiez un fruit de <strong className="font-semibold text-encre">tomate</strong>,{' '}
        <strong className="font-semibold text-encre">piment</strong> ou{' '}
        <strong className="font-semibold text-encre">oignon</strong> pour obtenir un diagnostic
        immédiat, sans connexion — ce sont les trois cultures reconnues par l'application.
      </p>

      <div className="grid grid-cols-2 gap-e3">
        <button
          className="flex aspect-[4/5] max-h-[320px] w-full flex-col items-center justify-center gap-e2 rounded-lg border border-dashed border-trait bg-carte px-e3 text-center hover:bg-trait/30"
          onClick={() => entree.current?.click()}
        >
          <span
            className="grid h-14 w-14 place-items-center rounded-xl bg-sain-fond text-sain"
            aria-hidden="true"
          >
            <ImageUp size={26} strokeWidth={1.75} />
          </span>
          <span className="font-titre text-md font-bold text-encre">Choisir une photo</span>
          <span className="text-xs text-encre-douce">PNG, JPG ou WebP</span>
        </button>

        <Tendance />
      </div>

      <div className="flex items-start gap-e3 rounded-lg border border-trait bg-carte p-e4">
        <span
          className="grid h-11 w-11 shrink-0 animate-pulse place-items-center rounded-xl bg-sain-fond text-sain"
          aria-hidden="true"
        >
          <Lightbulb size={22} strokeWidth={1.75} />
        </span>
        <div key={astuce} className="flex flex-col gap-0.5 animate-entree">
          <span className="font-titre text-sm font-bold text-encre">Le saviez-vous&nbsp;?</span>
          <p className="m-0 text-sm leading-[1.45] text-encre-douce">{astuce}</p>
        </div>
      </div>

      <input ref={entree} type="file" accept="image/*" onChange={choisir} hidden />
    </div>
  );
}
