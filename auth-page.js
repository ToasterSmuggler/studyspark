import {
  getCurrentSession,
  getUserDisplayName,
  signOutUser,
  updateDisplayName,
} from "./auth-client.js";
import {
  openMemberstackLoginModal,
  openMemberstackSignupModal,
} from "./memberstack-client.js";

const loginButton = document.querySelector("#login-open");
const signupButton = document.querySelector("#signup-open");
const authMessage = document.querySelector("#auth-message");
const authForms = document.querySelector("#auth-forms");
const accountPanel = document.querySelector("#account-panel");
const accountHeading = document.querySelector("#account-heading");
const accountEmail = document.querySelector("#account-email");
const accountNameForm = document.querySelector("#account-name-form");
const accountNameInput = document.querySelector("#account-name");
const accountLogoutButton = document.querySelector("#account-logout");

function setAuthMessage(message, tone = "info") {
  authMessage.textContent = message;
  authMessage.className = `auth-message auth-message-${tone}`;
}

function showAccountPanel(user) {
  authForms.hidden = true;
  accountPanel.hidden = false;

  const displayName = getUserDisplayName(user);
  const safeName = displayName.endsWith("s") ? `${displayName}'` : `${displayName}'s`;
  accountHeading.textContent = `${safeName} account`;
  accountEmail.textContent = user.email || "Signed in";
  accountNameInput.value = displayName || "";
}

function showAuthForms() {
  authForms.hidden = false;
  accountPanel.hidden = true;
}

let sessionPollId = null;

async function checkExistingSession() {
  const session = await getCurrentSession();

  if (session?.user) {
    showAccountPanel(session.user);
    setAuthMessage(`Signed in as ${session.user.email || "your account"}`, "success");
  } else {
    showAuthForms();
    setAuthMessage("Ready to log in or create your account.", "info");
  }
}

async function openLoginModal() {
  try {
    setAuthMessage("Opening login...", "info");
    await openMemberstackLoginModal();
    await checkExistingSession();
  } catch (error) {
    setAuthMessage(error.message || "Could not open login.", "warning");
  }
}

async function openSignupModal() {
  try {
    setAuthMessage("Opening signup...", "info");
    await openMemberstackSignupModal();
    await checkExistingSession();
  } catch (error) {
    setAuthMessage(error.message || "Could not open signup.", "warning");
  }
}

loginButton?.addEventListener("click", openLoginModal);
signupButton?.addEventListener("click", openSignupModal);

accountNameForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const updatedUser = await updateDisplayName(accountNameInput.value);
    showAccountPanel(updatedUser);
    setAuthMessage("Account name updated.", "success");
  } catch (error) {
    setAuthMessage(error.message || "Could not update your account name.", "warning");
  }
});

accountLogoutButton?.addEventListener("click", async () => {
  try {
    await signOutUser();
    showAuthForms();
    setAuthMessage("Logged out successfully.", "info");
  } catch (error) {
    setAuthMessage(error.message || "Could not log out.", "warning");
  }
});

checkExistingSession();

if (sessionPollId) {
  clearInterval(sessionPollId);
}

sessionPollId = setInterval(() => {
  checkExistingSession().catch(() => {
    setAuthMessage("Checking account status...", "info");
  });
}, 3000);
