import { createPersistStore } from "../utils/store";

export type User = {
  id: number;
  email: string;
  gpt3_base: number;
  gpt4_base: number;
  type: string;
};

export type UserConfig = {
  user: User | null;
  token: string | null;
  lastSignTime: number | null;
};

export const DEFAULT_USER_CONFIG: UserConfig = {
  user: null,
  token: null,
  lastSignTime: null,
};

export const useUserConfig = createPersistStore(
  DEFAULT_USER_CONFIG,
  (set, get) => ({
    setUser(user: User, token: string) {
      const currentTime = Date.now();
      set(() => ({
        user,
        token,
        lastSignTime: currentTime,
      }));
    },
    clearUser() {
      set(() => ({
        user: null,
        token: null,
        lastSignTime: null,
      }));
    },
    isLastSignTimeExpired() {
      const { lastSignTime } = get();
      if (lastSignTime) {
        const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1000;
        return Date.now() - lastSignTime > thirtyDaysInMilliseconds;
      }
      return false;
    },
    isUserLoggedIn() {
      const { user, token } = get();
      return user !== null && token !== null && !this.isLastSignTimeExpired();
    },
  }),
  {
    name: "UserConfig",
    version: 1,
  },
);
