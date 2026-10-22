import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';

import { KpiSettingsService } from '../services/kpi-settings.service';

/**
 * Mostra l'elemento solo se l'utente non ha nascosto quel KPI (vedi KPI_GROUPS):
 * `<li *govKpi="'ops.open'">…</li>`.
 */
@Directive({ selector: '[govKpi]' })
export class KpiDirective {
  readonly govKpi = input.required<string>();

  constructor() {
    const settings = inject(KpiSettingsService);
    const template = inject(TemplateRef);
    const container = inject(ViewContainerRef);
    settings.load();
    let shown = false;
    effect(() => {
      const visible = settings.visible(this.govKpi());
      if (visible && !shown) {
        container.createEmbeddedView(template);
      } else if (!visible && shown) {
        container.clear();
      }
      shown = visible;
    });
  }
}
