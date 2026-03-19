import { useState } from 'react';
import type { UserProfile } from './IntakeForm';
import type { SelectedCourse } from './CourseSelect';
import { IntakeForm } from './IntakeForm';
import { CourseSelect } from './CourseSelect';

type Step = 'intake' | 'course' | 'ready';

interface PreCallViewProps {
  onStartCall: (userProfile: UserProfile, selectedCourse: SelectedCourse) => Promise<void>;
  liveKitUrl: string;
}

export function PreCallView({ onStartCall, liveKitUrl }: PreCallViewProps) {
  const [step, setStep] = useState<Step>('intake');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(null);

  const handleIntakeNext = (profile: UserProfile) => {
    setUserProfile(profile);
    setStep('course');
  };

  const handleIntakeSkip = () => {
    setUserProfile({
      handedness: 'right',
    });
    setStep('course');
  };

  const handleCourseSelect = async (course: SelectedCourse) => {
    const name = course.name.trim();
    if (!name) {
      setError('Please select or enter a course. Your caddy needs a yardage book for the round.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/ensure-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName: name, force: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        const detailStr =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(', ')
              : '';
        throw new Error(detailStr || data.error || 'Failed to prepare course guide');
      }
      if (data.status !== 'ready') {
        throw new Error('Course guide service did not return ready');
      }
      setSelectedCourse({ name });
      setStep('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare course guide');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async () => {
    if (!selectedCourse) return;
    setError(null);
    setLoading(true);
    try {
      await onStartCall(userProfile ?? { handedness: 'right' }, selectedCourse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseBack = () => {
    setStep('intake');
  };

  const handleReadyBack = () => {
    setSelectedCourse(null);
    setStep('course');
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

      {step === 'intake' && (
        <IntakeForm
          onSubmit={handleIntakeNext}
          onSkip={handleIntakeSkip}
          loading={false}
          disabled={configMissing}
        />
      )}

      {step === 'course' && (
        <CourseSelect
          onSelect={handleCourseSelect}
          onBack={handleCourseBack}
          loading={loading}
          disabled={configMissing}
        />
      )}

      {step === 'ready' && selectedCourse && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxWidth: '360px',
            width: '100%',
            alignItems: 'stretch',
          }}
        >
          <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', margin: 0, textAlign: 'center' }}>
            Yardage book ready for <strong>{selectedCourse.name}</strong>. Start your call when you&apos;re ready—Chip will use it on the round.
          </p>
          <button
            type="button"
            onClick={handleStartCall}
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
              minHeight: '48px',
            }}
          >
            {loading ? 'Connecting…' : 'Start call'}
          </button>
          <button
            type="button"
            onClick={handleReadyBack}
            disabled={loading}
            style={{
              padding: '1rem',
              fontSize: '1rem',
              borderRadius: '0.5rem',
              background: 'var(--color-surface)',
              color: 'var(--color-muted)',
              border: '1px solid transparent',
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: '48px',
            }}
          >
            Change course
          </button>
        </div>
      )}
    </div>
  );
}
