import { useState, useCallback } from 'react';

export type SelectedCourse = { name: string };

interface CourseSelectProps {
  onSelect: (course: SelectedCourse) => void;
  onBack: () => void;
  loading: boolean;
  disabled?: boolean;
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-surface)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '1rem',
  minHeight: '48px',
  width: '100%',
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '1rem 1.5rem',
  fontSize: '1.1rem',
  fontWeight: 600,
  borderRadius: '0.5rem',
  background: 'var(--color-accent)',
  color: 'var(--color-bg)',
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
  minHeight: '48px',
});

const secondaryButtonStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '1rem',
  borderRadius: '0.5rem',
  background: 'var(--color-surface)',
  color: 'var(--color-muted)',
  border: '1px solid transparent',
  cursor: 'pointer',
  minHeight: '48px',
};

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '360px',
        width: '100%',
      }}
    >
      <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', margin: 0 }}>
        Where are you playing? We'll load course details for the caddy.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="City or zip code"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchByLocation()}
          style={inputStyle}
          disabled={isDisabled}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={fetchByLocation}
            disabled={isDisabled || fetching || !locationInput.trim()}
            style={primaryButtonStyle(isDisabled || fetching || !locationInput.trim())}
          >
            {fetching ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isDisabled || fetching}
            style={secondaryButtonStyle}
          >
            Use my location
          </button>
        </div>
      </div>

      {fetchError && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{fetchError}</p>
      )}

      {courses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
            Select a course:
          </span>
          {courses.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => handleSelectCourse(c)}
              disabled={isDisabled}
              style={{
                padding: '1rem',
                textAlign: 'left',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-surface)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                minHeight: '48px',
                fontSize: '1rem',
              }}
            >
              {c.name}
              {c.distance && (
                <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                  ({c.distance})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
          Or type a different course name:
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="e.g. Pebble Beach"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            style={inputStyle}
            disabled={isDisabled}
          />
          <button
            type="submit"
            disabled={isDisabled || !customName.trim()}
            style={primaryButtonStyle(isDisabled || !customName.trim())}
          >
            Use
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isDisabled}
          style={secondaryButtonStyle}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onSelect({ name: '' })}
          disabled={isDisabled}
          style={{
            ...secondaryButtonStyle,
            color: 'var(--color-text)',
          }}
        >
          Skip (no course)
        </button>
      </div>
    </div>
  );
}
