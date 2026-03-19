import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { CallView } from './components/CallView';
import { PreCallView } from './components/PreCallView';
import {
  loadCaddyProfile,
  mergeClubYardages,
  persistAfterCallEnd,
  userProfileFromStorage,
} from './lib/caddyProfile';
import type { UserProfile } from './types/userProfile';
import type { SelectedCourse } from './components/CourseSelect';

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

  const handleEndCall = () => {
    persistAfterCallEnd(userProfile);
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

  const yardagesForCall = userProfile?.clubYardages ?? loadCaddyProfile().clubYardages ?? {};

  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => handleEndCall()}
      className="h-dvh"
    >
      <CallView
        clubYardages={yardagesForCall}
        onProfileUpdate={(profile) => {
          if (!profile?.clubYardages || Object.keys(profile.clubYardages).length === 0) return;
          mergeClubYardages(profile.clubYardages);
          setUserProfile((prev) => {
            const base = prev ?? userProfileFromStorage();
            return {
              ...base,
              clubYardages: { ...base.clubYardages, ...profile.clubYardages },
            };
          });
        }}
      />
    </LiveKitRoom>
  );
}

export default App;
