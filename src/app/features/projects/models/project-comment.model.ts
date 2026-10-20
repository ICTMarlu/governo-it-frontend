/** Persona del team citata in un commento. */
export interface CommentMention {
  readonly resourceId: number;
  readonly name: string;
}

/** Commento della bacheca di un progetto (COL-01), con le sue risposte. */
export interface ProjectComment {
  readonly id: number;
  readonly parentCommentId: number | null;
  readonly authorUserId: number;
  readonly authorName: string;
  /** Testo con le citazioni nel formato @[Nome Cognome](idRisorsa). */
  readonly body: string;
  readonly mentions: readonly CommentMention[];
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly edited: boolean;
  readonly deleted: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly version: string;
  readonly replies: readonly ProjectComment[];
}

/** Persona citabile con @. */
export interface MentionCandidate {
  readonly id: number;
  readonly name: string;
}

export type CommentSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'mention'; readonly name: string; readonly resourceId: number };

const MENTION = /@\[([^\]\n]{1,160})\]\((\d{1,18})\)/g;

/** Testo del commento diviso in parti semplici e citazioni (niente HTML: nessun rischio XSS). */
export function commentSegments(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION)) {
    if (match.index > last) {
      segments.push({ kind: 'text', text: body.slice(last, match.index) });
    }
    segments.push({ kind: 'mention', name: match[1], resourceId: Number(match[2]) });
    last = match.index + match[0].length;
  }
  if (last < body.length) {
    segments.push({ kind: 'text', text: body.slice(last) });
  }
  return segments;
}

/** Da testo semplice ("@Nome Cognome") al formato salvato, per le persone scelte dall'elenco. */
export function toStoredBody(text: string, chosen: ReadonlyMap<string, number>): string {
  // I nomi più lunghi prima, così "Davide Canducci" non viene spezzato da "Davide"
  const names = [...chosen.keys()].sort((a, b) => b.length - a.length);
  let result = text;
  for (const name of names) {
    result = result.split(`@${name}`).join(`@[${name}](${chosen.get(name)})`);
  }
  return result;
}

/** Dal formato salvato al testo modificabile, ricordando le persone citate. */
export function toEditableText(body: string): { text: string; chosen: Map<string, number> } {
  const chosen = new Map<string, number>();
  const text = body.replace(MENTION, (_match, name: string, id: string) => {
    chosen.set(name, Number(id));
    return `@${name}`;
  });
  return { text, chosen };
}
