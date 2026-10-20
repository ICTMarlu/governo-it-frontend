/** Tipi della pagina Direzione, come arrivano dalle API (D-17). */

export type AgendaResult = 'DISCUSSED' | 'POSTPONED' | 'NOT_DISCUSSED' | 'CLOSED';

export interface ManagementAction {
  readonly id: number;
  readonly topicId: number;
  readonly topicTitle: string;
  readonly meetingId: number | null;
  readonly meetingDate: string | null;
  readonly description: string;
  readonly ownerResourceId: number | null;
  readonly ownerName: string | null;
  readonly dueDate: string | null;
  readonly overdue: boolean;
  readonly done: boolean;
  readonly doneOn: string | null;
  readonly version: string;
}

export interface Discussion {
  readonly meetingId: number;
  readonly meetingDate: string;
  readonly result: AgendaResult | null;
  readonly resultLabel: string | null;
  readonly note: string | null;
  readonly postponedUntil: string | null;
}

export interface ManagementTopic {
  readonly id: number;
  readonly title: string;
  readonly notes: string | null;
  readonly topicType: string;
  readonly topicTypeLabel: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly priorityLevel: number | null;
  readonly ownerName: string | null;
  readonly projectCode: string | null;
  readonly postponedUntil: string | null;
  readonly decision: string | null;
  readonly deferralCount: number;
  readonly openActionCount: number;
  readonly history: readonly Discussion[];
  readonly actions: readonly ManagementAction[];
}

export interface MeetingItem {
  readonly topic: ManagementTopic;
  readonly sortOrder: number;
  readonly result: AgendaResult | null;
  readonly resultLabel: string | null;
  readonly note: string | null;
  readonly postponedUntil: string | null;
}

export interface Meeting {
  readonly id: number;
  readonly meetingDate: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly status: 'IN_PROGRESS' | 'CLOSED';
  readonly statusLabel: string;
  readonly itemCount: number;
  readonly handledCount: number;
  readonly closedCount: number;
  readonly deferredCount: number;
  readonly items: readonly MeetingItem[];
  readonly actions: readonly ManagementAction[];
  readonly version: string;
}
