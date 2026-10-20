import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ColumnLayout, columnId, orderedColumns } from '../column-layout';
import { ColumnConfig } from '../crud.model';

export interface ColumnChooserData {
  readonly columns: readonly ColumnConfig[];
  readonly layout: ColumnLayout | null;
}

/** Esito: nuovo layout, oppure 'reset' per tornare alle colonne predefinite. */
export type ColumnChooserResult = ColumnLayout | 'reset';

interface Item {
  readonly id: string;
  readonly label: string;
  readonly locked: boolean;
  visible: boolean;
}

/**
 * Scelta e ordine delle colonne di un elenco: spunta per mostrare/nascondere, trascinamento
 * (o frecce, da tastiera) per l'ordine. La colonna principale non si può nascondere.
 */
@Component({
  selector: 'gov-column-chooser-dialog',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MatDialogModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './column-chooser-dialog.html',
  styleUrl: './column-chooser-dialog.scss',
})
export class ColumnChooserDialog {
  private readonly data = inject<ColumnChooserData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ColumnChooserDialog, ColumnChooserResult>>(MatDialogRef);

  protected readonly items = signal<Item[]>(
    orderedColumns(this.data.columns, this.data.layout).map(({ column, visible }) => ({
      id: columnId(column),
      label: column.label,
      locked: column.primary === true,
      visible,
    })),
  );

  protected drop(event: CdkDragDrop<Item[]>): void {
    this.items.update((items) => {
      const copy = [...items];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  protected move(index: number, offset: -1 | 1): void {
    this.items.update((items) => {
      const copy = [...items];
      moveItemInArray(copy, index, index + offset);
      return copy;
    });
  }

  protected toggle(item: Item, visible: boolean): void {
    this.items.update((items) =>
      items.map((other) => (other === item ? { ...other, visible } : other)),
    );
  }

  protected apply(): void {
    const items = this.items();
    this.dialogRef.close({
      order: items.map((item) => item.id),
      hidden: items.filter((item) => !item.visible).map((item) => item.id),
    });
  }

  protected reset(): void {
    this.dialogRef.close('reset');
  }
}
