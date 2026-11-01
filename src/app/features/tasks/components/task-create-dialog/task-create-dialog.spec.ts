import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CrudApiService } from '../../../../shared/crud/crud-api.service';
import { ProjectCommentsService } from '../../../projects/services/project-comments.service';
import { TaskBody } from '../../models/task.model';
import { TasksService } from '../../services/tasks.service';
import { TaskCreateData, TaskCreateDialog } from './task-create-dialog';

function setup(data: TaskCreateData) {
  const create = vi.fn((body: TaskBody) => of({ id: 1, title: body.title }));
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideNativeDateAdapter(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
      { provide: TasksService, useValue: { create } },
      { provide: ProjectCommentsService, useValue: { mentionCandidates: () => of([]) } },
      { provide: CrudApiService, useValue: { list: () => of([]) } },
    ],
  });
  const fixture = TestBed.createComponent(TaskCreateDialog);
  fixture.detectChanges();
  return { fixture, create, close };
}

describe('TaskCreateDialog', () => {
  it('parte da quello che c’è nella barra veloce e non crea senza titolo', () => {
    const { fixture, create } = setup({ kind: 'NOTE', title: '', assigneeId: 7, due: null });
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Crea'),
    ) as HTMLButtonElement;

    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Nuova nota');
    expect(button.disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('crea con tutti i campi e restituisce il task', () => {
    const { fixture, create, close } = setup({
      kind: 'TASK',
      title: '  Preparare il report  ',
      assigneeId: 3,
      due: new Date(2026, 10, 12),
    });
    const dialog = fixture.componentInstance as unknown as {
      description: { set(value: string): void };
      priorityLevelId: { set(value: number): void };
      remindOn: { set(value: Date): void };
      projectId: { set(value: number): void };
      create(): void;
    };
    dialog.description.set(' Dati di ottobre ');
    dialog.priorityLevelId.set(2);
    dialog.remindOn.set(new Date(2026, 10, 10));
    dialog.projectId.set(42);

    dialog.create();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'TASK',
        title: 'Preparare il report',
        description: 'Dati di ottobre',
        assigneeId: 3,
        priorityLevelId: 2,
        projectId: 42,
        dueDate: '2026-11-12',
        remindOn: '2026-11-10',
        statusId: null,
        version: null,
      }),
    );
    expect(close).toHaveBeenCalledWith({ id: 1, title: 'Preparare il report' });
  });
});
