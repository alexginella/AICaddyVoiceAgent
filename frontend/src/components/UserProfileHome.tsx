import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { PreparedCourse } from '@/lib/caddyProfile';
import type { UserProfile } from '@/types/userProfile';

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

interface UserProfileHomeProps {
  profile: UserProfile;
  preparedCourses: PreparedCourse[];
  onNewRound: () => void;
  onEditProfile: () => void;
  onClearProfile: () => void;
  disabled?: boolean;
}

export function UserProfileHome({
  profile,
  preparedCourses,
  onNewRound,
  onEditProfile,
  onClearProfile,
  disabled,
}: UserProfileHomeProps) {
  const yardages = profile.clubYardages ?? {};
  const yardageEntries = Object.entries(yardages).sort(([a], [b]) => a.localeCompare(b));

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
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your profile</CardTitle>
          <CardDescription>Used for tee tips and club advice on your next call.</CardDescription>
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
            <dt className="text-muted-foreground">Club set</dt>
            <dd>{profile.clubs ?? '—'}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="w-full border-border/80 bg-card/50 text-left shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Club yardages</CardTitle>
          <CardDescription>Updated when Chip saves distances you mention on a call.</CardDescription>
        </CardHeader>
        <CardContent>
          {yardageEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No yardages saved yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {yardageEntries.map(([club, yds]) => (
                <li key={club} className="flex justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
                  <span className="font-medium capitalize">{club.replace(/-/g, ' ')}</span>
                  <span className="tabular-nums text-muted-foreground">{yds} yds</span>
                </li>
              ))}
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

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="min-h-12 w-full text-base font-semibold"
          onClick={onNewRound}
          disabled={disabled}
        >
          Play a round
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-12 w-full"
          onClick={onEditProfile}
          disabled={disabled}
        >
          Edit profile
        </Button>
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
    </div>
  );
}
