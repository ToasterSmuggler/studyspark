import { createBrainDumpOutline, fetchBrainDumpOutlines } from "./supabase-data.js";

const brainNotes = document.querySelector("#brain-notes");
const brainOrganiseButton = document.querySelector("#brain-organise");
const brainSaveOutlineButton = document.querySelector("#brain-save-outline");
const brainStructureStatus = document.querySelector("#brain-structure-status");
const brainStructureOutput = document.querySelector("#brain-structure-output");
const brainSavedList = document.querySelector("#brain-saved-list");

let latestStructuredOutline = null;
let brainAiAvailable = true;

function setStructureStatus(message, tone = "info") {
  brainStructureStatus.textContent = message;
  brainStructureStatus.className = `brain-structure-status brain-structure-status-${tone}`;
  brainStructureStatus.classList.remove("hidden");
}

function setBrainAiAvailability(isAvailable) {
  brainAiAvailable = isAvailable;
  brainOrganiseButton.disabled = !isAvailable;
  brainSaveOutlineButton.disabled = !isAvailable || !latestStructuredOutline;
}

async function detectBrainAiAvailability() {
  try {
    const response = await fetch("/api/brain-dump-outline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: "availability check" }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      setBrainAiAvailability(false);
      setStructureStatus(
        "AI organiser is only available in the full app version with the server running.",
        "warning"
      );
      return;
    }

    setBrainAiAvailability(true);
  } catch {
    setBrainAiAvailability(false);
    setStructureStatus(
      "AI organiser is only available in the full app version with the server running.",
      "warning"
    );
  }
}

function renderStructuredOutline(outline) {
  latestStructuredOutline = outline;
  brainSaveOutlineButton.disabled = !brainAiAvailable;

  brainStructureOutput.innerHTML = `
    <div class="essay-block">
      <h3>Introduction</h3>
      <p>${outline.introduction}</p>
    </div>

    <div class="essay-block">
      <h3>Main points / paragraphs</h3>
      ${outline.paragraphs
        .map(
          (paragraph, index) => `
            <div class="brain-paragraph-item">
              <strong>Paragraph ${index + 1}: ${paragraph.title}</strong>
              <p>${paragraph.point}</p>
            </div>
          `
        )
        .join("")}
    </div>

    <div class="essay-block">
      <h3>Conclusion</h3>
      <p>${outline.conclusion}</p>
    </div>

    <div class="essay-block">
      <h3>Key points to remember</h3>
      <ul class="brain-bullet-list">
        ${outline.keyPoints.map((point) => `<li>${point}</li>`).join("")}
      </ul>
    </div>

    <div class="essay-block">
      <h3>Sentence starters</h3>
      <ul class="brain-bullet-list">
        ${outline.sentenceStarters.map((starter) => `<li>${starter}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSavedOutlines(outlines) {
  if (!outlines.length) {
    brainSavedList.innerHTML = `<p class="brain-saved-empty">No saved outlines yet.</p>`;
    return;
  }

  brainSavedList.innerHTML = outlines
    .map((outline) => {
      const createdAt = new Date(outline.createdAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
        <article class="brain-saved-item">
          <div class="brain-saved-top">
            <strong>${createdAt}</strong>
            <span>${outline.paragraphs.length} paragraph points</span>
          </div>
          <p class="brain-saved-summary">${outline.introduction}</p>
        </article>
      `;
    })
    .join("");
}

brainOrganiseButton.addEventListener("click", async () => {
  if (!brainAiAvailable) {
    setStructureStatus(
      "AI organiser is only available in the full app version with the server running.",
      "warning"
    );
    return;
  }

  const notes = brainNotes.value.trim();

  if (!notes) {
    setStructureStatus("Add some notes first so StudySpark has something to organise.", "warning");
    return;
  }

  try {
    brainOrganiseButton.disabled = true;
    brainSaveOutlineButton.disabled = true;
    setStructureStatus("Organising your notes into a clearer outline...", "info");

    const response = await fetch("/api/brain-dump-outline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes }),
    });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("AI organiser is not available on this hosted version yet.");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not organise your notes.");
    }

    renderStructuredOutline({
      sourceNotes: notes,
      introduction: data.introduction,
      paragraphs: data.paragraphs,
      conclusion: data.conclusion,
      keyPoints: data.keyPoints,
      sentenceStarters: data.sentenceStarters,
    });
    setStructureStatus("Structured outline ready.", "success");
  } catch (error) {
    setStructureStatus(error.message || "Could not organise your notes.", "warning");
  } finally {
    brainOrganiseButton.disabled = false;
  }
});

brainSaveOutlineButton.addEventListener("click", async () => {
  if (!latestStructuredOutline) {
    return;
  }

  try {
    brainSaveOutlineButton.disabled = true;
    await createBrainDumpOutline(latestStructuredOutline);
    const outlines = await fetchBrainDumpOutlines();
    renderSavedOutlines(outlines);
    setStructureStatus("Structured outline saved to your account.", "success");
  } catch (error) {
    brainSaveOutlineButton.disabled = false;
    setStructureStatus(error.message || "Could not save outline to your account.", "warning");
  }
});

async function initAiBrainDump() {
  try {
    const outlines = await fetchBrainDumpOutlines();
    renderSavedOutlines(outlines);
  } catch (error) {
    setStructureStatus(error.message || "Could not load your saved outlines.", "warning");
  }

  await detectBrainAiAvailability();
}

initAiBrainDump();
