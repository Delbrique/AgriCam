"""
================================================================================
 AgriCam - controle : les poids entraines ont-ils vraiment ete charges ?
================================================================================

POURQUOI CE SCRIPT
------------------
A l'export, `load_model` a echoue et le script est passe en repli :
reconstruction de l'architecture, puis `load_weights(..., by_name=True)`.

Or `by_name=True` ignore EN SILENCE toute couche dont le nom ne correspond
pas. Si la correspondance avait echoue, le reseau serait reste initialise au
hasard - et la verification d'export (ecart 7e-09) aurait ete tout aussi bonne,
puisqu'elle ne compare que le modele a lui-meme.

Le seul controle qui tranche est empirique : faire predire de vraies images et
regarder si l'exactitude retrouve celle de l'entrainement.

    conda activate agricam
    cd Documents\\VENV\\bases_python\\Soutenance\\agricam
    python scripts\\verifier_poids.py

LECTURE DU RESULTAT
-------------------
    90 % et plus  -> les poids sont bien la, tout va bien
    autour de 11 % -> reseau au hasard : les poids n'ont PAS ete charges
    entre les deux -> anomalie, ne pas deployer
================================================================================
"""

from __future__ import annotations

import json
import pathlib
import random

import numpy as np
from tensorflow import keras

COTE = 224
NB_IMAGES = 180          # une vingtaine par classe : assez pour trancher
SEED = 42

# Dossiers a ne jamais explorer : ils contiennent des milliers de fichiers
# sans interet et ralentissent la recherche.
IGNORES = {"node_modules", ".git", "__pycache__", "dist", "public"}


def racines() -> list[pathlib.Path]:
    """Dossier courant, dossier du script, et leurs parents."""
    vues: set[pathlib.Path] = set()
    sortie: list[pathlib.Path] = []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


RACINES = racines()


def acceptable(chemin: pathlib.Path) -> bool:
    return not any(p in IGNORES for p in chemin.parts)


def trouver_fichier(motifs: list[str], description: str) -> pathlib.Path:
    for racine in RACINES:
        for motif in motifs:
            candidats = sorted(racine.glob(motif)) + sorted(racine.glob(f"**/{motif}"))
            candidats = [c for c in candidats if c.is_file() and acceptable(c)]
            if candidats:
                print(f"  [ok] {description:<26} {candidats[0]}")
                return candidats[0]
    raise SystemExit(
        f"\n[MANQUANT] {description}\n"
        f"           Motifs : {', '.join(motifs)}\n"
        + "".join(f"             - {r}\n" for r in RACINES)
    )


def trouver_dossier_donnees(classes: list[str]) -> pathlib.Path:
    """
    Localise le jeu d'images en cherchant les DOSSIERS DE CLASSES eux-memes.

    Chercher un dossier nomme "data" ne suffit pas : le projet en contient
    plusieurs, dont un vide. En revanche, un dossier nomme `Onion___Diseased`
    ne peut appartenir qu'au jeu produit par l'ETL - son parent est donc, par
    construction, la racine du corpus.
    """
    for racine in RACINES:
        for nom in classes:
            for candidat in racine.glob(f"**/{nom}"):
                if candidat.is_dir() and acceptable(candidat):
                    images = [
                        p for p in candidat.iterdir()
                        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
                    ]
                    if images:
                        print(f"  [ok] {'jeu d images':<26} {candidat.parent}")
                        return candidat.parent
    raise SystemExit(
        "\n[MANQUANT] jeu d'images\n"
        f"           Aucun dossier nomme comme une classe (ex. {classes[0]})\n"
        "           n'a ete trouve avec des images dedans.\n"
        + "".join(f"             - {r}\n" for r in RACINES)
    )


def construire(nb_classes: int) -> keras.Model:
# `weights="imagenet"` et non None : la couche Normalization d'EfficientNet
    # fige ses statistiques en constantes des le build. Construite a vide, elle
    # normaliserait avec 0 et 1, et le chargement ulterieur des poids ne
    # corrigerait que les variables, pas les constantes.
    base = keras.applications.EfficientNetB3(
        include_top=False, weights="imagenet", input_shape=(COTE, COTE, 3)
    )
    entree = keras.Input(shape=(COTE, COTE, 3))
    x = base(entree, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = keras.layers.Dropout(0.3, name="top_dropout")(x)
    sortie = keras.layers.Dense(nb_classes, activation="softmax", name="predictions")(x)
    return keras.Model(entree, sortie, name="AgriCam")


def echantillonner(
    dossier: pathlib.Path, classes: list[str]
) -> list[tuple[pathlib.Path, int]]:
    random.seed(SEED)
    par_classe = max(4, NB_IMAGES // len(classes))
    echantillon: list[tuple[pathlib.Path, int]] = []

    for indice, nom in enumerate(classes):
        sous_dossier = dossier / nom
        if not sous_dossier.is_dir():
            print(f"  [--] dossier absent : {nom}")
            continue
        images = [
            p for p in sous_dossier.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        ]
        if not images:
            print(f"  [--] aucune image : {nom}")
            continue
        for p in random.sample(images, min(par_classe, len(images))):
            echantillon.append((p, indice))

    return echantillon


def charger_lot(chemins: list[pathlib.Path]) -> np.ndarray:
    """
    Charge les images SANS diviser par 255.

    EfficientNet embarque sa propre normalisation. Diviser ici reviendrait a
    normaliser deux fois : la precision s'effondrerait, et on conclurait a tort
    que les poids sont mauvais.
    """
    lot = np.zeros((len(chemins), COTE, COTE, 3), dtype="float32")
    for i, chemin in enumerate(chemins):
        image = keras.utils.load_img(chemin, target_size=(COTE, COTE))
        lot[i] = keras.utils.img_to_array(image)
    return lot


if __name__ == "__main__":
    print("Recherche dans :")
    for r in RACINES:
        print(f"   {r}")
    print()

    chemin_classes = trouver_fichier(["class_names.json"], "noms des classes")
    classes = json.loads(chemin_classes.read_text(encoding="utf-8"))
    if isinstance(classes, dict):
        classes = [classes[c] for c in sorted(classes, key=int)]

    dossier = trouver_dossier_donnees(classes)
    # ORDRE IMPORTANT : voir la note dans exporter_modeles.py.
    chemin_poids = trouver_fichier(
        ["agricam_best_weights.h5", "*best_weights.h5", "agricam_fruits_model.h5"],
        "poids du classifieur",
    )
    if chemin_poids.stat().st_size < 1024 * 1024:
        raise SystemExit(
            f"\n[FICHIER VIDE] {chemin_poids} ne pese que "
            f"{chemin_poids.stat().st_size} octets."
        )

    print(f"\n{len(classes)} classes.\n")

    modele = construire(len(classes))

    from chargement_poids import charger_poids, controler

    print(f"Chargement depuis {chemin_poids.name} :")
    charger_poids(modele, chemin_poids)
    controler(modele)
    print()

    echantillon = echantillonner(dossier, classes)
    if not echantillon:
        raise SystemExit("\nAucune image exploitable dans ce dossier.")

    print(f"\n{len(echantillon)} images tirees au hasard. Prediction en cours...\n")

    chemins = [c for c, _ in echantillon]
    verite = np.array([e for _, e in echantillon])
    probabilites = modele.predict(charger_lot(chemins), verbose=0)
    predictions = probabilites.argmax(axis=1)

    exactitude = float((predictions == verite).mean())
    confiance = float(probabilites.max(axis=1).mean())

    print("=" * 62)
    print(f" Exactitude sur l'echantillon : {exactitude:6.1%}")
    print(f" Confiance moyenne            : {confiance:6.1%}")
    print("=" * 62)

    print("\nDetail par classe :")
    for indice, nom in enumerate(classes):
        masque = verite == indice
        if masque.sum() == 0:
            continue
        score = float((predictions[masque] == indice).mean())
        print(f"  {nom:<30} {score:5.0%} {'#' * round(score * 24)}")

    hasard = 1 / len(classes)
    print()
    if exactitude >= 0.85:
        print("VERDICT : poids correctement charges. L'export est valide.")
    elif exactitude <= hasard * 2:
        print(
            "VERDICT : reseau au hasard - les poids n'ont PAS ete charges.\n"
            "          Essayez agricam_best_weights.h5 en renommant l'autre\n"
            "          fichier, puis relancez. Envoyez-moi cette sortie."
        )
    else:
        print(
            "VERDICT : resultat intermediaire, anormal.\n"
            "          Chargement partiel probable. Ne deployez pas.\n"
            "          Envoyez-moi cette sortie."
        )
