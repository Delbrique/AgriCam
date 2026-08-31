/**
 * Client de l'assistant conversationnel (voir api/assistant.ts).
 */

export interface MessageChat {
  role: 'user' | 'assistant';
  /** Texte envoye a Groq - peut inclure le texte extrait d'un document joint. */
  contenu: string;
  /** Ce qui est affiche dans la bulle, si different de `contenu` (evite de
   * montrer tout le texte d'un document dans la conversation). */
  resume?: string;
  /** Image jointe, en data URL : affichee en vignette ET envoyee a Groq. */
  image?: string;
}

/**
 * `surMorceau`, si fourni, est rappele a chaque fragment recu avec le texte
 * accumule jusque-la (pas seulement le delta) : pratique pour un affichage
 * qui se contente de reafficher la valeur recue (voir Assistant.tsx).
 */
export async function demanderAssistant(
  messages: MessageChat[],
  surMorceau?: (texteAccumule: string) => void,
): Promise<string> {
  // `resume` ne sert qu'a l'affichage local : inutile de l'envoyer a Groq.
  const aEnvoyer = messages.map(({ role, contenu, image }) => ({ role, contenu, image }));

  const reponse = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: aEnvoyer }),
  });

  if (!reponse.ok) {
    const data = await reponse.json().catch(() => ({}));
    throw new Error(data.erreur ?? "L'assistant est indisponible.");
  }
  if (!reponse.body) {
    throw new Error("L'assistant n'a pas répondu.");
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let texte = '';
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    texte += decodeur.decode(value, { stream: true });
    surMorceau?.(texte);
  }

  if (!texte.trim()) {
    throw new Error("Réponse vide de l'assistant.");
  }
  return texte;
}
