import { createContext, useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export const ProfileContext = createContext(null);

export function ProfileProvider({ children, user }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const fn = httpsCallable(functions, "getProfile");
      const result = await fn();
      if (result.data.ok) {
        setProfile(result.data.data.profile);
      } else {
        setProfileError(result.data.error?.message ?? "Failed to load profile.");
      }
    } catch (err) {
      setProfileError(err.message ?? "Failed to load profile.");
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function patchProfile(updates) {
    setProfile((prev) => (prev ? { ...prev, ...updates } : updates));
  }

  const isOnboarded =
    profile !== null && profile.age !== null && profile.targetRetirementYear !== null;

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileLoading,
        profileError,
        patchProfile,
        isOnboarded,
        reloadProfile: loadProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
