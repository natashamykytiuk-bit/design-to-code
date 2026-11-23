import { create } from "zustand";
import { signOut as authSignOut, storedSession } from "./auth";
import { cloudMode } from "./config";

type CloudState = {
	/** Signed-in email; "local dev" when the API runs without sign-in; null if signed out. */
	user: string | null;
	/** The cloud design the editor is currently showing, if it came from (or was saved to) the cloud. */
	current: { id: string; name: string } | null;
	setUser: (user: string | null) => void;
	setCurrent: (current: { id: string; name: string } | null) => void;
	signOut: () => void;
};

export const useCloud = create<CloudState>((set) => ({
	user: cloudMode === "local" ? "local dev" : cloudMode === "aws" ? (storedSession()?.email ?? null) : null,
	current: null,
	setUser: (user) => set({ user }),
	setCurrent: (current) => set({ current }),
	signOut: () => {
		authSignOut();
		set({ user: null, current: null });
	},
}));
