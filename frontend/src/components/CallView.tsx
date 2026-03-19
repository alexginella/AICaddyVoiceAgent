import { DisconnectButton } from '@livekit/components-react';
import type { ClubYardages } from '../App';
import { LiveTranscript } from './LiveTranscript';

interface CallViewProps {
  clubYardages: ClubYardages;
}

export function CallView({ clubYardages }: CallViewProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: 'var(--safe-top) 1rem 1rem',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-accent)' }}>
          Chip
        </h2>
        <DisconnectButton
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            borderRadius: '0.5rem',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            minHeight: '48px',
            minWidth: '120px',
          }}
        >
          End Call
        </DisconnectButton>
      </header>

      <LiveTranscript />

      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1rem',
          fontSize: '0.8rem',
          color: 'var(--color-muted)',
        }}
      >
        {Object.keys(clubYardages).length > 0 ? (
          <span>Your yardages: {JSON.stringify(clubYardages)}</span>
        ) : (
          <span>Tell Chip your club distances anytime during the call.</span>
        )}
      </div>
    </div>
  );
}

