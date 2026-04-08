import {
  fetchHomework,
  fetchRevisionLog,
  fetchRevisionSessions,
} from "./supabase-data.js";

const statsHomeworkTotal = document.querySelector("#stats-homework-total");
const statsSessionTotal = document.querySelector("#stats-session-total");
const statsMinutesTotal = document.querySelector("#stats-minutes-total");
const statsSubjectTotal = document.querySelector("#stats-subject-total");
const statsHeroTop = document.querySelector("#stats-hero-top");
const statsHeroMiddle = document.querySelector("#stats-hero-middle");
const statsHeroBottom = document.querySelector("#stats-hero-bottom");
const statsActivity = document.querySelector("#stats-activity");
const statsStatus = document.querySelector("#stats-status");

function setStatsStatus(message, tone = "info") {
  if (!statsStatus) {
    return;
  }

  statsStatus.textContent = message;
  statsStatus.className = `auth-message auth-message-${tone}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function initStats() {
  try {
    const [tasks, revisionSessions, revisionLog] = await Promise.all([
      fetchHomework(),
      fetchRevisionSessions(),
      fetchRevisionLog(),
    ]);

    const completedHomework = tasks.filter((task) => task.completed).length;
    const totalSessions = Object.values(revisionSessions).reduce((sum, value) => sum + value, 0);
    const totalMinutes = revisionLog.reduce((sum, entry) => sum + Number(entry.duration || 0), 0);
    const subjectsRevised = new Set(
      revisionLog.map((entry) => entry.subject).filter(Boolean)
    ).size;

    statsHomeworkTotal.textContent = completedHomework;
    statsSessionTotal.textContent = totalSessions;
    statsMinutesTotal.textContent = totalMinutes;
    statsSubjectTotal.textContent = subjectsRevised;

    statsHeroTop.textContent = `${completedHomework} tasks completed`;
    statsHeroMiddle.textContent = `${totalSessions} timer sessions`;
    statsHeroBottom.textContent = `${totalMinutes} minutes logged`;

    statsActivity.innerHTML = "";

    if (revisionLog.length === 0) {
      statsActivity.innerHTML = `
        <div class="essay-block">
          <h3>No logged revision yet</h3>
          <p>Add some entries on the Revision Log page and they will show up here.</p>
        </div>
      `;
      setStatsStatus("Stats ready.", "info");
      return;
    }

    revisionLog.slice(0, 5).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "log-item";
      item.innerHTML = `
        <div class="log-top">
          <div>
            <strong>${entry.subject}</strong>
            <span>${entry.topic}</span>
          </div>
        </div>
        <p class="log-meta">${entry.duration} min • ${formatDate(entry.date)}</p>
        <p class="log-note">${entry.notes || "No extra notes for this session."}</p>
      `;
      statsActivity.appendChild(item);
    });

    setStatsStatus("Stats ready.", "info");
  } catch (error) {
    statsActivity.innerHTML = `
      <div class="essay-block">
        <h3>Could not load stats</h3>
        <p>Try logging in again or refreshing once the app has finished syncing.</p>
      </div>
    `;
    setStatsStatus(error.message || "Could not load stats.", "warning");
  }
}

initStats();
