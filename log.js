import {
  createRevisionLogEntry,
  deleteRevisionLogEntry,
  fetchRevisionLog,
} from "./supabase-data.js?v=20260407";

const logForm = document.querySelector("#log-form");
const logList = document.querySelector("#log-list");
const logDateInput = document.querySelector("#log-date");
const logStatus = document.querySelector("#log-status");

let revisionLog = [];

function setLogStatus(message, tone = "info") {
  if (!logStatus) {
    return;
  }

  logStatus.textContent = message;
  logStatus.className = `auth-message auth-message-${tone}`;
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderLog() {
  logList.innerHTML = "";

  if (revisionLog.length === 0) {
    logList.innerHTML = `
      <div class="essay-block">
        <h3>No revision entries yet</h3>
        <p>Log your first session to start building a revision history.</p>
      </div>
    `;
    return;
  }

  revisionLog
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((entry) => {
      const item = document.createElement("article");
      item.className = "log-item";
      item.innerHTML = `
        <div class="log-top">
          <div>
            <strong>${entry.subject}</strong>
            <span>${entry.topic}</span>
          </div>
          <button class="delete-btn" data-delete-id="${entry.id}">Delete</button>
        </div>
        <p class="log-meta">${entry.duration} min • ${formatDate(entry.date)}</p>
        <p class="log-note">${entry.notes || "No extra notes for this session."}</p>
      `;
      logList.appendChild(item);
    });
}

logForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const entry = await createRevisionLogEntry({
      subject: document.querySelector("#log-subject").value.trim(),
      topic: document.querySelector("#log-topic").value.trim(),
      duration: Number(document.querySelector("#log-duration").value),
      date: logDateInput.value,
      notes: document.querySelector("#log-notes").value.trim(),
    });

    revisionLog.unshift(entry);
    renderLog();
    logForm.reset();
    logDateInput.value = getTodayKey();
    setLogStatus("Revision entry saved.", "success");
  } catch (error) {
    setLogStatus(error.message || "Could not save revision entry.", "warning");
  }
});

logList.addEventListener("click", async (event) => {
  const deleteId = event.target.getAttribute("data-delete-id");

  if (!deleteId) return;

  try {
    await deleteRevisionLogEntry(deleteId);
    revisionLog = revisionLog.filter((entry) => entry.id !== deleteId);
    renderLog();
    setLogStatus("Revision entry deleted.", "info");
  } catch (error) {
    setLogStatus(error.message || "Could not delete revision entry.", "warning");
  }
});

async function initLog() {
  logDateInput.value = getTodayKey();

  try {
    revisionLog = await fetchRevisionLog();
    renderLog();
    setLogStatus("Revision log ready.", "info");
  } catch (error) {
    revisionLog = [];
    renderLog();
    setLogStatus(error.message || "Could not load revision log.", "warning");
  }
}

initLog();
