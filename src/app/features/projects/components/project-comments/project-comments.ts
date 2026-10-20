import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, filter, finalize, of, switchMap } from 'rxjs';

import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/crud/confirm-dialog/confirm-dialog';
import { errorMessage } from '../../../../shared/crud/crud-api.service';
import {
  CommentSegment,
  MentionCandidate,
  ProjectComment,
  commentSegments,
} from '../../models/project-comment.model';
import { ProjectCommentsService } from '../../services/project-comments.service';
import { CommentComposer } from '../comment-composer/comment-composer';

const DATE_TIME = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Bacheca del progetto (smart component, COL-01): discussione dal più recente, risposte su un
 * livello, citazioni @ delle persone del team, modifica ed eliminazione dei propri commenti.
 */
@Component({
  selector: 'gov-project-comments',
  imports: [
    NgTemplateOutlet,
    CommentComposer,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-comments.html',
  styleUrl: './project-comments.scss',
})
export class ProjectComments {
  private readonly service = inject(ProjectCommentsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly projectId = input.required<number>();

  private readonly newComposer = viewChild<CommentComposer>('newComposer');

  protected readonly comments = signal<ProjectComment[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly busy = signal(false);
  /** Commento a cui si sta rispondendo o che si sta modificando. */
  protected readonly replyingTo = signal<number | null>(null);
  protected readonly editing = signal<number | null>(null);
  protected readonly candidates = toSignal(
    this.service.mentionCandidates().pipe(catchError(() => of([] as MentionCandidate[]))),
    { initialValue: [] as MentionCandidate[] },
  );

  constructor() {
    effect(() => {
      const id = this.projectId();
      untracked(() => this.load(id));
    });
  }

  protected segments(comment: ProjectComment): CommentSegment[] {
    return commentSegments(comment.body);
  }

  protected when(comment: ProjectComment): string {
    return DATE_TIME.format(new Date(comment.createdAt));
  }

  protected publish(body: string): void {
    this.run(this.service.create(this.projectId(), body), () => this.newComposer()?.clear());
  }

  protected reply(parent: ProjectComment, body: string): void {
    this.run(this.service.create(this.projectId(), body, parent.id), () =>
      this.replyingTo.set(null),
    );
  }

  protected saveEdit(comment: ProjectComment, body: string): void {
    this.run(this.service.update(this.projectId(), comment, body), () => this.editing.set(null));
  }

  protected remove(comment: ProjectComment): void {
    const data: ConfirmDialogData = {
      title: 'Eliminare il commento?',
      message: 'Il testo verrà rimosso dalla discussione.',
      confirmLabel: 'Elimina',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.service.delete(this.projectId(), comment.id)),
      )
      .subscribe({
        next: () => this.load(this.projectId()),
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected startReply(comment: ProjectComment): void {
    this.editing.set(null);
    this.replyingTo.set(comment.id);
  }

  protected startEdit(comment: ProjectComment): void {
    this.replyingTo.set(null);
    this.editing.set(comment.id);
  }

  private run(request$: ReturnType<ProjectCommentsService['create']>, done: () => void): void {
    this.busy.set(true);
    request$.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        done();
        this.load(this.projectId());
      },
      error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
    });
  }

  private load(projectId: number): void {
    this.loadError.set(false);
    this.service.findAll(projectId).subscribe({
      next: (comments) => this.comments.set(comments),
      error: () => this.loadError.set(true),
    });
  }
}
