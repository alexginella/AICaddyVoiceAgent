import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { CallView } from './components/CallView';
import { PreCallView } from './components/PreCallView';
import type { UserProfile } from './components/IntakeForm';
import type { SelectedCourse } from './components/CourseSelect';

const STORAGE_KEY = 'caddy-user-profile';

function loadStoredProfile(): Partial<UserProfile> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s) as Partial<UserProfile>;
  } catch {
    // ignore
  }
  return {};
}

function saveStoredProfile(profile: Partial<UserProfile>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const handleStartCall = async (profile: UserProfile, course: SelectedCourse) => {
    setUserProfile(profile);
    const name = `caddy-${Date.now()}`;
    setRoomName(name);

    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: name,
        identity: `user-${Date.now()}`,
        name: 'Golfer',
        userProfile: profile,
        selectedCourse: course,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to get token');
    }

    const data = await res.json();
    setToken(data.accessToken);
  };

  const handleEndCall = (profileUpdate?: UserProfile) => {
    if (profileUpdate?.clubYardages && Object.keys(profileUpdate.clubYardages).length > 0) {
      const stored = loadStoredProfile();
      const merged = {
        ...stored,
        ...profileUpdate,
        clubYardages: { ...(stored.clubYardages ?? {}), ...profileUpdate.clubYardages },
      };
      saveStoredProfile(merged);
    }
    setToken(null);
    setRoomName(null);
    setUserProfile(null);
  };

  if (!token || !roomName || !import.meta.env.VITE_LIVEKIT_URL) {
    return (
      <PreCallView
        onStartCall={handleStartCall}
        liveKitUrl={import.meta.env.VITE_LIVEKIT_URL ?? ''}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => handleEndCall()}
      style={{ height: '100dvh' }}
    >
      <CallView
        clubYardages={userProfile?.clubYardages ?? {}}
        onProfileUpdate={(profile) => {
          if (profile?.clubYardages && Object.keys(profile.clubYardages).length > 0) {
            const stored = loadStoredProfile();
            const merged = {
              ...stored,
              ...profile,
              clubYardages: { ...(stored.clubYardages ?? {}), ...profile.clubYardages },
            };
            saveStoredProfile(merged);
          }
        }}
      />
    </LiveKitRoom>
  );
}

export default App;
