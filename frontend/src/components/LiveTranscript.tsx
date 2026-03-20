import { useLayoutEffect, useMemo, useRef } from 'react';
import { useTranscriptions } from '@livekit/components-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TranscriptionItem = {
  text?: string;
  participantInfo?: { identity?: string };
};

type MergedLine = { isAgent: boolean; text: string };

function isAgentSpeaker(t: TranscriptionItem): boolean {
  const id = t.participantInfo?.identity?.toLowerCase() ?? '';
  return id.includes('agent') || id.includes('caddy');
}

/** ASR often splits one utterance into many segments after short pauses; merge same speaker. */
function mergeConsecutiveBySpeaker(items: TranscriptionItem[]): MergedLine[] {
  const out: MergedLine[] = [];
  for (const t of items) {
    const text = (t.text ?? '').trim();
    if (!text) continue;
    const agent = isAgentSpeaker(t);
    const prev = out[out.length - 1];
    if (prev && prev.isAgent === agent) {
      prev.text = `${prev.text} ${text}`.trim();
    } else {
      out.push({ isAgent: agent, text });
    }
  }
  return out;
}

/** Pixels from bottom to still count as "following" the live edge */
const PIN_THRESHOLD_PX = 72;

export function LiveTranscript() {
  const transcriptions = useTranscriptions();
  const items: TranscriptionItem[] = Array.isArray(transcriptions) ? transcriptions : [];
  const lines = useMemo(() => mergeConsecutiveBySpeaker(items), [items]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);

  const contentFingerprint = lines.map((t) => t.text).join('\u0001');

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
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start speaking — transcript will appear here.</p>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {lines.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-md px-3 py-2 text-base leading-relaxed',
                    t.isAgent ? 'bg-primary/15' : 'bg-transparent'
                  )}
                >
                  <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.isAgent ? 'Chip' : 'You'}
                  </span>
                  {t.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
