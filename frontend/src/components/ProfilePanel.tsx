import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  loadCaddyProfile,
  mergeClubYardages,
  normalizeClubKey,
  removeClubYardage,
  replaceClubYardageEntry,
  type PreparedCourse,
} from '@/lib/caddyProfile';
import { labelForScoringGoal, type UserProfile } from '@/types/userProfile';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function keyToEditableLabel(key: string): string {
  return key.replace(/-/g, ' ');
}

function formatClubDisplay(key: string): string {
  return key.replace(/-/g, ' ');
}

interface ProfilePanelProps {
  profile: UserProfile;
  preparedCourses: PreparedCourse[];
  onEditDetails: () => void;
  onClearProfile: () => void;
  disabled?: boolean;
}

export function ProfilePanel({
  profile,
  preparedCourses,
  onEditDetails,
  onClearProfile,
  disabled,
}: ProfilePanelProps) {
  const yardagesFromProp = profile.clubYardages ?? {};
  const yardagesKey = JSON.stringify(yardagesFromProp);

  const [localYardages, setLocalYardages] = useState<Record<string, number>>(yardagesFromProp);
  const [yardageEditorOpen, setYardageEditorOpen] = useState(false);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editClubDraft, setEditClubDraft] = useState('');
  const [editYardsDraft, setEditYardsDraft] = useState('');
  const [editRowError, setEditRowError] = useState<string | null>(null);

  const [clubDraft, setClubDraft] = useState('');
  const [yardsDraft, setYardsDraft] = useState('');
  const [yardageError, setYardageError] = useState<string | null>(null);

  const refreshYardagesFromStorage = useCallback(() => {
    setLocalYardages({ ...(loadCaddyProfile().clubYardages ?? {}) });
  }, []);

  useEffect(() => {
    try {
      setLocalYardages(JSON.parse(yardagesKey) as Record<string, number>);
    } catch {
      setLocalYardages({});
    }
  }, [yardagesKey]);

  const yardageEntries = Object.entries(localYardages).sort(([a], [b]) => a.localeCompare(b));

  const closeYardageEditor = useCallback(() => {
    setYardageEditorOpen(false);
    setEditingRowKey(null);
    setEditRowError(null);
    setEditClubDraft('');
    setEditYardsDraft('');
    setYardageError(null);
  }, []);

  const addManualYardage = useCallback(() => {
    setYardageError(null);
    const key = normalizeClubKey(clubDraft);
    if (!key) {
      setYardageError('Enter a club name.');
      return;
    }
    const y = parseInt(yardsDraft, 10);
    if (Number.isNaN(y) || y < 1 || y > 400) {
      setYardageError('Enter a carry distance between 1 and 400 yards.');
      return;
    }
    mergeClubYardages({ [key]: y });
    refreshYardagesFromStorage();
    setClubDraft('');
    setYardsDraft('');
  }, [clubDraft, yardsDraft, refreshYardagesFromStorage]);

  const startRowEdit = (clubKey: string, yds: number) => {
    setEditRowError(null);
    setEditingRowKey(clubKey);
    setEditClubDraft(keyToEditableLabel(clubKey));
    setEditYardsDraft(String(yds));
  };

  const cancelRowEdit = () => {
    setEditingRowKey(null);
    setEditRowError(null);
    setEditClubDraft('');
    setEditYardsDraft('');
  };

  const saveRowEdit = () => {
    if (!editingRowKey) return;
    setEditRowError(null);
    const y = parseInt(editYardsDraft, 10);
    if (Number.isNaN(y) || y < 1 || y > 400) {
      setEditRowError('Enter a carry distance between 1 and 400 yards.');
      return;
    }
    const newKey = normalizeClubKey(editClubDraft);
    if (!newKey) {
      setEditRowError('Enter a club name.');
      return;
    }
    replaceClubYardageEntry(editingRowKey, editClubDraft, y);
    refreshYardagesFromStorage();
    cancelRowEdit();
  };

  const deleteRow = (clubKey: string) => {
    removeClubYardage(clubKey);
    refreshYardagesFromStorage();
    if (editingRowKey === clubKey) {
      cancelRowEdit();
    }
  };

  const genderLabel =
    profile.gender === 'male'
      ? 'Male'
      : profile.gender === 'female'
        ? 'Female'
        : profile.gender === 'other'
          ? 'Other'
          : '—';

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="w-full border-border/80 bg-card/50 text-left shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg">Your details</CardTitle>
            <CardDescription>
              Handicap, goals, and basics — used for tee tips and club advice.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">Handicap</dt>
            <dd>{profile.handicap ?? '—'}</dd>
            <dt className="text-muted-foreground">Age</dt>
            <dd>{profile.age ?? '—'}</dd>
            <dt className="text-muted-foreground">Handedness</dt>
            <dd className="capitalize">{profile.handedness}</dd>
            <dt className="text-muted-foreground">Gender</dt>
            <dd>{genderLabel}</dd>
            <dt className="text-muted-foreground">Scoring goal</dt>
            <dd>{labelForScoringGoal(profile.scoringGoal, profile.scoringGoalNote)}</dd>
          </dl>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onEditDetails}
            disabled={disabled}
          >
            Edit profile details
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full border-border/80 bg-card/50 text-left shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg">Club yardages</CardTitle>
            <CardDescription>
              Tap the pencil to add, edit, or remove entries. Chip also updates these on a call.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={yardageEditorOpen ? 'secondary' : 'ghost'}
            size="icon"
            className="size-10 shrink-0"
            disabled={disabled}
            onClick={() => {
              if (yardageEditorOpen) {
                closeYardageEditor();
              } else {
                setYardageEditorOpen(true);
              }
            }}
            aria-label={yardageEditorOpen ? 'Done editing yardages' : 'Edit yardages'}
            aria-pressed={yardageEditorOpen}
          >
            <Pencil className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {yardageEditorOpen && (
            <form
              className="rounded-lg border border-border/60 bg-background/30 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                addManualYardage();
              }}
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground">Add new club</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="manual-club" className="text-xs">
                    Club
                  </Label>
                  <Input
                    id="manual-club"
                    placeholder="e.g. 7-iron, 3 wood"
                    value={clubDraft}
                    disabled={disabled}
                    onChange={(e) => setClubDraft(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="w-full space-y-1.5 sm:w-28">
                  <Label htmlFor="manual-yards" className="text-xs">
                    Yards
                  </Label>
                  <Input
                    id="manual-yards"
                    type="number"
                    min={1}
                    max={400}
                    placeholder="150"
                    value={yardsDraft}
                    disabled={disabled}
                    onChange={(e) => setYardsDraft(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="h-10 shrink-0 sm:min-w-[5rem]" disabled={disabled}>
                  Add
                </Button>
              </div>
              {yardageError && <p className="mt-2 text-xs text-destructive">{yardageError}</p>}
            </form>
          )}

          {yardageEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No yardages saved yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {yardageEntries.map(([club, yds]) => {
                const isEditing = editingRowKey === club;
                return (
                  <li key={club} className="border-b border-border/50 py-2 last:border-0">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Label className="text-xs">Club</Label>
                            <Input
                              value={editClubDraft}
                              disabled={disabled}
                              onChange={(e) => setEditClubDraft(e.target.value)}
                              className="h-10"
                            />
                          </div>
                          <div className="w-full space-y-1.5 sm:w-28">
                            <Label className="text-xs">Yards</Label>
                            <Input
                              type="number"
                              min={1}
                              max={400}
                              value={editYardsDraft}
                              disabled={disabled}
                              onChange={(e) => setEditYardsDraft(e.target.value)}
                              className="h-10"
                            />
                          </div>
                        </div>
                        {editRowError && <p className="text-xs text-destructive">{editRowError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" disabled={disabled} onClick={saveRowEdit}>
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={disabled}
                            onClick={cancelRowEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium capitalize">{formatClubDisplay(club)}</span>
                          <span className="ml-2 tabular-nums text-muted-foreground">{yds} yds</span>
                        </div>
                        {yardageEditorOpen && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-10"
                              disabled={disabled}
                              onClick={() => startRowEdit(club, yds)}
                              aria-label={`Edit ${formatClubDisplay(club)}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-10 text-destructive hover:text-destructive"
                              disabled={disabled}
                              onClick={() => deleteRow(club)}
                              aria-label={`Remove ${formatClubDisplay(club)}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="w-full border-border/80 bg-card/50 text-left shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Yardage books</CardTitle>
          <CardDescription>Courses you&apos;ve prepared for Chip (indexed PDF + data).</CardDescription>
        </CardHeader>
        <CardContent>
          {preparedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet — start a round to generate one.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {preparedCourses.map((c) => (
                <li
                  key={`${c.name}-${c.preparedAt}`}
                  className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Badge variant="secondary" className="w-fit font-normal">
                    {c.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Prepared {formatDate(c.preparedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-12 w-full text-destructive hover:text-destructive"
        onClick={onClearProfile}
        disabled={disabled}
      >
        Clear saved profile
      </Button>
    </div>
  );
}
