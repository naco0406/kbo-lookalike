import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types/profile';

const STORAGE_KEY = '643-profile';

const DEFAULT_PROFILE: UserProfile = {
  nickname: '',
  favoriteTeam: null,
  avatarUrl: null,
};

export const useProfile = () => {
  const [profile, setProfile] = useLocalStorage<UserProfile>(STORAGE_KEY, DEFAULT_PROFILE);

  const setNickname = useCallback(
    (nickname: string) => setProfile((p) => ({ ...p, nickname: nickname.slice(0, 12) })),
    [setProfile],
  );

  const setFavoriteTeam = useCallback(
    (teamCode: string | null) => setProfile((p) => ({ ...p, favoriteTeam: teamCode })),
    [setProfile],
  );

  const setAvatar = useCallback(
    (avatarUrl: string | null) => setProfile((p) => ({ ...p, avatarUrl })),
    [setProfile],
  );

  return { profile, setNickname, setFavoriteTeam, setAvatar } as const;
};
