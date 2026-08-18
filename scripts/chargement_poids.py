"""
================================================================================
 AgriCam - chargement deterministe des poids depuis un fichier HDF5
================================================================================

POURQUOI NE PAS UTILISER load_weights
-------------------------------------
`load_weights(..., by_name=True)` presente deux defauts, et nous les avons
rencontres tous les deux :

  - il ignore EN SILENCE les couches non appariees, ce qui produit un reseau
    reste initialise au hasard sans qu'aucune erreur ne soit levee ;
  - sur un modele imbrique - et EfficientNetB3 en est un, une couche unique
    contenant 497 tenseurs - il tente de reordonner les poids par position et
    echoue avec un message opaque : `axes don't match array`.

Ce module fait le travail autrement. Il lit le fichier HDF5 directement, batit
un dictionnaire { nom du tenseur : valeur }, puis assigne chaque poids du
modele en le cherchant PAR SON NOM. Aucun ordre implicite, aucun silence : la
fonction renvoie le compte exact des tenseurs apparies et refuse de laisser
passer un chargement partiel.
================================================================================
"""

from __future__ import annotations

import pathlib

import h5py
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import backend as K


def lire_tenseurs(chemin: pathlib.Path) -> dict[str, np.ndarray]:
    """
    Aplatit le fichier HDF5 en un dictionnaire { nom : valeur }.

    Structure typique produite par `save_weights` :

        /efficientnetb3/block1a_bn/beta:0        (40,)
        /predictions/predictions/kernel:0        (1536, 9)

    Le premier segment est le nom de la couche de premier niveau ; le reste est
    le nom du tenseur tel que Keras le connait. On indexe sur les deux formes,
    complete et abregee, pour maximiser les chances d'appariement.
    """
    tenseurs: dict[str, np.ndarray] = {}

    with h5py.File(chemin, "r") as f:
        groupe = f["model_weights"] if "model_weights" in f else f

        def visiter(cle: str, objet) -> None:
            if isinstance(objet, h5py.Dataset):
                valeur = np.array(objet)
                tenseurs[cle] = valeur
                # Sans le nom de la couche de premier niveau.
                if "/" in cle:
                    tenseurs.setdefault(cle.split("/", 1)[1], valeur)

        groupe.visititems(visiter)

    return tenseurs


def charger_poids(modele, chemin: pathlib.Path, verbeux: bool = True) -> int:
    """
    Assigne les poids du fichier au modele, en appariant par nom.

    Renvoie le nombre de tenseurs effectivement charges, et leve une erreur si
    l'appariement est trop incomplet pour donner un modele utilisable.
    """
    tenseurs = lire_tenseurs(chemin)
    if verbeux:
        print(f"  {len(tenseurs)} entrees lues dans {chemin.name}")

    paires: list[tuple] = []
    manquants: list[str] = []

    for poids in modele.weights:
        nom = poids.name                      # ex. 'block1a_bn/beta:0'
        valeur = tenseurs.get(nom)

        # Repli 1 : le tenseur est range sous le nom de sa couche parente.
        if valeur is None:
            for cle, candidat in tenseurs.items():
                if cle.endswith(nom):
                    valeur = candidat
                    break

        # Repli 2 : meme nom de base et meme forme. Suffisant en pratique,
        # les collisions de noms etant impossibles dans un modele Keras.
        if valeur is None:
            base = nom.split("/")[-1]
            for cle, candidat in tenseurs.items():
                if cle.endswith(base) and candidat.shape == tuple(poids.shape):
                    valeur = candidat
                    break

        if valeur is None:
            manquants.append(nom)
            continue

        if valeur.shape != tuple(poids.shape):
            raise ValueError(
                f"Forme incompatible pour {nom} : "
                f"fichier {valeur.shape}, modele {tuple(poids.shape)}"
            )

        paires.append((poids, valeur))

    K.batch_set_value(paires)

    total = len(modele.weights)
    charges = len(paires)

    if verbeux:
        print(f"  {charges} / {total} tenseurs assignes")
        if manquants:
            print(f"  {len(manquants)} sans correspondance, dont :")
            for nom in manquants[:8]:
                print(f"      {nom}")

    if charges < total * 0.95:
        raise SystemExit(
            f"\n[CHARGEMENT INCOMPLET] {charges} tenseurs sur {total}.\n"
            "                       Le modele serait partiellement aleatoire.\n"
            "                       Envoyez-moi la liste ci-dessus."
        )

    # Indispensable : les constantes de normalisation ne suivent pas les
    # variables. Voir finaliser_normalisation.
    finaliser_normalisation(modele, verbeux)

    return charges


def finaliser_normalisation(modele, verbeux: bool = True) -> int:
    """
    Recalcule les constantes de normalisation apres chargement des poids.

    C'est le correctif central de ce module, et il merite une explication.

    La couche `Normalization` de Keras 2.10 conserve ses statistiques dans deux
    variables, `adapt_mean` et `adapt_variance`. Mais au moment du `build`, sa
    methode `finalize_state()` en fige une COPIE CONSTANTE dans `self.mean` et
    `self.variance` - et c'est cette copie, non les variables, que `call()`
    utilise.

    Consequence : reconstruire le reseau avec `weights=None` fige des constantes
    a 0 et 1, puis charger les poids met a jour les VARIABLES sans toucher aux
    constantes. Le reseau cesse alors de normaliser. Il ne leve aucune erreur,
    reste tres sur de lui, et se trompe systematiquement - c'est exactement le
    profil observe : 80,7 % d'exactitude pour 91,2 % de confiance moyenne.

    EfficientNet place cette couche en tete de son propre pretraitement : la
    negliger revient a alimenter le reseau en pixels bruts la ou il attend des
    valeurs centrees-reduites.
    """
    corrigees = 0

    def parcourir(couche):
        nonlocal corrigees
        if isinstance(couche, keras.layers.Normalization):
            if hasattr(couche, "finalize_state"):
                couche.finalize_state()
                corrigees += 1
        for sous in getattr(couche, "layers", []):
            parcourir(sous)

    parcourir(modele)

    if verbeux and corrigees:
        print(f"  {corrigees} couche(s) de normalisation refinalisee(s)")
    return corrigees


def rendre_serialisable(modele, verbeux: bool = True) -> int:
    """
    Convertit en listes Python les coefficients stockes sous forme de tenseurs.

    Dans le code source de Keras 2.10, EfficientNet cree sa couche de mise a
    l'echelle ainsi :

        layers.Rescaling(1.0 / tf.math.sqrt(IMAGENET_STDDEV_RGB))

    `tf.math.sqrt` renvoie un EagerTensor. Or toute sauvegarde Keras serialise
    la configuration des couches en JSON, et le JSON ne sait pas ecrire un
    EagerTensor :

        TypeError: Unable to serialize [2.0896919 2.1128857 2.1081853] to JSON

    On reconvertit donc ces coefficients en listes natives. Le calcul est
    identique - `call()` effectue un `tf.cast` de toute facon - mais le modele
    redevient sauvegardable.

    ORDRE IMPORTANT : appeler cette fonction APRES finaliser_normalisation,
    sans quoi on figerait les statistiques erronees d'avant le chargement.
    """
    corriges = 0

    def parcourir(couche):
        nonlocal corriges
        for attribut in ("scale", "offset", "mean", "variance"):
            valeur = getattr(couche, attribut, None)
            if valeur is not None and tf.is_tensor(valeur):
                setattr(couche, attribut, np.asarray(valeur).tolist())
                corriges += 1
        for sous in getattr(couche, "layers", []):
            parcourir(sous)

    parcourir(modele)

    if verbeux and corriges:
        print(f"  {corriges} coefficient(s) reconverti(s) pour la serialisation")
    return corriges


def controler(modele, verbeux: bool = True) -> None:
    """
    Verifie que la couche de decision porte des valeurs entrainees.

    Une initialisation Glorot sur 1536 canaux vers 9 classes donne un
    ecart-type d'environ sqrt(2 / (1536 + 9)) = 0,036, tres regulier. Un modele
    entraine s'en ecarte nettement - ici, on attend environ 0,126.
    """
    dense = next(
        c for c in reversed(modele.layers) if hasattr(c, "kernel")
    )
    noyau = dense.get_weights()[0]
    ecart_type = float(noyau.std())
    attendu = float(np.sqrt(2.0 / sum(noyau.shape)))

    if verbeux:
        print(
            f"  couche de decision : ecart-type {ecart_type:.4f} "
            f"(initialisation : environ {attendu:.4f})"
        )

    if ecart_type < attendu * 1.5:
        raise SystemExit(
            "\n[POIDS SUSPECTS] La couche de decision ressemble a une "
            "initialisation aleatoire."
        )
