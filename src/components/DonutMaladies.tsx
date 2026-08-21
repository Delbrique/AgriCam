/**
 * Repartition des maladies detectees - donut du tableau de bord.
 *
 * Alimente par repartitionMaladies (lib/tableauDeBord.ts), calculee a partir
 * du seul historique local. Les fruits sains ne sont pas representes : un
 * donut de repartition des MALADIES n'a pas a compter ce qui va bien.
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { COULEUR_GRAVITE_HEX } from '../lib/classes';
import type { PartMaladie } from '../lib/tableauDeBord';

interface Props {
  donnees: PartMaladie[];
}

export function DonutMaladies({ donnees }: Props) {
  if (donnees.length === 0) {
    return (
      <p className="m-0 text-sm text-encre-douce">
        Aucune maladie détectée pour l&apos;instant.
      </p>
    );
  }

  const donneesPlates = donnees.map((d) => ({
    nom: d.classe.nom,
    nombre: d.nombre,
    couleur: COULEUR_GRAVITE_HEX[d.classe.gravite],
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
                return [`${nombre} fruit${nombre > 1 ? 's' : ''}`, nom];
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
              style={{ background: COULEUR_GRAVITE_HEX[d.classe.gravite] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{d.classe.nom}</span>
            <span className="donnee shrink-0 text-encre-douce">
              {d.nombre} · {Math.round(d.part * 100)}&nbsp;%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
