const AUTH_REFRESH_KEY = 'story_auth_refresh';
const AUTH_REFRESH_CHANNEL = 'story_auth_channel';

export const broadcastAuthRefresh = () => {
  const payload = `${Date.now()}`;
  try {
    localStorage.setItem(AUTH_REFRESH_KEY, payload);
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel(AUTH_REFRESH_CHANNEL);
    channel.postMessage({ type: 'auth:refresh', ts: payload });
    channel.close();
  }
};

export const subscribeAuthRefresh = (onRefresh: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_REFRESH_KEY || !event.newValue) return;
    onRefresh();
  };

  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(AUTH_REFRESH_CHANNEL);
    channel.onmessage = (event) => {
      const data = event?.data as { type?: string } | undefined;
      if (data?.type === 'auth:refresh') {
        onRefresh();
      }
    };
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
};
