"""
================================================================================
 AgriCam - diagnostic : pourquoi les poids ne se chargent-ils pas ?
================================================================================

Le controle empirique a donne 11,7 % d'exactitude, soit exactement le hasard
pour neuf classes : `load_weights(..., by_name=True)` n'a apparie aucune
couche, et n'a rien signale - c'est son comportement normal, et c'est ce qui
rend la panne muette.

Plutot que de continuer a deviner, ce script ouvre les fichiers .h5 et affiche
ce qu'ils contiennent vraiment : structure, noms de couches, formes des poids.

    conda activate agricam
    cd Documents\\VENV\\bases_python\\Soutenance\\agricam
    python scripts\\inspecter_h5.py

Envoyez-moi la sortie complete.
================================================================================
"""

from __future__ import annotations

import json
import pathlib
import traceback

import h5py
import numpy as np

# Dossiers a ne jamais explorer : ils contiennent les fichiers .h5 de test
# des bibliotheques installees, qui n'ont rien a voir avec le projet.
IGNORES = {
    "node_modules", ".git", "__pycache__", "dist", "public",
    "site-packages", "Lib", "lib", "envs", "tests", ".venv", "Scripts",
}
COTE = 224


def racines() -> list[pathlib.Path]:
    vues: set[pathlib.Path] = set()
    sortie: list[pathlib.Path] = []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


def tous_les_h5() -> list[pathlib.Path]:
    """
    Les .h5 du projet, sans doublon.

    On ne balaie pas tous les .h5 rencontres : les bibliotheques installees en
    embarquent (h5py livre ses propres fichiers de test), et les inspecter n'a
    aucun sens. On cible donc les emplacements ou vivent les artefacts du
    projet.
    """
    motifs = ["modeles/*.h5", "**/modeles/*.h5", "agricam*.h5", "**/agricam*.h5"]
    vus: set[pathlib.Path] = set()
    for racine in racines():
        for motif in motifs:
            for chemin in sorted(racine.glob(motif)):
                if chemin.is_file() and not any(p in IGNORES for p in chemin.parts):
                    vus.add(chemin.resolve())
    return sorted(vus)


def titre(texte: str) -> None:
    print("\n" + "=" * 70)
    print(f" {texte}")
    print("=" * 70)


def inspecter(chemin: pathlib.Path) -> None:
    """
    Ouvre le fichier en HDF5 brut, sans passer par Keras.

    Deux formats sont possibles et se distinguent par la presence de
    l'attribut `model_config` :
      - modele complet (`model.save`)  : architecture + poids
      - poids seuls (`model.save_weights`) : poids uniquement
    C'est cette distinction qui commande la maniere de recharger.
    """
    titre(f"FICHIER : {chemin.name}   ({chemin.stat().st_size / 1024**2:.1f} Mo)")
    print(f"Chemin complet : {chemin}")

    with h5py.File(chemin, "r") as f:
        attributs = dict(f.attrs)
        print(f"\nAttributs racine : {list(attributs.keys())}")

        if "keras_version" in attributs:
            print(f"  keras_version  : {attributs['keras_version']}")
        if "backend" in attributs:
            print(f"  backend        : {attributs['backend']}")

        complet = "model_config" in attributs
        print(f"\nType : {'MODELE COMPLET' if complet else 'POIDS SEULS'}")

        if complet:
            config = attributs["model_config"]
            if isinstance(config, bytes):
                config = config.decode("utf-8")
            try:
                arbre = json.loads(config)
                nom = arbre.get("config", {}).get("name")
                couches = arbre.get("config", {}).get("layers", [])
                print(f"  nom du modele  : {nom}")
                print(f"  couches        : {len(couches)}")
                print("\n  Architecture enregistree :")
                for c in couches:
                    classe = c.get("class_name")
                    nom_c = c.get("config", {}).get("name")
                    print(f"    {classe:<26} {nom_c}")
            except Exception as e:
                print(f"  (config illisible : {e})")

        print(f"\nGroupes de premier niveau : {list(f.keys())}")

        groupe = f["model_weights"] if "model_weights" in f else f
        noms = list(groupe.keys())
        print(f"\nCouches porteuses de poids ({len(noms)}) :")

        for nom in noms:
            sous = groupe[nom]
            formes = []

            if isinstance(sous, h5py.Dataset):
                # Structure plate : la couche porte directement son tenseur.
                formes.append((nom, sous.shape))
            else:
                def collecter(cle, objet):
                    if isinstance(objet, h5py.Dataset):
                        formes.append((cle, objet.shape))

                sous.visititems(collecter)
            print(f"\n  --- {nom}  ({len(formes)} tenseurs)")
            for cle, forme in formes[:4]:
                print(f"        {cle:<52} {forme}")
            if len(formes) > 4:
                print(f"        ... et {len(formes) - 4} autres")

            # La couche de decision est celle qui nous interesse le plus :
            # sa forme doit etre (1536, 9), et ses valeurs ne doivent pas
            # ressembler a une initialisation aleatoire.
            for cle, forme in formes:
                if len(forme) == 2 and forme[1] == 9:
                    donnees = np.array(sous if isinstance(sous, h5py.Dataset) else sous[cle])
                    print(
                        f"        -> couche de decision : moyenne {donnees.mean():+.4f}, "
                        f"ecart-type {donnees.std():.4f}, "
                        f"extremes [{donnees.min():+.3f}, {donnees.max():+.3f}]"
                    )


def essayer_keras(chemin: pathlib.Path, nb_classes: int) -> None:
    """Reproduit les deux tentatives de chargement, en affichant les erreurs."""
    from tensorflow import keras

    titre(f"TENTATIVES DE CHARGEMENT : {chemin.name}")

    print("\n1) keras.models.load_model (modele complet)")
    try:
        modele = keras.models.load_model(chemin, compile=False)
        print(f"   REUSSITE - {len(modele.layers)} couches")
        print("   Couches de premier niveau :")
        for c in modele.layers:
            print(f"     {type(c).__name__:<26} {c.name}")
        return
    except Exception:
        print("   ECHEC. Message complet :")
        for ligne in traceback.format_exc().splitlines()[-6:]:
            print(f"     {ligne}")

    print("\n2) load_weights sans by_name (appariement par position)")
    print("   Cette variante leve une erreur explicite en cas de decalage,")
    print("   la ou by_name=True echoue en silence.")

    base = keras.applications.EfficientNetB3(
        include_top=False, weights=None, input_shape=(COTE, COTE, 3)
    )
    entree = keras.Input(shape=(COTE, COTE, 3))
    x = base(entree, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = keras.layers.Dropout(0.3, name="top_dropout")(x)
    sortie = keras.layers.Dense(nb_classes, activation="softmax", name="predictions")(x)
    modele = keras.Model(entree, sortie, name="AgriCam")

    print(f"\n   Couches attendues : {[c.name for c in modele.layers]}")

    avant = modele.get_layer("predictions").get_weights()[0].copy()

    try:
        modele.load_weights(chemin)
        print("   REUSSITE (appariement par position)")
    except Exception:
        print("   ECHEC. Message complet :")
        for ligne in traceback.format_exc().splitlines()[-6:]:
            print(f"     {ligne}")

    apres = modele.get_layer("predictions").get_weights()[0]
    change = not np.allclose(avant, apres)
    print(f"\n   Les poids de la couche de decision ont-ils change ? {'OUI' if change else 'NON'}")
    if not change:
        print("   -> confirmation : rien n'a ete injecte.")


if __name__ == "__main__":
    fichiers = list(tous_les_h5())
    if not fichiers:
        raise SystemExit("Aucun fichier .h5 trouve.")

    print(f"{len(fichiers)} fichier(s) .h5 reperes.")

    for chemin in fichiers:
        inspecter(chemin)

    chemin_classes = None
    for racine in racines():
        candidats = list(racine.glob("**/class_names.json"))
        if candidats:
            chemin_classes = candidats[0]
            break

    classes = json.loads(chemin_classes.read_text(encoding="utf-8")) if chemin_classes else []
    if isinstance(classes, dict):
        classes = [classes[c] for c in sorted(classes, key=int)]
    nb = len(classes) or 9

    for chemin in fichiers:
        essayer_keras(chemin, nb)

    titre("FIN")
    print("Envoyez cette sortie complete.")
