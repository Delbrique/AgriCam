# Backend FastAPI - deploye comme fonction Python sur Vercel (meme projet,
# meme domaine que le reste de l'app : voir vercel.json pour le routage
# /api/py/* -> ce fichier).
#
# Role precis, distinct des fonctions Node existantes (api/conseil.ts,
# api/astuce.ts, api/synthese.ts, api/assistant.ts, qui restent des
# passerelles vers Groq) : ce backend gere le CHAT COMMUNAUTAIRE, qui a
# besoin d'un vrai stockage partage entre producteurs - Supabase (Postgres +
# Auth + Realtime). Le frontend s'abonne directement au canal Realtime de
# Supabase pour l'affichage en direct des nouveaux messages ; ce backend,
# lui, valide et ecrit les messages (longueur, limite de debit) plutot que
# de laisser le client ecrire n'importe quoi directement dans la base.
#
# Necessite ces variables d'environnement (voir Supabase > Project Settings
# > API) :
#   SUPABASE_URL          - URL du projet (https://xxxx.supabase.co)
#   SUPABASE_SERVICE_ROLE  - cle "service_role" (secrete, cote serveur
#                            uniquement - contourne les policies RLS, donc
#                            les verifications ci-dessous en tiennent lieu)
#
# Pas de secret JWT en dur : les projets Supabase recents signent les jetons
# avec une cle asymetrique (ES256) tournante (Project Settings > JWT Keys),
# donc la verification se fait via la cle publique JWKS du projet plutot
# qu'un secret partage fige - PyJWKClient recupere et met en cache cette cle
# a partir du "kid" present dans l'en-tete du jeton.

import os
import time
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Header
from jwt import PyJWKClient
from pydantic import BaseModel, Field
from supabase import Client, create_client

app = FastAPI(title="AgriCam - API communautaire")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE")

_client: Optional[Client] = None
_jwks_client: Optional[PyJWKClient] = None


def jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise HTTPException(status_code=500, detail="SUPABASE_URL non configure sur le serveur.")
        _jwks_client = PyJWKClient(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True
        )
    return _jwks_client


def client() -> Client:
    """Cree le client Supabase a la demande plutot qu'a l'import : une
    variable d'environnement absente ne doit faire echouer que les routes
    qui en ont reellement besoin, pas le chargement de toute la fonction."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_URL / SUPABASE_SERVICE_ROLE non configures sur le serveur.",
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    return _client


class Utilisateur(BaseModel):
    id: str
    email: Optional[str] = None


def utilisateur_courant(authorization: str = Header(default="")) -> Utilisateur:
    """Verifie le jeton emis par Supabase Auth (envoye par le client apres
    connexion) et en extrait l'identite - jamais de confiance aveugle dans
    un user_id fourni tel quel par le client dans le corps de la requete."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Connexion requise.")
    jeton = authorization.removeprefix("Bearer ").strip()
    try:
        cle_signature = jwks_client().get_signing_key_from_jwt(jeton)
        charge = jwt.decode(
            jeton,
            cle_signature.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session invalide ou expiree.")
    return Utilisateur(id=charge["sub"], email=charge.get("email"))


class NouveauMessage(BaseModel):
    salon: str = Field(default="general", max_length=40)
    contenu: str = Field(min_length=1, max_length=500)


# Limite de debit tres simple, en memoire : suffisant pour une demo/these,
# pas pour une vraie charge multi-instance (chaque instance serverless a sa
# propre memoire) - a remplacer par une table Postgres si le trafic grandit.
_dernier_message: dict[str, float] = {}
DELAI_MIN_SECONDES = 3


@app.get("/api/py/health")
def sante():
    return {"etat": "ok"}


@app.get("/api/py/chat/messages")
def lister_messages(salon: str = "general", limite: int = 50):
    reponse = (
        client()
        .table("messages")
        .select("id, salon, user_id, pseudo, contenu, created_at")
        .eq("salon", salon)
        .order("created_at", desc=True)
        .limit(min(limite, 100))
        .execute()
    )
    return {"messages": list(reversed(reponse.data))}


@app.post("/api/py/chat/messages")
def poster_message(
    message: NouveauMessage, utilisateur: Utilisateur = Depends(utilisateur_courant)
):
    maintenant = time.time()
    dernier = _dernier_message.get(utilisateur.id)
    if dernier and maintenant - dernier < DELAI_MIN_SECONDES:
        raise HTTPException(status_code=429, detail="Un peu plus lentement, merci.")
    _dernier_message[utilisateur.id] = maintenant

    profil = (
        client().table("profiles").select("pseudo").eq("id", utilisateur.id).execute()
    )
    pseudo = profil.data[0]["pseudo"] if profil.data else (utilisateur.email or "Producteur")

    reponse = (
        client()
        .table("messages")
        .insert(
            {
                "salon": message.salon,
                "user_id": utilisateur.id,
                "pseudo": pseudo,
                "contenu": message.contenu,
            }
        )
        .execute()
    )
    return reponse.data[0]
