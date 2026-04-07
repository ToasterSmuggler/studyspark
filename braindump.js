import { fetchBrainDumpState, saveBrainDumpState } from "./supabase-data.js?v=20260407";

const brainTimerElement = document.querySelector("#brain-timer");
const brainTimerLabel = document.querySelector("#brain-timer-label");
const brainStartButton = document.querySelector("#brain-start");
const brainPauseButton = document.querySelector("#brain-pause");
const brainResetButton = document.querySelector("#brain-reset");
const brainPresetButtons = document.querySelectorAll("[data-brain-minutes]");
const brainNotes = document.querySelector("#brain-notes");
const brainCanvas = document.querySelector("#brain-canvas");
const canvasClearButton = document.querySelector("#canvas-clear");
const brainStatus = document.querySelector("#brain-status");

let selectedBrainMinutes = 5;
let brainTimeRemaining = selectedBrainMinutes * 60;
let brainTimerId = null;
let saveTimeout = null;

function setBrainStatus(message, tone = "info") {
  if (!brainStatus) {
    return;
  }

  brainStatus.textContent = message;
  brainStatus.className = `auth-message auth-message-${tone}`;
}

function updateBrainTimerDisplay() {
  const minutes = String(Math.floor(brainTimeRemaining / 60)).padStart(2, "0");
  const seconds = String(brainTimeRemaining % 60).padStart(2, "0");
  brainTimerElement.textContent = `${minutes}:${seconds}`;
}

function pauseBrainTimer() {
  clearInterval(brainTimerId);
  brainTimerId = null;
}

function resetBrainTimer() {
  pauseBrainTimer();
  brainTimeRemaining = selectedBrainMinutes * 60;
  brainTimerLabel.textContent = "Brain Dump Sprint";
  updateBrainTimerDisplay();
}

function startBrainTimer() {
  if (brainTimerId) return;

  brainTimerId = setInterval(() => {
    if (brainTimeRemaining > 0) {
      brainTimeRemaining -= 1;
      updateBrainTimerDisplay();
      return;
    }

    pauseBrainTimer();
    brainTimerLabel.textContent = "Time Is Up";
  }, 1000);
}

brainStartButton.addEventListener("click", startBrainTimer);
brainPauseButton.addEventListener("click", pauseBrainTimer);
brainResetButton.addEventListener("click", resetBrainTimer);

brainPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedBrainMinutes = Number(button.dataset.brainMinutes);
    resetBrainTimer();
  });
});

const context = brainCanvas.getContext("2d");
let isDrawing = false;

context.lineWidth = 3;
context.lineCap = "round";
context.strokeStyle = "#5f89bb";

function queueBrainDumpSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await saveBrainDumpState({
        notes: brainNotes.value,
        canvasData: brainCanvas.toDataURL("image/png"),
      });
      setBrainStatus("Brain Dump saved.", "success");
    } catch (error) {
      setBrainStatus(error.message || "Could not save Brain Dump notes.", "warning");
    }
  }, 400);
}

brainNotes.addEventListener("input", queueBrainDumpSave);

function getCanvasPoint(event) {
  const rect = brainCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startDrawing(event) {
  isDrawing = true;
  const point = getCanvasPoint(event);
  context.beginPath();
  context.moveTo(point.x, point.y);
}

function draw(event) {
  if (!isDrawing) return;
  const point = getCanvasPoint(event);
  context.lineTo(point.x, point.y);
  context.stroke();
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  queueBrainDumpSave();
}

brainCanvas.addEventListener("mousedown", startDrawing);
brainCanvas.addEventListener("mousemove", draw);
brainCanvas.addEventListener("mouseup", stopDrawing);
brainCanvas.addEventListener("mouseleave", stopDrawing);

brainCanvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  startDrawing(event.touches[0]);
});

brainCanvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  draw(event.touches[0]);
});

brainCanvas.addEventListener("touchend", stopDrawing);

canvasClearButton.addEventListener("click", async () => {
  try {
    context.clearRect(0, 0, brainCanvas.width, brainCanvas.height);
    await saveBrainDumpState({
      notes: brainNotes.value,
      canvasData: "",
    });
    setBrainStatus("Drawing cleared.", "info");
  } catch (error) {
    setBrainStatus(error.message || "Could not clear drawing.", "warning");
  }
});

function loadCanvasImage(canvasData) {
  if (!canvasData) return;

  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, brainCanvas.width, brainCanvas.height);
    context.drawImage(image, 0, 0, brainCanvas.width, brainCanvas.height);
  };
  image.src = canvasData;
}

async function initBrainDump() {
  try {
    const state = await fetchBrainDumpState();

    if (state) {
      brainNotes.value = state.notes || "";
      loadCanvasImage(state.canvasData);
    }
    setBrainStatus("Brain Dump ready.", "info");
  } catch (error) {
    setBrainStatus(error.message || "Could not load Brain Dump notes.", "warning");
  }
  updateBrainTimerDisplay();
}

initBrainDump();
