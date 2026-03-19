import { useTranscriptions } from '@livekit/components-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function LiveTranscript() {
  const transcriptions = useTranscriptions();

  const items = Array.isArray(transcriptions) ? transcriptions : [];

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 bg-card">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Live transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-4 pt-0">
        <ScrollArea className="h-full min-h-[160px] px-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start speaking — transcript will appear here.</p>
          ) : (
            <div className="flex flex-col gap-2 pr-3 pb-2">
              {items.map(
                (
                  t: { text?: string; participantInfo?: { identity?: string } },
                  i: number
                ) => {
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
                }
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
