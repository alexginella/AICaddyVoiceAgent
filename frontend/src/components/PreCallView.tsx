import { useState } from 'react';
import type { ClubYardages } from '../App';
import { ClubYardagesForm } from './ClubYardagesForm';

interface PreCallViewProps {
  onStartCall: (yardages: ClubYardages) => Promise<void>;
  liveKitUrl: string;
}

export function PreCallView({ onStartCall, liveKitUrl }: PreCallViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showYardages, setShowYardages] = useState(true);

  const handleSubmit = async (yardages: ClubYardages) => {
    setError(null);
    setLoading(true);
    try {
      await onStartCall(yardages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call');
    } finally {
      setLoading(false);
    }
  };

  const configMissing = !liveKitUrl;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        gap: '1.5rem',
      }}
    >
      <header style={{ textAlign: 'center', maxWidth: '320px' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--color-accent)' }}>
          Chip the AI Caddy
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
          Your virtual caddy for course knowledge, club selection, and strategy.
        </p>
      </header>

      {configMissing && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', textAlign: 'center' }}>
          Set VITE_LIVEKIT_URL in .env. Run `node api-server.js` for local token API.
        </p>
      )}

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {showYardages ? (
        <ClubYardagesForm
          onSubmit={handleSubmit}
          onSkip={() => handleSubmit({})}
          loading={loading}
          disabled={configMissing}
        />
      ) : (
        <button
          type="button"
          onClick={() => handleSubmit({})}
          disabled={loading || configMissing}
          style={{
            padding: '1rem 1.5rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            border: 'none',
            cursor: loading || configMissing ? 'not-allowed' : 'pointer',
            opacity: loading || configMissing ? 0.7 : 1,
          }}
        >
          {loading ? 'Starting…' : 'Start Call'}
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowYardages(!showYardages)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-muted)',
          fontSize: '0.8rem',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {showYardages ? 'Skip yardages' : 'Add yardages'}
      </button>
    </div>
  );
}
