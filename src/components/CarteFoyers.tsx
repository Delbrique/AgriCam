/**
 * Carte des foyers - localisation personnelle.
 *
 * Chaque diagnostic geolocalise devient un point colore selon sa gravite :
 * pas besoin de drone ni de capteur GPS dedie, le telephone du producteur en
 * tient deja lieu (la position est capturee au moment de la photo, voir
 * positionActuelle() dans pages/Diagnostic.tsx). Sert a reperer, DANS SON
 * PROPRE CHAMP, ou se trouvent les foyers au fil des visites.
 *
 * Entierement local : cette carte n'affiche que l'historique de CE telephone
 * (voir lib/stockage.ts) - aucune donnee n'est envoyee, aucun serveur partage
 * entre producteurs. Coherent avec le reste de l'application.
 *
 * Le bulbe d'oignon n'est visible qu'une fois deterre : une carte "ou dans le
 * champ" a donc surtout un sens pour la tomate et le piment, dont l'etat se
 * lit sur le fruit en place. Le filtre par culture reste neanmoins disponible
 * pour l'oignon, au cas ou des bulbes deterres auraient ete geolocalises.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  historique,
  parcelles,
  rattacherConsultation,
  type Consultation,
  type Parcelle,
} from '../lib/stockage';
import type { Foyer } from '../lib/alerte';
import { COULEUR_GRAVITE_HEX, nomClasse, type Gravite } from '../lib/classes';
import { useTraduction } from '../lib/traduction';
import { GestionParcelles } from './GestionParcelles';

type FiltreCulture = 'toutes' | 'tomate' | 'piment' | 'oignon';

const CENTRE_DEFAUT: [number, number] = [3.848, 11.502]; // Yaounde, repli si aucune donnee.
/** Zoom "quartier" : assez precis pour lire les noms de rues, quand la carte
 * n'a que la position actuelle a montrer (pas encore de diagnostic autour). */
const ZOOM_QUARTIER = 16;

/** Echappe le texte injecte dans les popups Leaflet, construites comme des
 * chaines HTML : indispensable des qu'un champ vient de l'utilisateur (le
 * nom d'une parcelle), sous peine d'injection HTML stockee. */
const ENTITES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ENTITES_HTML[c]);
}

/** Traduit des coordonnees en nom de lieu lisible, via Nominatim
 * (OpenStreetMap) - meme fournisseur que les tuiles, gratuit, sans cle.
 * Echoue silencieusement (hors ligne, service indisponible) : la carte reste
 * utilisable sans ce texte, seul le point bleu suffit deja a se reperer. */
async function quartierDepuisPosition(lat: number, lon: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      zoom: '16',
      addressdetails: '1',
    });
    const reponse = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!reponse.ok) return null;

    const donnees = await reponse.json();
    const adresse = donnees.address ?? {};
    const quartier =
      adresse.suburb || adresse.neighbourhood || adresse.quarter || adresse.city_district;
    const ville = adresse.city || adresse.town || adresse.village || adresse.municipality;

    const lieu = [quartier, ville].filter(Boolean).join(', ');
    return lieu || donnees.display_name || null;
  } catch {
    return null;
  }
}

export function CarteFoyers() {
  const { t, langue } = useTraduction();
  const FILTRES: { valeur: FiltreCulture; libelle: string }[] = [
    { valeur: 'toutes', libelle: t.commun.cultures.toutes },
    { valeur: 'tomate', libelle: t.commun.cultures.tomate },
    { valeur: 'piment', libelle: t.commun.cultures.piment },
    { valeur: 'oignon', libelle: t.commun.cultures.oignon },
  ];
  const LIBELLE_GRAVITE: Record<Gravite, string> = {
    sain: t.carteFoyers.graviteSain,
    alerte: t.carteFoyers.graviteAlerte,
    atteint: t.carteFoyers.graviteAtteint,
    grave: t.carteFoyers.graviteGrave,
  };
  const conteneurRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<L.Map | null>(null);
  const coucheRef = useRef<L.LayerGroup | null>(null);
  const [consultations, setConsultations] = useState<Consultation[] | null>(null);
  const [filtre, setFiltre] = useState<FiltreCulture>('toutes');
  const [positionActuelle, setPositionActuelle] = useState<L.LatLng | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);
  const [listeParcelles, setListeParcelles] = useState<Parcelle[]>([]);
  const [versionRattachements, setVersionRattachements] = useState(0);

  // Arrivee depuis la cloche de notifications (voir NotificationsFoyers.tsx).
  // La carte etant desormais toujours montee sur le tableau de bord (au lieu
  // d'une page /carte dediee), un clic depuis la cloche alors qu'on est deja
  // sur cette page ne remonte pas le composant : sans cet effet, le nouvel
  // etat de navigation serait ignore. Consomme puis efface, sinon le
  // cadrage automatique ci-dessous le reprendrait a chaque redessin.
  const emplacement = useLocation();
  const foyerACentrerRef = useRef<Foyer | undefined>(
    (emplacement.state as { foyerACentrer?: Foyer } | null)?.foyerACentrer,
  );

  useEffect(() => {
    const foyer = (emplacement.state as { foyerACentrer?: Foyer } | null)?.foyerACentrer;
    if (foyer) foyerACentrerRef.current = foyer;
  }, [emplacement.state]);

  useEffect(() => {
    historique().then(setConsultations);
    rechargerParcelles();
  }, []);

  function rechargerParcelles() {
    parcelles().then(setListeParcelles);
  }

  function centrerSurParcelle(p: Parcelle) {
    if (!p.position || !carteRef.current) return;
    carteRef.current.setView([p.position.latitude, p.position.longitude], ZOOM_QUARTIER);
  }

  function centrerSurFoyer(foyer: Foyer) {
    if (!carteRef.current || foyer.points.length === 0) return;
    const points: [number, number][] = foyer.points.map((p) => [p.latitude, p.longitude]);
    if (points.length === 1) {
      carteRef.current.setView(points[0], ZOOM_QUARTIER);
    } else {
      carteRef.current.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 17 });
    }
  }

  const geolocalisees = (consultations ?? []).filter(
    (c) => c.position && c.fruits.some((f) => !f.horsSujet),
  );
  const filtrees = geolocalisees.filter(
    (c) =>
      filtre === 'toutes' ||
      c.fruits.some((f) => !f.horsSujet && f.classe.culture === filtre),
  );

  // Initialisation de la carte, une seule fois au montage : la carte est
  // toujours visible, meme sans aucun point encore geolocalise - c'est ce
  // qui montre a l'utilisateur que la fonctionnalite existe et attend ses
  // prochains diagnostics, plutot qu'un ecran vide en attendant les donnees.
  useEffect(() => {
    if (!conteneurRef.current || carteRef.current) return;
    const conteneur = conteneurRef.current;

    const carte = L.map(conteneur, { zoomControl: true }).setView(CENTRE_DEFAUT, 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(carte);

    carteRef.current = carte;
    coucheRef.current = L.layerGroup().addTo(carte);

    // Leaflet mesure la taille de son conteneur a l'initialisation ; dans une
    // mise en page flex/grid, cette taille n'est pas toujours stable au tout
    // premier rendu (polices, mise en page qui finit de se calculer), ce qui
    // faussait le zoom et la position affiches. Un ResizeObserver corrige la
    // vue des que la taille reelle est connue, et a chaque redimensionnement
    // ulterieur (rotation d'ecran, bascule clavier).
    const observateur = new ResizeObserver(() => carte.invalidateSize());
    observateur.observe(conteneur);
    // Filet de securite : sur certains navigateurs mobiles, la toute
    // premiere mesure (au montage, avant que la mise en page en flexbox
    // imbriquee n'ait fini de se stabiliser) peut rester trop large tant
    // qu'aucun redimensionnement reel ne se produit par la suite - un
    // second passage juste apres le premier rendu corrige cette taille
    // initiale sans attendre un evenement de redimensionnement.
    requestAnimationFrame(() => carte.invalidateSize());

    // Position actuelle de l'utilisateur : un repere meme sans historique,
    // pour que la carte ne paraisse jamais "vide" au premier lancement. Le
    // cadrage (setView/fitBounds) est laisse a l'effet suivant, qui l'unifie
    // avec les points de diagnostic pour eviter que les deux ne se disputent
    // la vue de la carte.
    function surPositionTrouvee(e: L.LocationEvent) {
      setPositionActuelle(e.latlng);
      quartierDepuisPosition(e.latlng.lat, e.latlng.lng).then(setQuartier);
    }
    carte.on('locationfound', surPositionTrouvee);
    carte.locate({ setView: false, maxZoom: 14 });

    // Rattachement d'une consultation a une parcelle depuis son infobulle :
    // le <select> est construit en HTML brut (voir l'effet suivant), on lui
    // branche donc son ecouteur ici, a l'ouverture de la popup qui le
    // contient - c'est le seul moment ou il existe reellement dans le DOM.
    function surPopupOuvert(e: L.PopupEvent) {
      const conteneurPopup = e.popup.getElement();
      const select = conteneurPopup?.querySelector<HTMLSelectElement>(
        'select[data-consultation-id]',
      );
      if (!select) return;
      const id = select.dataset.consultationId as string;
      select.addEventListener('change', async () => {
        const parcelleId = select.value || undefined;
        await rattacherConsultation(id, parcelleId);
        setConsultations((liste) =>
          liste ? liste.map((c) => (c.id === id ? { ...c, parcelleId } : c)) : liste,
        );
        setVersionRattachements((v) => v + 1);
      });
    }
    carte.on('popupopen', surPopupOuvert);

    return () => {
      observateur.disconnect();
      carte.off('locationfound', surPositionTrouvee);
      carte.off('popupopen', surPopupOuvert);
      carte.remove();
      carteRef.current = null;
      coucheRef.current = null;
    };
  }, []);

  // Redessine les points a chaque changement de filtre ou de donnees, et
  // cadre la vue pour englober a la fois les diagnostics et la position
  // actuelle (quand elle est connue) - un seul cadrage, pas deux qui se
  // disputent la vue.
  useEffect(() => {
    const carte = carteRef.current;
    const couche = coucheRef.current;
    if (!carte || !couche) return;

    couche.clearLayers();

    if (positionActuelle) {
      L.circleMarker(positionActuelle, {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#1a73e8',
        fillOpacity: 1,
      })
        .bindPopup(quartier ? t.carteFoyers.vousEtesIciLieu(quartier) : t.carteFoyers.vousEtesIci)
        .addTo(couche);
    }

    filtrees.forEach((c) => {
      const { latitude, longitude } = c.position as { latitude: number; longitude: number };
      const principal = c.fruits.find((f) => !f.horsSujet) ?? c.fruits[0];
      const couleur = COULEUR_GRAVITE_HEX[c.graviteGlobale];
      const date = new Date(c.horodatage).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const optionsParcelle = listeParcelles
        .map(
          (p) =>
            `<option value="${p.id}"${c.parcelleId === p.id ? ' selected' : ''}>${echapperHtml(p.nom)}</option>`,
        )
        .join('');
      const selecteurParcelle =
        listeParcelles.length > 0
          ? `<label style="display:block;margin-top:6px;font-size:12px;">${t.carteFoyers.parcelle}` +
            `<select data-consultation-id="${c.id}" style="display:block;width:100%;margin-top:2px;">` +
            `<option value="">${t.carteFoyers.aucuneParcelle}</option>${optionsParcelle}</select></label>`
          : '';

      L.circleMarker([latitude, longitude], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: couleur,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${echapperHtml(nomClasse(principal.classe, langue))}</strong><br>` +
            `${LIBELLE_GRAVITE[c.graviteGlobale]} &middot; ${date}` +
            selecteurParcelle,
        )
        .addTo(couche);
    });

    const points: [number, number][] = filtrees.map((c) => {
      const { latitude, longitude } = c.position as { latitude: number; longitude: number };
      return [latitude, longitude];
    });
    if (positionActuelle) points.push([positionActuelle.lat, positionActuelle.lng]);

    if (points.length === 1) {
      // Un seul repere (le plus souvent : la position actuelle, sans encore
      // de diagnostic autour) - un cadrage direct au niveau quartier, plutot
      // qu'un fitBounds qui n'a rien a "englober" sur un point unique.
      carte.setView(points[0], ZOOM_QUARTIER);
    } else if (points.length > 1) {
      const limites = L.latLngBounds(points);
      carte.fitBounds(limites.pad(0.3), { maxZoom: 15 });
    }

    // Prioritaire sur le cadrage ci-dessus, mais une seule fois : sans quoi
    // chaque redessin (changement de filtre, nouveau point) reviendrait
    // recentrer sur le foyer au lieu de laisser l'utilisateur naviguer.
    if (foyerACentrerRef.current) {
      centrerSurFoyer(foyerACentrerRef.current);
      foyerACentrerRef.current = undefined;
      // La carte n'est qu'une section parmi d'autres sur le tableau de bord
      // (KPI, graphiques... la precedent) : sans ce scroll, "Localiser ce
      // foyer" fermait juste le panneau de notifications sans amener
      // visuellement la carte a l'ecran, laissant croire que le clic n'avait
      // rien fait.
      conteneurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [filtrees, positionActuelle, quartier, listeParcelles, emplacement.state, langue]);

  return (
    <div className="flex min-w-0 flex-col gap-e4">
      {consultations !== null && geolocalisees.length === 0 && (
        <p className="avis avis--attention">{t.carteFoyers.aucunGeolocalise}</p>
      )}

      {positionActuelle && (
        <p className="m-0 flex items-center gap-e2 text-sm text-encre">
          <span
            className="h-[10px] w-[10px] shrink-0 rounded-full"
            style={{ background: '#1a73e8' }}
            aria-hidden="true"
          />
          <strong>{t.carteFoyers.vousEtesIci}&nbsp;:</strong>{' '}
          {quartier ?? t.carteFoyers.localisationEnCours}
        </p>
      )}

      <div className="flex flex-wrap gap-e2">
        {FILTRES.map(({ valeur, libelle }) => (
          <button
            key={valeur}
            className={
              filtre === valeur
                ? 'min-h-[40px] rounded border border-encre bg-encre px-e3 text-sm font-semibold text-papier'
                : 'min-h-[40px] rounded border border-trait bg-transparent px-e3 text-sm font-semibold text-encre hover:bg-trait/30'
            }
            onClick={() => setFiltre(valeur)}
            aria-pressed={filtre === valeur}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div
        ref={conteneurRef}
        className="h-[420px] w-full overflow-hidden rounded-lg border border-trait"
      />

      <div className="flex flex-wrap gap-e4">
        <span className="flex items-center gap-e2 text-sm text-encre-douce">
          <span
            className="h-[10px] w-[10px] shrink-0 rounded-full"
            style={{ background: '#1a73e8' }}
            aria-hidden="true"
          />
          {t.carteFoyers.vousEtesIci}
        </span>
        {(Object.keys(LIBELLE_GRAVITE) as Gravite[]).map((g) => (
          <span key={g} className="flex items-center gap-e2 text-sm text-encre-douce">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ background: COULEUR_GRAVITE_HEX[g] }}
              aria-hidden="true"
            />
            {LIBELLE_GRAVITE[g]}
          </span>
        ))}
      </div>

      {geolocalisees.length > 0 && filtrees.length === 0 && (
        <p className="m-0 text-sm text-encre-douce">
          {t.carteFoyers.aucunGeolocaliseCulture}
        </p>
      )}

      <GestionParcelles
        parcelles={listeParcelles}
        positionActuelle={
          positionActuelle
            ? { latitude: positionActuelle.lat, longitude: positionActuelle.lng }
            : null
        }
        onParcellesChangees={rechargerParcelles}
        rattachementsVersion={versionRattachements}
        onSelectionner={centrerSurParcelle}
      />
    </div>
  );
}
