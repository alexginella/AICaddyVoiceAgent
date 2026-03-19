import { useState, useEffect } from 'react';
import type { ClubYardages } from '../App';

const PRESET_CLUBS = [
  'driver',
  '3w',
  '5i',
  '6i',
  '7i',
  '8i',
  '9i',
  'pw',
  'gw',
  'sw',
] as const;

const STORAGE_KEY = 'ai-caddy-club-yardages';

function loadStored(): ClubYardages {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s) as Record<string, number>;
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStored(yardages: ClubYardages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(yardages));
  } catch {
    // ignore
  }
}

interface ClubYardagesFormProps {
  onSubmit: (yardages: ClubYardages) => Promise<void>;
  onSkip: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function ClubYardagesForm({
  onSubmit,
  onSkip,
  loading,
  disabled,
}: ClubYardagesFormProps) {
  const [yardages, setYardages] = useState<ClubYardages>(loadStored);
  const [saveToStorage, setSaveToStorage] = useState(true);

  useEffect(() => {
    if (saveToStorage && Object.keys(yardages).length > 0) {
      saveStored(yardages);
    }
  }, [yardages, saveToStorage]);

  const handleChange = (club: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      const next = { ...yardages };
      delete next[club];
      setYardages(next);
    } else {
      setYardages((prev) => ({ ...prev, [club]: num }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(yardages);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '320px',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          fontSize: '0.9rem',
        }}
      >
        {PRESET_CLUBS.map((club) => (
          <label
            key={club}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ flex: 1, textTransform: 'capitalize' }}>{club}</span>
            <input
              type="number"
              min={1}
              max={400}
              placeholder="—"
              value={yardages[club] ?? ''}
              onChange={(e) => handleChange(club, e.target.value)}
              style={{
                width: '4.5rem',
                padding: '0.4rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-surface)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.9rem',
              }}
            />
          </label>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        <input
          type="checkbox"
          checked={saveToStorage}
          onChange={(e) => setSaveToStorage(e.target.checked)}
        />
        Save for next time
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="submit"
          disabled={loading || disabled}
          style={{
            flex: 1,
            padding: '1rem 1.5rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            border: 'none',
            cursor: loading || disabled ? 'not-allowed' : 'pointer',
            opacity: loading || disabled ? 0.7 : 1,
          }}
        >
          {loading ? 'Starting…' : 'Start Call'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={loading || disabled}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            borderRadius: '0.5rem',
            background: 'var(--color-surface)',
            color: 'var(--color-muted)',
            border: '1px solid transparent',
            cursor: loading || disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </form>
  );
}
