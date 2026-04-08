import { fetchMemberAccess, generateAiEssayStructure } from "./supabase-data.js";

const essayForm = document.querySelector("#essay-ai-form");
const essayOutput = document.querySelector("#essay-output");
const paragraphInput = document.querySelector("#essay-paragraphs");
const essayAiButton = document.querySelector("#essay-ai-button");
const essayStatus = document.querySelector("#essay-status");

let essayAiAvailable = false;

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clampParagraphCount(value) {
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    return 3;
  }

  return Math.min(5, Math.max(2, parsedValue));
}

function setEssayStatus(message, tone = "info") {
  essayStatus.textContent = message;
  essayStatus.className = `brain-structure-status brain-structure-status-${tone}`;
  essayStatus.classList.remove("hidden");
}

function renderAiStructure(subject, question, argument, structure) {
  essayOutput.innerHTML = `
    <div class="essay-block">
      <h3>Essay overview</h3>
      <p><strong>Subject:</strong> ${capitalise(subject)}</p>
      <p><strong>Question:</strong> ${question}</p>
      <p><strong>Core argument:</strong> ${capitalise(argument)}</p>
      <p><strong>AI overview:</strong> ${structure.overview}</p>
    </div>

    <div class="essay-block">
      <h3>Introduction</h3>
      <p>${structure.introduction}</p>
    </div>

    ${structure.paragraphs
      .map(
        (paragraph, index) => `
          <div class="essay-block">
            <h3>Paragraph ${index + 1}: ${paragraph.title}</h3>
            <p><strong>Main point:</strong> ${paragraph.point}</p>
            <p><strong>Analysis:</strong> ${paragraph.analysis}</p>
            <p><strong>Include:</strong> ${paragraph.include}</p>
          </div>
        `
      )
      .join("")}

    <div class="essay-block">
      <h3>Conclusion</h3>
      <p>${structure.conclusion}</p>
    </div>
  `;
}

async function detectEssayAiAvailability() {
  try {
    const access = await fetchMemberAccess();

    if (!access?.isPremium) {
      essayAiAvailable = false;
      setEssayStatus(
        "StudySpark Plus is required for the AI Essay builder. Upgrade on the Membership page.",
        "warning"
      );
      return;
    }

    essayAiAvailable = true;
    setEssayStatus("StudySpark Plus access active. AI essay builder is ready.", "success");
  } catch {
    essayAiAvailable = false;
    setEssayStatus("Please log in to use the AI essay builder.", "warning");
  }
}

essayForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const subject = document.querySelector("#essay-subject").value.trim();
  const question = document.querySelector("#essay-question").value.trim();
  const argument = document.querySelector("#essay-argument").value.trim();
  const paragraphCount = clampParagraphCount(paragraphInput.value);
  paragraphInput.value = paragraphCount;

  if (!subject || !question || !argument) {
    setEssayStatus("Fill in the subject, question, and argument first.", "warning");
    return;
  }

  if (!essayAiAvailable) {
    setEssayStatus(
      "AI essay structure is only available in the full app version with the server running.",
      "warning"
    );
    return;
  }

  try {
    essayAiButton.disabled = true;
    setEssayStatus("Generating your StudySpark Plus essay structure...", "info");

    const data = await generateAiEssayStructure({
      subject,
      question,
      argument,
      paragraphCount,
    });

    renderAiStructure(subject, question, argument, data);
    setEssayStatus("AI essay structure ready.", "success");
  } catch (error) {
    setEssayStatus(error.message || "Could not generate AI structure.", "warning");
  } finally {
    essayAiButton.disabled = false;
  }
});

paragraphInput.addEventListener("input", () => {
  if (paragraphInput.value === "") {
    return;
  }

  paragraphInput.value = clampParagraphCount(paragraphInput.value);
});

detectEssayAiAvailability();
