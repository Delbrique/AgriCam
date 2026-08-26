-- ==========================================================================
-- AgriCam - schema Supabase pour le chat communautaire
-- --------------------------------------------------------------------------
-- A executer une fois dans Supabase : Project > SQL Editor > New query,
-- coller ce fichier entier, "Run".
--
-- Ce que ça cree :
--   - profiles   : pseudo affiche, cree automatiquement a l'inscription
--   - messages   : le chat lui-meme
--   - RLS        : lecture publique des deux tables, ecriture reservee au
--                  backend FastAPI (cle service_role, qui contourne RLS -
--                  c'est LUI qui fait les verifications, voir api/py/index.py)
--   - Realtime   : active sur `messages`, pour que le frontend recoive les
--                  nouveaux messages en direct sans repasser par le backend
-- ==========================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null default 'Producteur',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Lecture publique des profils"
  on profiles for select
  using (true);

-- Cree automatiquement un profil des l'inscription (email/mot de passe ou
-- magic link, cote Supabase Auth) - le pseudo peut etre fourni a
-- l'inscription via `options.data.pseudo`, sinon un nom generique est
-- utilise en attendant que le producteur le personnalise.
create or replace function public.creer_profil_a_inscription()
returns trigger as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, coalesce(new.raw_user_meta_data->>'pseudo', 'Producteur'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.creer_profil_a_inscription();

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  salon text not null default 'general',
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text not null,
  contenu text not null check (char_length(contenu) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists messages_salon_created_at_idx
  on messages (salon, created_at desc);

alter table messages enable row level security;

create policy "Lecture publique des messages"
  on messages for select
  using (true);

-- Aucune policy d'ecriture cote client : les messages sont ecrits par
-- api/py/index.py avec la cle service_role, qui contourne RLS et fait ses
-- propres verifications (longueur, limite de debit).

alter publication supabase_realtime add table messages;
