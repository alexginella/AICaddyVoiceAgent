import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { CallView } from './components/CallView';
import { PreCallView } from './components/PreCallView';

const VITE_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL ?? '';

export type ClubYardages = Record<string, number>;

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [clubYardages, setClubYardages] = useState<ClubYardages>({});

  const handleStartCall = async (yardages: ClubYardages) => {
    setClubYardages(yardages);
    const name = `caddy-${Date.now()}`;
    setRoomName(name);

    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: name,
        identity: `user-${Date.now()}`,
        name: 'Golfer',
        clubYardages: yardages,
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
    setToken(null);
    setRoomName(null);
  };

  if (!token || !roomName || !VITE_LIVEKIT_URL) {
    return (
      <PreCallView
        onStartCall={handleStartCall}
        liveKitUrl={VITE_LIVEKIT_URL}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={VITE_LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={handleEndCall}
      style={{ height: '100dvh' }}
    >
      <CallView clubYardages={clubYardages} />
    </LiveKitRoom>
  );
}

export default App;
