const essayForm = document.querySelector("#essay-ai-form");
const essayOutput = document.querySelector("#essay-output");
const paragraphInput = document.querySelector("#essay-paragraphs");
const essayAiButton = document.querySelector("#essay-ai-button");
const essayStatus = document.querySelector("#essay-status");

let essayAiAvailable = true;

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
    const response = await fetch("/api/essay-structure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: "English",
        question: "Availability check",
        argument: "A basic test argument",
        paragraphCount: 3,
      }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      essayAiAvailable = false;
      setEssayStatus(
        "AI essay structure is only available in the full app version with the server running.",
        "warning"
      );
      return;
    }

    essayAiAvailable = true;
  } catch {
    essayAiAvailable = false;
    setEssayStatus(
      "AI essay structure is only available in the full app version with the server running.",
      "warning"
    );
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

    const response = await fetch("/api/essay-structure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        question,
        argument,
        paragraphCount,
      }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("AI essay structure is not available on this hosted version yet.");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not generate AI structure.");
    }

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
