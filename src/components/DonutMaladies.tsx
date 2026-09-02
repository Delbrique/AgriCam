/**
 * Repartition des maladies detectees - donut du tableau de bord.
 *
 * Alimente par repartitionMaladies (lib/tableauDeBord.ts), calculee a partir
 * du seul historique local. Les fruits sains ne sont pas representes : un
 * donut de repartition des MALADIES n'a pas a compter ce qui va bien.
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { couleursDistinctes, nomClasse } from '../lib/classes';
import type { PartMaladie } from '../lib/tableauDeBord';
import { useTraduction } from '../lib/traduction';

interface Props {
  donnees: PartMaladie[];
}

export function DonutMaladies({ donnees }: Props) {
  const { t, langue } = useTraduction();

  if (donnees.length === 0) {
    return <p className="m-0 text-sm text-encre-douce">{t.donutMaladies.aucune}</p>;
  }

  // Plusieurs maladies partagent souvent la meme gravite (donc la meme
  // couleur de base) : sans nuance par identite, leurs segments et pastilles
  // de legende seraient impossibles a distinguer les uns des autres.
  const couleurs = couleursDistinctes(donnees.map((d) => d.classe));
  const donneesPlates = donnees.map((d) => ({
    nom: nomClasse(d.classe, langue),
    nombre: d.nombre,
    couleur: couleurs[d.classe.id],
  }));

  return (
    <div className="flex flex-col gap-e3">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donneesPlates}
              dataKey="nombre"
              nameKey="nom"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {donneesPlates.map((d) => (
                <Cell key={d.nom} fill={d.couleur} />
              ))}
            </Pie>
            <Tooltip
              formatter={(valeur, _nom, item) => {
                const nombre = Number(valeur) || 0;
                const nom = (item?.payload as { nom?: string } | undefined)?.nom ?? '';
                return [t.donutMaladies.fruit(nombre), nom];
              }}
              contentStyle={{
                background: 'var(--carte)',
                border: '1px solid var(--trait)',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="m-0 flex flex-col gap-e2 p-0 text-sm">
        {donnees.map((d) => (
          <li key={d.classe.id} className="flex items-center gap-e2">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ background: couleurs[d.classe.id] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{nomClasse(d.classe, langue)}</span>
            <span className="donnee shrink-0 text-encre-douce">
              {d.nombre} · {Math.round(d.part * 100)}&nbsp;%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
