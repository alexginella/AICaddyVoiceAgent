import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { VoiceSession } from '@/lib/caddyProfile';
import type { UserProfile } from '@/types/userProfile';

function formatEnded(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface HomeDashboardProps {
  profile: UserProfile;
  sessions: VoiceSession[];
  onStartRound: () => void;
  disabled?: boolean;
}

export function HomeDashboard({ profile, sessions, onStartRound, disabled }: HomeDashboardProps) {
  const summary =
    profile.handicap != null
      ? `Handicap ${profile.handicap} · ${profile.handedness === 'left' ? 'Left' : 'right'}-handed`
      : `${profile.handedness === 'left' ? 'Left' : 'Right'}-handed golfer`;

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">{summary}</p>

      <Button
        type="button"
        size="lg"
        className="min-h-12 w-full text-base font-semibold"
        onClick={onStartRound}
        disabled={disabled}
      >
        Start new round
      </Button>

      <Card className="w-full border-border/80 bg-card/50 text-left shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-lg">Recent sessions</CardTitle>
          </div>
          <CardDescription>Voice rounds you&apos;ve finished with Chip on this device.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions yet. Start a round above to talk with your caddy.
            </p>
          ) : (
            <ScrollArea className="max-h-[min(40vh,280px)] pr-3">
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Badge variant="secondary" className="w-fit font-normal">
                      {s.courseName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatEnded(s.endedAt)}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
