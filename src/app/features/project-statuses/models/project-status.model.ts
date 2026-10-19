/** Stato del progetto (PRJ-02), restituito da GET /api/v1/project-statuses. */
export interface ProjectStatus {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly color: string | null;
  readonly sortOrder: number;
  readonly active: boolean;
  readonly terminal: boolean;
  readonly countsForProgress: boolean;
}
