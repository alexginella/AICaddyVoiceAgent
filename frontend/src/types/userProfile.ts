/** Round or season scoring targets — shown to Chip for strategy tone */
export type ScoringGoalId =
  | 'break_100'
  | 'break_90'
  | 'break_80'
  | 'break_70'
  | 'personal_improvement'
  | 'just_have_fun'
  | 'other';

export const SCORING_GOAL_OPTIONS: { id: ScoringGoalId; label: string }[] = [
  { id: 'break_100', label: 'Break 100' },
  { id: 'break_90', label: 'Break 90' },
  { id: 'break_80', label: 'Break 80' },
  { id: 'break_70', label: 'Break 70' },
  { id: 'personal_improvement', label: 'Personal improvement' },
  { id: 'just_have_fun', label: 'Just have fun' },
  { id: 'other', label: 'Other' },
];

export function labelForScoringGoal(id: ScoringGoalId | undefined, note?: string): string {
  if (!id) return '—';
  const row = SCORING_GOAL_OPTIONS.find((o) => o.id === id);
  const base = row?.label ?? id;
  if (id === 'other' && note?.trim()) {
    return `${base}: ${note.trim()}`;
  }
  return base;
}

export type UserProfile = {
  handicap?: number;
  age?: number;
  handedness: 'left' | 'right';
  gender?: 'male' | 'female' | 'other';
  scoringGoal?: ScoringGoalId;
  /** Free text when scoringGoal is `other` */
  scoringGoalNote?: string;
  clubYardages?: Record<string, number>;
};
