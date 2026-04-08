import {
  getCurrentSession,
  getUserDisplayName,
  signOutUser,
} from "./auth-client.js";

const authSlot = document.querySelector("#auth-slot");

function buildLink(href, label, className = "auth-link") {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.className = className;
  return link;
}

function buildAccountLabel(user) {
  const displayName = getUserDisplayName(user);
  const safeName = displayName.endsWith("s") ? `${displayName}'` : `${displayName}'s`;
  return `${safeName} account`;
}

async function renderAuthNav() {
  if (!authSlot) {
    return;
  }

  authSlot.innerHTML = "";

  try {
    const session = await getCurrentSession();
    const user = session?.user || null;

    if (!user) {
      authSlot.appendChild(buildLink("auth.html", "Log in / Sign up"));
      return;
    }

    const authPill = document.createElement("div");
    authPill.className = "auth-pill";

    const accountLink = buildLink("auth.html", buildAccountLabel(user), "auth-link auth-link-account");

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "auth-logout";
    logoutButton.textContent = "Log out";
    logoutButton.addEventListener("click", async () => {
      await signOutUser();
      window.location.reload();
    });

    authPill.append(accountLink, logoutButton);
    authSlot.appendChild(authPill);
  } catch {
    authSlot.appendChild(buildLink("auth.html", "Log in / Sign up"));
  }
}

renderAuthNav();
