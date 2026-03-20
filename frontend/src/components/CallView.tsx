import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { RoomAudioRenderer, useDataChannel, useLocalParticipant, useRoomContext } from '@livekit/components-react';
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

function RoundControls({ className }: { className?: string }) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [micBusy, setMicBusy] = useState(false);

  const toggleMic = async () => {
    setMicBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } finally {
      setMicBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      <Button
        type="button"
        size="lg"
        variant={isMicrophoneEnabled ? 'secondary' : 'default'}
        className="min-h-12 min-w-0 flex-1 sm:flex-initial"
        disabled={micBusy}
        onClick={() => void toggleMic()}
        aria-pressed={isMicrophoneEnabled}
      >
        {isMicrophoneEnabled ? (
          <>
            <MicOff className="size-5 shrink-0" aria-hidden />
            Pause
          </>
        ) : (
          <>
            <Mic className="size-5 shrink-0" aria-hidden />
            Resume
          </>
        )}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className={cn(
          'min-h-12 min-w-0 flex-1 border-0 sm:flex-initial',
          'bg-red-600 text-white hover:bg-red-700 hover:text-white',
          'focus-visible:border-red-400 focus-visible:ring-red-500/35'
        )}
        onClick={() => void room.disconnect()}
      >
        End round
      </Button>
    </div>
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
      <header className="mb-3 flex shrink-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary">Chip</h2>
          <p className="text-xs text-muted-foreground">
            Pause mutes your mic; Chip stays connected. End round hangs up.
          </p>
        </div>
        <RoundControls className="w-full sm:w-auto sm:shrink-0" />
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
