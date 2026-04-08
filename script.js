import {
  createHomework,
  deleteHomework,
  fetchHomework,
  fetchRevisionSessions,
  incrementRevisionSession,
  updateHomework,
} from "./supabase-data.js";

const homeworkForm = document.querySelector("#homework-form");
const taskList = document.querySelector("#task-list");
const timerElement = document.querySelector("#timer");
const timerLabel = document.querySelector("#timer-label");
const startButton = document.querySelector("#start-timer");
const pauseButton = document.querySelector("#pause-timer");
const resetButton = document.querySelector("#reset-timer");
const timerMessage = document.querySelector("#timer-message");
const presetButtons = document.querySelectorAll(".preset-btn");
const goalProgressText = document.querySelector("#goal-progress-text");
const goalProgressCaption = document.querySelector("#goal-progress-caption");
const goalProgressBar = document.querySelector("#goal-progress-bar");
const goalHomeworkCount = document.querySelector("#goal-homework-count");
const goalSessionCount = document.querySelector("#goal-session-count");
const dashboardStatus = document.querySelector("#dashboard-status");

const homeworkGoalTarget = 2;
const sessionGoalTarget = 1;

let tasks = [];
let revisionSessions = {};

let selectedMinutes = 25;
let timeRemaining = selectedMinutes * 60;
let timerId = null;

function normaliseUiError(error, fallbackMessage) {
  const message = String(error?.message || "").trim();

  if (!message) {
    return fallbackMessage;
  }

  if (message.includes("Unexpected token '<'")) {
    return "Session data could not be read. Please log out and log in again.";
  }

  if (message.includes("JWS Protected Header is invalid")) {
    return "Session token is invalid. Please log out and log in again.";
  }

  return message;
}

function setDashboardStatus(message, tone = "info") {
  if (!dashboardStatus) {
    return;
  }

  dashboardStatus.textContent = message;
  dashboardStatus.className = `auth-message auth-message-${tone}`;
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

function getCompletedHomeworkToday() {
  const today = getTodayKey();
  return tasks.filter((task) => task.completed && task.completedDate === today).length;
}

function getRevisionSessionsToday() {
  return revisionSessions[getTodayKey()] || 0;
}

function updateGoals() {
  const completedHomework = getCompletedHomeworkToday();
  const completedSessions = getRevisionSessionsToday();
  const overallCompleted =
    Math.min(completedHomework, homeworkGoalTarget) +
    Math.min(completedSessions, sessionGoalTarget);
  const overallTarget = homeworkGoalTarget + sessionGoalTarget;
  const progressPercent = (overallCompleted / overallTarget) * 100;

  goalHomeworkCount.textContent = `${completedHomework} / ${homeworkGoalTarget}`;
  goalSessionCount.textContent = `${completedSessions} / ${sessionGoalTarget}`;
  goalProgressText.textContent = `${overallCompleted} / ${overallTarget} goals completed`;
  goalProgressBar.style.width = `${Math.min(progressPercent, 100)}%`;

  if (overallCompleted === 0) {
    goalProgressCaption.textContent = "Start with one task or one timer session.";
  } else if (overallCompleted < overallTarget) {
    goalProgressCaption.textContent = "Nice start. Keep going to fill today's bar.";
  } else {
    goalProgressCaption.textContent = "Today's focus goals are complete.";
  }
}

function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "task-item";
    emptyState.innerHTML = `
      <div class="status-dot"></div>
      <div>
        <span class="task-title">No homework yet</span>
        <span class="task-meta">Add your first task to get started.</span>
      </div>
    `;
    taskList.appendChild(emptyState);
    updateGoals();
    return;
  }

  tasks
    .slice()
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .forEach((task) => {
      const item = document.createElement("li");
      item.className = `task-item ${task.completed ? "completed" : ""} ${
        task.justCompleted ? "just-completed" : ""
      }`;

      item.innerHTML = `
        <div class="status-dot"></div>
        <div>
          <span class="task-title">${task.title}</span>
          <span class="task-meta">${task.subject} • Due ${formatDate(task.dueDate)}</span>
        </div>
        <div class="task-actions">
          <button class="complete-btn" data-id="${task.id}">
            ${task.completed ? "Undo" : "Done"}
          </button>
          <button class="delete-btn" data-delete-id="${task.id}">Delete</button>
        </div>
      `;

      taskList.appendChild(item);
    });

  updateGoals();
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(timeRemaining / 60)).padStart(2, "0");
  const seconds = String(timeRemaining % 60).padStart(2, "0");
  timerElement.textContent = `${minutes}:${seconds}`;
}

function showTimerMessage() {
  timerMessage.classList.remove("hidden");
}

function hideTimerMessage() {
  timerMessage.classList.add("hidden");
}

async function recordRevisionSession() {
  const today = getTodayKey();

  try {
    const nextCount = await incrementRevisionSession(today);
    revisionSessions[today] = nextCount;
    updateGoals();
    setDashboardStatus("Revision session recorded.", "success");
  } catch (error) {
    setDashboardStatus(normaliseUiError(error, "Could not record revision session."), "warning");
  }
}

function startTimer() {
  if (timerId) return;

  hideTimerMessage();

  timerId = setInterval(async () => {
    if (timeRemaining > 0) {
      timeRemaining -= 1;
      updateTimerDisplay();
      return;
    }

    clearInterval(timerId);
    timerId = null;
    timerLabel.textContent = "Session Complete";
    showTimerMessage();

    if (selectedMinutes !== 5) {
      await recordRevisionSession();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerId);
  timerId = null;
}

function resetTimer() {
  pauseTimer();
  timeRemaining = selectedMinutes * 60;
  timerLabel.textContent = selectedMinutes === 5 ? "Break Time" : "Focus Session";
  hideTimerMessage();
  updateTimerDisplay();
}

homeworkForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const task = await createHomework({
      title: document.querySelector("#task-title").value.trim(),
      subject: document.querySelector("#task-subject").value.trim(),
      dueDate: document.querySelector("#task-date").value,
    });

    tasks.push(task);
    renderTasks();
    homeworkForm.reset();
    setDashboardStatus("Homework added.", "success");
  } catch (error) {
    setDashboardStatus(normaliseUiError(error, "Could not add homework."), "warning");
  }
});

taskList.addEventListener("click", async (event) => {
  const completeId = event.target.getAttribute("data-id");
  const deleteId = event.target.getAttribute("data-delete-id");

  try {
    if (completeId) {
      const task = tasks.find((item) => item.id === completeId);

      if (!task) return;

      const updatedTask = {
        ...task,
        completed: !task.completed,
        completedDate: !task.completed ? getTodayKey() : null,
        justCompleted: !task.completed,
      };

      await updateHomework(updatedTask);

      tasks = tasks.map((item) =>
        item.id === completeId ? updatedTask : { ...item, justCompleted: false }
      );
      setDashboardStatus(updatedTask.completed ? "Homework marked done." : "Homework reopened.", "success");
    }

    if (deleteId) {
      await deleteHomework(deleteId);
      tasks = tasks.filter((task) => task.id !== deleteId);
      setDashboardStatus("Homework deleted.", "info");
    }

    renderTasks();
  } catch (error) {
    setDashboardStatus(normaliseUiError(error, "Could not update homework."), "warning");
  }
});

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedMinutes = Number(button.dataset.minutes);
    resetTimer();
  });
});

async function initDashboard() {
  try {
    tasks = await fetchHomework();
    revisionSessions = await fetchRevisionSessions();
    renderTasks();
    setDashboardStatus("Dashboard ready.", "info");
  } catch (error) {
    tasks = [];
    revisionSessions = {};
    renderTasks();
    setDashboardStatus(normaliseUiError(error, "Could not load your dashboard yet."), "warning");
  }

  updateTimerDisplay();
}

initDashboard();
