import { getCurrentMemberstackMember } from "./memberstack-client.js?v=20260407";

const membershipStatus = document.querySelector("#membership-status");
const upgradeButton = document.querySelector("#membership-upgrade");
const PLUS_PLAN_HINTS = ["studysparkplus", "pln_studysparkplus-qs30u04"];

function setMembershipStatus(message, tone = "info") {
  if (!membershipStatus) {
    return;
  }

  membershipStatus.textContent = message;
  membershipStatus.className = `auth-message auth-message-${tone}`;
}

function hasPlanHint(value) {
  const lower = String(value || "").toLowerCase();
  return PLUS_PLAN_HINTS.some((hint) => lower.includes(hint));
}

function memberHasPlusPlan(member) {
  if (!member || typeof member !== "object") {
    return false;
  }

  const possibleCollections = [
    member.planConnections,
    member.plan_connections,
    member.plans,
    member.plan,
  ];

  for (const collection of possibleCollections) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        const valuesToCheck = [
          item?.id,
          item?.planId,
          item?.plan_id,
          item?.slug,
          item?.name,
          item?.key,
          item?.plan?.id,
          item?.plan?.slug,
          item?.plan?.name,
        ];

        if (valuesToCheck.some(hasPlanHint)) {
          return true;
        }
      }
    } else if (collection && typeof collection === "object") {
      const valuesToCheck = [
        collection.id,
        collection.planId,
        collection.plan_id,
        collection.slug,
        collection.name,
        collection.key,
      ];

      if (valuesToCheck.some(hasPlanHint)) {
        return true;
      }
    }
  }

  return hasPlanHint(JSON.stringify(member));
}

function setUpgradeAsActive() {
  if (!upgradeButton) {
    return;
  }

  upgradeButton.disabled = false;
  upgradeButton.textContent = "Get Plus Plan";
  upgradeButton.removeAttribute("aria-disabled");
}

function setUpgradeAsOwned() {
  if (!upgradeButton) {
    return;
  }

  upgradeButton.disabled = true;
  upgradeButton.textContent = "You already have this plan";
  upgradeButton.setAttribute("aria-disabled", "true");
}

async function initMembershipPage() {
  try {
    const member = await getCurrentMemberstackMember();

    if (!member) {
      setUpgradeAsActive();
      setMembershipStatus(
        "You are not signed in yet. Upgrade now will open signup first, then continue into checkout.",
        "info"
      );
      return;
    }

    if (memberHasPlusPlan(member)) {
      setUpgradeAsOwned();
      setMembershipStatus("You already have StudySpark Plus on this account.", "success");
      return;
    }

    setUpgradeAsActive();
    setMembershipStatus(
      "You are signed in. Upgrade now will continue through the premium checkout flow.",
      "success"
    );
    return;
  } catch {
    setUpgradeAsActive();
    setMembershipStatus(
      "Membership tools are ready. If checkout feels slow, refresh once and try again.",
      "warning"
    );
  }
}

initMembershipPage();
