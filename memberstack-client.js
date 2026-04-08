function getMemberstackDom() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.$memberstackDom || null;
}

function findJwtInText(text) {
  const value = String(text || "");
  const match = value.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match ? match[0] : "";
}

function decodeJwtPayload(token) {
  try {
    const [, payloadPart] = String(token || "").split(".");

    if (!payloadPart) {
      return null;
    }

    const normalised = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isLikelyJwt(value) {
  const token = String(value || "").trim();

  if (!token || token === "[object Object]") {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  if (!parts.every((part) => /^[A-Za-z0-9\-_]+$/.test(part))) {
    return false;
  }

  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload !== "object") {
    return false;
  }

  const issuer = String(payload.iss || "").toLowerCase();
  return issuer.includes("memberstack");
}

export async function waitForMemberstack(timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const memberstack = getMemberstackDom();

    if (memberstack) {
      return memberstack;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function getCurrentMemberstackMember() {
  const memberstack = await waitForMemberstack();

  if (!memberstack) {
    return null;
  }

  const member = await memberstack.getCurrentMember();
  return member?.data || null;
}

export async function getMemberstackToken() {
  const memberstack = await waitForMemberstack();

  if (!memberstack) {
    return null;
  }

  const candidateGetters = [
    () => (typeof memberstack.getToken === "function" ? memberstack.getToken() : null),
    () =>
      typeof memberstack.getMemberCookie === "function" ? memberstack.getMemberCookie() : null,
    () => (typeof memberstack.getMemberJWT === "function" ? memberstack.getMemberJWT() : null),
    () => memberstack.getMemberCookie,
    () => memberstack.token,
    () => memberstack.jwt,
  ];

  for (const getter of candidateGetters) {
    try {
      const value = await getter();
      const token = String(value || "").trim();

      if (isLikelyJwt(token)) {
        return token;
      }
    } catch {
      // Try the next strategy.
    }
  }

  try {
    if (typeof memberstack.getCurrentMember === "function") {
      const currentMember = await memberstack.getCurrentMember();
      const data = currentMember?.data || currentMember || {};
      const nestedCandidates = [
        data.token,
        data.jwt,
        data.accessToken,
        data.access_token,
        data.auth?.token,
        data.auth?.jwt,
        data.auth?.accessToken,
        currentMember?.token,
        currentMember?.jwt,
      ];

      for (const candidate of nestedCandidates) {
        const token = String(candidate || "").trim();

        if (isLikelyJwt(token)) {
          return token;
        }
      }
    }
  } catch {
    // Ignore and return null below.
  }

  if (typeof document !== "undefined") {
    const cookieParts = String(document.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of cookieParts) {
      const [rawName = "", rawValue = ""] = part.split("=");
      const name = String(rawName || "").toLowerCase();

      if (!name.includes("memberstack") && !name.startsWith("ms_")) {
        continue;
      }

      const decodedValue = decodeURIComponent(rawValue || "");
      const jwt = findJwtInText(decodedValue);

      if (isLikelyJwt(jwt)) {
        return jwt;
      }
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (!key || !key.toLowerCase().includes("memberstack")) {
          continue;
        }

        const value = window.localStorage.getItem(key) || "";
        const jwt = findJwtInText(value);

        if (isLikelyJwt(jwt)) {
          return jwt;
        }
      }
    } catch {
      // Ignore storage read issues and fall through.
    }
  }

  return null;
}

export function getMemberstackDisplayName(member) {
  if (!member) {
    return "Your";
  }

  const firstName = member.customFields?.["first-name"]?.trim();
  const lastName = member.customFields?.["last-name"]?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  const emailName = member.auth?.email?.split("@")[0]?.trim();

  if (emailName) {
    return emailName;
  }

  return "Your";
}

export async function logoutMemberstackMember() {
  const memberstack = await waitForMemberstack();

  if (!memberstack) {
    return;
  }

  await memberstack.logout();
}

export async function openMemberstackSignupModal() {
  const memberstack = await waitForMemberstack();

  if (!memberstack) {
    throw new Error("Memberstack is not available on this page.");
  }

  await memberstack.openModal("SIGNUP");
}

export async function openMemberstackLoginModal() {
  const memberstack = await waitForMemberstack();

  if (!memberstack) {
    throw new Error("Memberstack is not available on this page.");
  }

  await memberstack.openModal("LOGIN");
}
