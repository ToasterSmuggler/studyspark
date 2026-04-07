function getMemberstackDom() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.$memberstackDom || null;
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

  if (typeof memberstack.getToken === "function") {
    const token = await memberstack.getToken();

    if (token) {
      return token;
    }
  }

  if (typeof memberstack.getMemberCookie === "function") {
    const token = await memberstack.getMemberCookie();
    return token || null;
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
