import {
  Component,
  ElementRef,
  OnInit,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { MentionCandidate, toEditableText, toStoredBody } from '../../models/project-comment.model';

let nextId = 0;
const MAX_SUGGESTIONS = 6;

/**
 * Campo di scrittura di un commento con citazioni: digitando "@" compare l'elenco delle persone
 * del team (frecce per scegliere, Invio o Tab per inserire, Esc per chiudere).
 * Emette il testo nel formato salvato, con le citazioni @[Nome Cognome](id).
 */
@Component({
  selector: 'gov-comment-composer',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './comment-composer.html',
  styleUrl: './comment-composer.scss',
})
export class CommentComposer implements OnInit {
  readonly candidates = input.required<readonly MentionCandidate[]>();
  readonly label = input('Scrivi un commento');
  readonly submitLabel = input('Pubblica');
  /** Testo iniziale (modifica di un commento esistente), nel formato salvato. */
  readonly initialBody = input<string>('');
  readonly busy = input(false);
  readonly cancellable = input(false);

  readonly submitted = output<string>();
  readonly cancelled = output<void>();

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly listId = `gov-mentions-${nextId++}`;
  protected readonly text = signal('');
  protected readonly query = signal<string | null>(null);
  protected readonly activeIndex = signal(0);
  private chosen = new Map<string, number>();

  protected readonly suggestions = computed(() => {
    const query = this.query();
    if (query === null) {
      return [];
    }
    const needle = query.toLowerCase();
    return this.candidates()
      .filter(
        (candidate) =>
          candidate.name
            .toLowerCase()
            .split(' ')
            .some((part) => part.startsWith(needle)) ||
          candidate.name.toLowerCase().startsWith(needle),
      )
      .slice(0, MAX_SUGGESTIONS);
  });

  protected readonly canSubmit = computed(() => this.text().trim().length > 0 && !this.busy());

  ngOnInit(): void {
    if (this.initialBody()) {
      const editable = toEditableText(this.initialBody());
      this.text.set(editable.text);
      this.chosen = editable.chosen;
    }
  }

  protected onInput(event: Event): void {
    const element = event.target as HTMLTextAreaElement;
    this.text.set(element.value);
    this.updateQuery(element);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    if (suggestions.length === 0) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.submit();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((index) => (index + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((index) => (index - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        this.choose(suggestions[this.activeIndex()]);
        break;
      case 'Escape':
        event.preventDefault();
        this.query.set(null);
        break;
    }
  }

  /** Sostituisce "@testo" sotto il cursore con "@Nome Cognome ". */
  protected choose(candidate: MentionCandidate): void {
    const element = this.textarea().nativeElement;
    const caret = element.selectionStart ?? element.value.length;
    const before = element.value.slice(0, caret);
    const start = before.lastIndexOf('@');
    const value = `${element.value.slice(0, start)}@${candidate.name} ${element.value.slice(caret)}`;
    this.chosen.set(candidate.name, candidate.id);
    this.text.set(value);
    this.query.set(null);
    element.value = value;
    const position = start + candidate.name.length + 2;
    element.focus();
    element.setSelectionRange(position, position);
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    // Restano citate solo le persone il cui "@Nome" è ancora nel testo
    const text = this.text().trim();
    const used = new Map([...this.chosen].filter(([name]) => text.includes(`@${name}`)));
    this.submitted.emit(toStoredBody(text, used));
  }

  /** Svuota il campo dopo la pubblicazione. */
  clear(): void {
    this.text.set('');
    this.chosen.clear();
    this.query.set(null);
    this.textarea().nativeElement.value = '';
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  private updateQuery(element: HTMLTextAreaElement): void {
    const before = element.value.slice(0, element.selectionStart ?? element.value.length);
    const match = /(?:^|\s)@([\p{L}'.-]{0,30})$/u.exec(before);
    this.query.set(match ? match[1] : null);
    this.activeIndex.set(0);
  }
}
