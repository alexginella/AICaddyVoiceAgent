import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type SelectedCourse = { name: string };

interface CourseSelectProps {
  onSelect: (course: SelectedCourse) => void;
  onBack: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function CourseSelect({
  onSelect,
  onBack,
  loading,
  disabled,
}: CourseSelectProps) {
  const [locationInput, setLocationInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [courses, setCourses] = useState<Array<{ name: string; distance?: string }>>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/nearby-courses?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch courses');
      setCourses(data.courses ?? []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch courses');
      setCourses([]);
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchByLocation = useCallback(async () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/nearby-courses?location=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch courses');
      setCourses(data.courses ?? []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch courses');
      setCourses([]);
    } finally {
      setFetching(false);
    }
  }, [locationInput]);

  const handleUseMyLocation = () => {
    setFetchError(null);
    if (!navigator.geolocation) {
      setFetchError('Geolocation not supported');
      return;
    }
    setFetching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchNearby(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setFetchError('Could not get location');
        setFetching(false);
      }
    );
  };

  const handleSelectCourse = (course: { name: string }) => {
    onSelect({ name: course.name });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customName.trim();
    if (name) {
      onSelect({ name });
    }
  };

  const isDisabled = disabled || loading;
  const searchDisabled = isDisabled || fetching || !locationInput.trim();

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <CardDescription className="text-base leading-relaxed">
        Where are you playing? We&apos;ll prepare a yardage book for Chip before your call.
      </CardDescription>

      <div className="flex flex-col gap-2">
        <Input
          type="text"
          placeholder="City or zip code"
          value={locationInput}
          disabled={isDisabled}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void fetchByLocation()}
          className="h-12 md:h-10"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            className="min-h-12 flex-1 sm:min-h-10"
            disabled={searchDisabled}
            onClick={() => void fetchByLocation()}
          >
            {fetching ? 'Searching…' : 'Search'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="min-h-12 flex-1 sm:min-h-10"
            disabled={isDisabled || fetching}
            onClick={handleUseMyLocation}
          >
            Use my location
          </Button>
        </div>
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {courses.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Select a course:</p>
          <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
            {courses.map((c) => (
              <Button
                key={c.name}
                type="button"
                variant="outline"
                disabled={isDisabled}
                onClick={() => handleSelectCourse(c)}
                className={cn(
                  'h-auto min-h-12 w-full justify-start whitespace-normal py-3 text-left font-normal'
                )}
              >
                <span className="break-words">{c.name}</span>
                {c.distance && (
                  <span className="ml-2 shrink-0 text-muted-foreground">({c.distance})</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleCustomSubmit} className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Or type a different course name:
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            placeholder="e.g. Pebble Beach"
            value={customName}
            disabled={isDisabled}
            onChange={(e) => setCustomName(e.target.value)}
            className="h-12 min-w-0 flex-1 md:h-10"
          />
          <Button
            type="submit"
            size="lg"
            className="min-h-12 shrink-0 sm:min-h-10"
            disabled={isDisabled || !customName.trim()}
          >
            Use
          </Button>
        </div>
      </form>

      <Separator />

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="min-h-12 w-full md:min-h-10"
        onClick={onBack}
        disabled={isDisabled}
      >
        Back
      </Button>
    </div>
  );
}
