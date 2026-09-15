/**
 * Session Supabase active, partagee via contexte React.
 *
 * App.tsx resout la session UNE SEULE FOIS (avant de decider s'il faut
 * afficher l'ecran de connexion ou le reste de l'app) et la fournit ici aux
 * pages qui en ont besoin (Communaute) - elles n'ont plus a refaire leur
 * propre getSession()/onAuthStateChange, App.tsx l'a deja garanti presente
 * au moment ou les routes s'affichent.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session | null {
  return useContext(SessionContext);
}
