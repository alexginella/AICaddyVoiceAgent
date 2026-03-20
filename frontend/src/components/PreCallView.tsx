import { useState } from 'react';
import { ArrowLeft, UserRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  clearCaddyProfile,
  hasCompletedOnboarding,
  loadCaddyProfile,
  loadVoiceSessions,
  markOnboardingDone,
  recordPreparedCourse,
  userProfileFromStorage,
} from '@/lib/caddyProfile';
import type { UserProfile } from '@/types/userProfile';
import type { SelectedCourse } from './CourseSelect';
import { IntakeForm } from './IntakeForm';
import { CourseSelect } from './CourseSelect';
import { HomeDashboard } from './HomeDashboard';
import { ProfilePanel } from './ProfilePanel';

type Step = 'home' | 'intake' | 'profile' | 'course' | 'ready';
type IntakeReturn = 'home' | 'profile';

interface PreCallViewProps {
  onStartCall: (userProfile: UserProfile, selectedCourse: SelectedCourse) => Promise<void>;
  liveKitUrl: string;
}

export function PreCallView({ onStartCall, liveKitUrl }: PreCallViewProps) {
  const [step, setStep] = useState<Step>(() => (hasCompletedOnboarding() ? 'home' : 'intake'));
  const [intakeReturn, setIntakeReturn] = useState<IntakeReturn>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() =>
    hasCompletedOnboarding() ? userProfileFromStorage() : null
  );
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(null);

  const goHome = () => {
    setError(null);
    setUserProfile(userProfileFromStorage());
    setStep('home');
  };

  const openProfile = () => {
    setError(null);
    setUserProfile(userProfileFromStorage());
    setStep('profile');
  };

  const openIntakeFromProfile = () => {
    setError(null);
    setIntakeReturn('profile');
    setStep('intake');
  };

  const handleIntakeNext = (profile: UserProfile) => {
    markOnboardingDone(profile);
    setUserProfile(userProfileFromStorage());
    setStep(intakeReturn === 'profile' ? 'profile' : 'home');
  };

  const handleIntakeSkip = () => {
    const minimal: UserProfile = { handedness: 'right' };
    markOnboardingDone(minimal);
    setUserProfile(userProfileFromStorage());
    setStep('home');
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
      recordPreparedCourse(name);
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
      const profile = userProfile ?? userProfileFromStorage();
      await onStartCall(profile, selectedCourse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseBack = () => {
    setSelectedCourse(null);
    setError(null);
    if (hasCompletedOnboarding()) {
      setUserProfile(userProfileFromStorage());
      setStep('home');
    } else {
      setStep('intake');
    }
  };

  const handleReadyBack = () => {
    setSelectedCourse(null);
    setStep('course');
  };

  const handleClearProfile = () => {
    if (
      !window.confirm(
        'Erase your saved profile, yardages, and yardage book list on this device? This cannot be undone.'
      )
    ) {
      return;
    }
    clearCaddyProfile();
    setUserProfile(null);
    setSelectedCourse(null);
    setError(null);
    setIntakeReturn('home');
    setStep('intake');
  };

  const configMissing = !liveKitUrl;

  const showIntakeSkip = intakeReturn === 'home' && !hasCompletedOnboarding();

  const chromeTitle =
    step === 'home'
      ? 'Home'
      : step === 'profile'
        ? 'Profile'
        : step === 'course'
          ? 'New round'
          : step === 'ready'
            ? 'Ready'
            : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      {step !== 'intake' && chromeTitle && (
        <div className="flex w-full max-w-lg items-center justify-between gap-2">
          {step === 'home' ? (
            <span className="size-10 shrink-0" aria-hidden />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              onClick={() => {
                if (step === 'profile') goHome();
                else if (step === 'course') void handleCourseBack();
                else if (step === 'ready') handleReadyBack();
              }}
              disabled={configMissing || (step === 'course' && loading)}
              aria-label={step === 'profile' ? 'Back to home' : 'Back'}
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-tight text-foreground">
            {chromeTitle}
          </span>
          {step === 'profile' ? (
            <span className="size-10 shrink-0" aria-hidden />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              onClick={openProfile}
              disabled={configMissing}
              aria-label="Open profile"
            >
              <UserRound className="size-5" />
            </Button>
          )}
        </div>
      )}

      <Card className="w-full max-w-lg border-border/80 bg-card/90 shadow-lg ring-1 ring-primary/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Chip the AI Caddy</CardTitle>
          <CardDescription className="text-base">
            {step === 'intake'
              ? 'Tell us about your game — then you can start rounds from your home screen.'
              : 'Your virtual caddy for course knowledge, club selection, and strategy.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4">
          {configMissing && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>
                Set VITE_LIVEKIT_URL in .env. Run `node api-server.js` for local token API.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'home' && (
            <HomeDashboard
              profile={userProfileFromStorage()}
              sessions={loadVoiceSessions()}
              onStartRound={() => {
                setError(null);
                setUserProfile(userProfileFromStorage());
                setStep('course');
              }}
              disabled={configMissing}
            />
          )}

          {step === 'profile' && (
            <ProfilePanel
              profile={userProfileFromStorage()}
              preparedCourses={loadCaddyProfile().preparedCourses ?? []}
              onEditDetails={openIntakeFromProfile}
              onClearProfile={handleClearProfile}
              disabled={configMissing}
            />
          )}

          {step === 'intake' && (
            <IntakeForm
              onSubmit={handleIntakeNext}
              onSkip={handleIntakeSkip}
              loading={false}
              disabled={configMissing}
              showSkip={showIntakeSkip}
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
            <div className="flex w-full flex-col gap-3">
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Yardage book ready for{' '}
                <span className="font-semibold text-foreground">{selectedCourse.name}</span>. Start your
                call when you&apos;re ready—Chip will use it on the round.
              </p>
              <Button
                type="button"
                size="lg"
                className="min-h-12 w-full text-base font-semibold"
                onClick={() => void handleStartCall()}
                disabled={loading || configMissing}
              >
                {loading ? 'Connecting…' : 'Start call'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-h-12 w-full"
                onClick={handleReadyBack}
                disabled={loading}
              >
                Change course
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
