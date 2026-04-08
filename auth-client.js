import {
  getCurrentMemberstackMember,
  getMemberstackDisplayName,
  logoutMemberstackMember,
  openMemberstackLoginModal,
  openMemberstackSignupModal,
} from "./memberstack-client.js";

const DISPLAY_NAME_KEY = "studyspark.member.display-names.v1";

function readDisplayNameStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(DISPLAY_NAME_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDisplayNameStore(store) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(DISPLAY_NAME_KEY, JSON.stringify(store));
}

function getMemberId(member) {
  return String(member?.id || member?.auth?.id || "").trim();
}

function getStoredDisplayName(memberId) {
  if (!memberId) {
    return "";
  }

  const store = readDisplayNameStore();
  return String(store[memberId] || "").trim();
}

function setStoredDisplayName(memberId, displayName) {
  if (!memberId) {
    return;
  }

  const trimmed = String(displayName || "").trim();
  const store = readDisplayNameStore();

  if (!trimmed) {
    delete store[memberId];
  } else {
    store[memberId] = trimmed;
  }

  writeDisplayNameStore(store);
}

function mapMemberToUser(member) {
  if (!member) {
    return null;
  }

  const memberId = getMemberId(member);
  const storedDisplayName = getStoredDisplayName(memberId);
  const fallbackName = getMemberstackDisplayName(member);

  return {
    id: memberId,
    email: String(member?.auth?.email || "").trim(),
    user_metadata: {
      display_name: storedDisplayName || fallbackName,
    },
  };
}

async function waitForSession(timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const session = await getCurrentSession();

    if (session?.user) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

export function getSupabaseClient() {
  return null;
}

export async function getCurrentSession() {
  const member = await getCurrentMemberstackMember();
  const user = mapMemberToUser(member);
  return user ? { user } : null;
}

export async function signUpWithEmail() {
  await openMemberstackSignupModal();
  return waitForSession();
}

export async function signInWithEmail() {
  await openMemberstackLoginModal();
  return waitForSession();
}

export async function signOutUser() {
  await logoutMemberstackMember();
}

export function getUserDisplayName(user) {
  if (!user) {
    return "Your";
  }

  const savedName = String(user.user_metadata?.display_name || "").trim();

  if (savedName) {
    return savedName;
  }

  const emailName = String(user.email || "")
    .split("@")[0]
    ?.trim();

  if (emailName) {
    return emailName;
  }

  return "Your";
}

export async function updateDisplayName(displayName) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    throw new Error("You need to log in first.");
  }

  setStoredDisplayName(session.user.id, displayName);

  return {
    ...session.user,
    user_metadata: {
      ...session.user.user_metadata,
      display_name: String(displayName || "").trim(),
    },
  };
}
