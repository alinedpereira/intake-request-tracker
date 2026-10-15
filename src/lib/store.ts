import { create } from "zustand";
import type { Person } from "@/lib/people";

export type Role = "Requestor" | "Assignee" | "Manager";

interface AppState {
  role: Role;
  setRole: (role: Role) => void;
  /** Name used to find "my" assignments (assignee) and to sign activity entries. Session memory only. */
  myName: string;
  setMyName: (name: string) => void;
  /** The requestor (SharePoint person) whose requests "My requests" shows. Session memory only. */
  me: Person | null;
  setMe: (me: Person | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: "Requestor",
  setRole: (role) => set({ role }),
  myName: "",
  setMyName: (myName) => set({ myName }),
  me: null,
  setMe: (me) => set(me ? { me, myName: me.DisplayName } : { me }),
}));
