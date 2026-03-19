import { useTranscriptions } from '@livekit/components-react';

export function LiveTranscript() {
  const transcriptions = useTranscriptions();

  const items = Array.isArray(transcriptions) ? transcriptions : [];

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--color-surface)',
        borderRadius: '0.5rem',
        padding: '1rem',
        fontSize: '1rem',
        lineHeight: 1.6,
        minHeight: '200px',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
        Live transcript
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>
          Start speaking — transcript will appear here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((t: { text?: string; participantInfo?: { identity?: string } }, i: number) => (
            <div
              key={i}
              style={{
                padding: '0.5rem',
                borderRadius: '0.25rem',
                background:
                  t.participantInfo?.identity?.toLowerCase().includes('agent') ||
                  t.participantInfo?.identity?.toLowerCase().includes('caddy')
                    ? 'rgba(74, 222, 128, 0.15)'
                    : 'transparent',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.8rem', marginRight: '0.5rem' }}>
                {t.participantInfo?.identity?.toLowerCase().includes('agent') ? 'Chip' : 'You'}:
              </span>
              {t.text ?? ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
