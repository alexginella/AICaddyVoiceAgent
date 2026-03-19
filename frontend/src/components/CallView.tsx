import { RoomAudioRenderer, useDataChannel, useRoomContext } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LiveTranscript } from './LiveTranscript';
import { cn } from '@/lib/utils';

export type ClubYardages = Record<string, number>;

interface UserProfileUpdate {
  type: 'profile_update';
  userProfile?: { clubYardages?: ClubYardages };
}

interface CallViewProps {
  clubYardages: ClubYardages;
  onProfileUpdate?: (profile: { clubYardages?: ClubYardages }) => void;
}

function EndCallButton({ className }: { className?: string }) {
  const room = useRoomContext();
  return (
    <Button
      type="button"
      size="lg"
      className={cn(
        'min-h-12 min-w-[120px] border-0 bg-red-600 text-white hover:bg-red-700',
        className
      )}
      onClick={() => void room.disconnect()}
    >
      End Call
    </Button>
  );
}

export function CallView({ clubYardages, onProfileUpdate }: CallViewProps) {
  useDataChannel('caddy', (msg) => {
    if (!onProfileUpdate) return;
    try {
      const raw = msg.payload;
      const str = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      const payload = JSON.parse(str) as UserProfileUpdate;
      if (payload?.type === 'profile_update' && payload.userProfile) {
        onProfileUpdate(payload.userProfile);
      }
    } catch {
      // ignore
    }
  });

  return (
    <div
      className={cn(
        'flex min-h-0 h-dvh flex-col px-4 pt-[var(--safe-top)] pb-[calc(1rem+var(--safe-bottom))]'
      )}
    >
      <RoomAudioRenderer />
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Chip</h2>
        <EndCallButton />
      </header>

      <LiveTranscript />

      <Card className="mt-auto shrink-0 border-border/60 bg-card/60 py-3 shadow-none">
        <CardContent className="px-4 py-0">
          {Object.keys(clubYardages).length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Your yardages:{' '}
              <span className="font-mono text-foreground/90">{JSON.stringify(clubYardages)}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tell Chip your club distances anytime during the call.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
