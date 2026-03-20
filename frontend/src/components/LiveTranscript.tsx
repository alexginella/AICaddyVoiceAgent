import { useLayoutEffect, useRef } from 'react';
import { useTranscriptions } from '@livekit/components-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TranscriptionItem = {
  text?: string;
  participantInfo?: { identity?: string };
};

/** Pixels from bottom to still count as "following" the live edge */
const PIN_THRESHOLD_PX = 72;

export function LiveTranscript() {
  const transcriptions = useTranscriptions();
  const items: TranscriptionItem[] = Array.isArray(transcriptions) ? transcriptions : [];

  const viewportRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);

  const contentFingerprint = items.map((t) => t.text ?? '').join('\u0001');

  const updatePinnedFromScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinToBottomRef.current = distanceFromBottom <= PIN_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (!pinToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [contentFingerprint]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 bg-card">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Live transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-4 pt-0">
        <div
          ref={viewportRef}
          onScroll={updatePinnedFromScroll}
          className="transcript-scroll-minimal h-full min-h-[160px] overflow-y-auto overflow-x-hidden px-4"
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start speaking — transcript will appear here.</p>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {items.map((t, i) => {
                const isAgent =
                  t.participantInfo?.identity?.toLowerCase().includes('agent') ||
                  t.participantInfo?.identity?.toLowerCase().includes('caddy');
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md px-3 py-2 text-base leading-relaxed',
                      isAgent ? 'bg-primary/15' : 'bg-transparent'
                    )}
                  >
                    <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isAgent ? 'Chip' : 'You'}
                    </span>
                    {t.text ?? ''}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
