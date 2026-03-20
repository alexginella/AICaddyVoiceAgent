import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loadCaddyProfile, persistIntakeDraft } from '@/lib/caddyProfile';
import { SCORING_GOAL_OPTIONS, type ScoringGoalId, type UserProfile } from '@/types/userProfile';
import { cn } from '@/lib/utils';

export type { UserProfile };

interface IntakeFormProps {
  onSubmit: (profile: UserProfile) => void;
  onSkip: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function IntakeForm({
  onSubmit,
  onSkip,
  loading,
  disabled,
}: IntakeFormProps) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = loadCaddyProfile();
    return {
      handedness: (stored.handedness as 'left' | 'right') ?? 'right',
      handicap: stored.handicap,
      age: stored.age,
      gender: stored.gender,
      scoringGoal: stored.scoringGoal,
      scoringGoalNote: stored.scoringGoalNote,
      clubYardages: stored.clubYardages,
    };
  });
  const [saveToStorage, setSaveToStorage] = useState(true);

  useEffect(() => {
    if (saveToStorage) {
      persistIntakeDraft(profile);
    }
  }, [profile, saveToStorage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(profile);
  };

  const isLocked = Boolean(loading || disabled);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="handicap">Handicap (optional)</Label>
        <Input
          id="handicap"
          type="number"
          min={0}
          max={54}
          placeholder="e.g. 12"
          value={profile.handicap ?? ''}
          disabled={isLocked}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              handicap: e.target.value ? parseInt(e.target.value, 10) : undefined,
            }))
          }
          className="h-11 md:h-10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="age">Age (optional)</Label>
        <Input
          id="age"
          type="number"
          min={1}
          max={120}
          placeholder="e.g. 35"
          value={profile.age ?? ''}
          disabled={isLocked}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              age: e.target.value ? parseInt(e.target.value, 10) : undefined,
            }))
          }
          className="h-11 md:h-10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="handedness">Handedness</Label>
        <Select
          value={profile.handedness}
          onValueChange={(v) =>
            setProfile((p) => ({
              ...p,
              handedness: v as 'left' | 'right',
            }))
          }
          disabled={isLocked}
        >
          <SelectTrigger id="handedness" className="h-11 w-full md:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="left">Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">Gender (optional, for tee recommendations)</Label>
        <Select
          value={profile.gender ?? 'unspecified'}
          onValueChange={(v) =>
            setProfile((p) => ({
              ...p,
              gender:
                v === 'unspecified' ? undefined : (v as UserProfile['gender']),
            }))
          }
          disabled={isLocked}
        >
          <SelectTrigger id="gender" className="h-11 w-full md:h-10">
            <SelectValue placeholder="Prefer not to say" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unspecified">Prefer not to say</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scoringGoal">Scoring goal (optional)</Label>
        <Select
          value={profile.scoringGoal ?? 'unspecified'}
          onValueChange={(v) =>
            setProfile((p) => ({
              ...p,
              scoringGoal:
                v === 'unspecified' ? undefined : (v as ScoringGoalId),
              scoringGoalNote: v === 'other' ? p.scoringGoalNote : undefined,
            }))
          }
          disabled={isLocked}
        >
          <SelectTrigger id="scoringGoal" className="h-11 w-full md:h-10">
            <SelectValue placeholder="Select a goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unspecified">No specific goal</SelectItem>
            {SCORING_GOAL_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {profile.scoringGoal === 'other' && (
          <Input
            id="scoringGoalNote"
            type="text"
            placeholder="Describe your goal"
            value={profile.scoringGoalNote ?? ''}
            disabled={isLocked}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                scoringGoalNote: e.target.value || undefined,
              }))
            }
            className="h-11 md:h-10"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="save"
          checked={saveToStorage}
          onCheckedChange={(c) => setSaveToStorage(c === true)}
          disabled={isLocked}
        />
        <Label htmlFor="save" className="font-normal text-muted-foreground">
          Save for next time
        </Label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          type="submit"
          size="lg"
          className={cn('min-h-12 flex-1 md:min-h-10')}
          disabled={isLocked}
        >
          {loading ? 'Next…' : 'Next'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-12 md:min-h-10"
          onClick={onSkip}
          disabled={isLocked}
        >
          Skip
        </Button>
      </div>
    </form>
  );
}
