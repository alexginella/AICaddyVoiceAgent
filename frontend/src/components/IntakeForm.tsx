import { useState, useEffect } from 'react';

export type UserProfile = {
  handicap?: number;
  age?: number;
  handedness: 'left' | 'right';
  gender?: 'male' | 'female' | 'other';
  clubs?: string;
  clubYardages?: Record<string, number>;
};

const STORAGE_KEY = 'caddy-user-profile';

function loadStored(): Partial<UserProfile> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      return JSON.parse(s) as Partial<UserProfile>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStored(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

interface IntakeFormProps {
  onSubmit: (profile: UserProfile) => void;
  onSkip: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function IntakeForm({
  onSubmit,
  onSkip,
  loading,
  disabled,
}: IntakeFormProps) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = loadStored();
    return {
      handedness: (stored.handedness as 'left' | 'right') ?? 'right',
      handicap: stored.handicap,
      age: stored.age,
      gender: stored.gender,
      clubs: stored.clubs ?? 'standard 14',
      clubYardages: stored.clubYardages,
    };
  });
  const [saveToStorage, setSaveToStorage] = useState(true);

  useEffect(() => {
    if (saveToStorage) {
      saveStored(profile);
    }
  }, [profile, saveToStorage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(profile);
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
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
        Handicap (optional)
        <input
          type="number"
          min={0}
          max={54}
          placeholder="e.g. 12"
          value={profile.handicap ?? ''}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              handicap: e.target.value ? parseInt(e.target.value, 10) : undefined,
            }))
          }
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
        Age (optional)
        <input
          type="number"
          min={1}
          max={120}
          placeholder="e.g. 35"
          value={profile.age ?? ''}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              age: e.target.value ? parseInt(e.target.value, 10) : undefined,
            }))
          }
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
        Handedness
        <select
          value={profile.handedness}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              handedness: e.target.value as 'left' | 'right',
            }))
          }
          style={inputStyle}
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
        Gender (optional, for tee recommendations)
        <select
          value={profile.gender ?? ''}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              gender: (e.target.value || undefined) as UserProfile['gender'],
            }))
          }
          style={inputStyle}
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
        Club set (optional)
        <input
          type="text"
          placeholder="e.g. standard 14, half set"
          value={profile.clubs ?? ''}
          onChange={(e) =>
            setProfile((p) => ({ ...p, clubs: e.target.value || undefined }))
          }
          style={inputStyle}
        />
      </label>

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
          style={primaryButtonStyle(Boolean(loading || disabled))}
        >
          {loading ? 'Next…' : 'Next'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={loading || disabled}
          style={secondaryButtonStyle}
        >
          Skip
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--color-surface)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
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
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '1rem',
  borderRadius: '0.5rem',
  background: 'var(--color-surface)',
  color: 'var(--color-muted)',
  border: '1px solid transparent',
  cursor: 'pointer',
};
