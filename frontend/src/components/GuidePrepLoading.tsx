import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PHASES = [
  'Checking for an existing yardage book…',
  'Fetching course details from the golf database…',
  'Generating your yardage book (this can take a minute)…',
  'Indexing the book so Chip can search it…',
  'Finishing up…',
] as const;

interface GuidePrepLoadingProps {
  courseName: string;
  /** When false, phase timers stop and state resets */
  active: boolean;
}

export function GuidePrepLoading({ courseName, active }: GuidePrepLoadingProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    setPhase(0);
    const id = window.setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASES.length - 1));
    }, 3200);
    return () => clearInterval(id);
  }, [active]);

  const displayName = courseName.trim() || 'Course';

  return (
    <div
      className="flex w-full max-w-md flex-col gap-5 py-1"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Preparing yardage book"
    >
      <div className="flex items-start gap-3">
        <Loader2
          className="size-8 shrink-0 animate-spin text-primary"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground">Preparing your yardage book</p>
          <CardDescription className="text-sm font-medium text-foreground/90">
            {displayName}
          </CardDescription>
          <p className="text-sm leading-relaxed text-muted-foreground">{PHASES[phase]}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5" aria-hidden>
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-300',
                i <= phase ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Step {phase + 1} of {PHASES.length} — hang tight while the guide service works.
        </p>
      </div>
    </div>
  );
}
