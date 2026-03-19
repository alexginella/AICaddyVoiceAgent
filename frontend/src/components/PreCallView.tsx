import { useState } from 'react';
import type { UserProfile } from './IntakeForm';
import type { SelectedCourse } from './CourseSelect';
import { IntakeForm } from './IntakeForm';
import { CourseSelect } from './CourseSelect';

type Step = 'intake' | 'course' | 'start';

interface PreCallViewProps {
  onStartCall: (userProfile: UserProfile, selectedCourse: SelectedCourse) => Promise<void>;
  liveKitUrl: string;
}

export function PreCallView({ onStartCall, liveKitUrl }: PreCallViewProps) {
  const [step, setStep] = useState<Step>('intake');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  const handleCourseSelect = async (selectedCourse: SelectedCourse) => {
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
    </div>
  );
}
