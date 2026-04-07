const essayForm = document.querySelector("#essay-form");
const essayOutput = document.querySelector("#essay-output");
const paragraphInput = document.querySelector("#essay-paragraphs");

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

function buildParagraphs(argument, paragraphCount) {
  const starters = [
    "Introduce the first strong point that supports your argument",
    "Develop the argument with a deeper example or explanation",
    "Explore another angle and show why it matters",
    "Challenge the idea or bring in a contrasting perspective",
    "Link the evidence back to the bigger message of the essay",
  ];

  const analysisPrompts = [
    "Analyse how this point helps prove your overall argument",
    "Explain what this suggests about the writer, event, or idea",
    "Zoom in on why this detail is important to the question",
    "Explore the deeper meaning or effect behind this example",
  ];

  return Array.from({ length: paragraphCount }, (_, index) => {
    const pointNumber = index + 1;
    const starter = starters[index] || starters[starters.length - 1];
    const analysisPrompt = analysisPrompts[index % analysisPrompts.length];

    return `
      <div class="essay-block">
        <h3>Paragraph ${pointNumber}</h3>
        <p><strong>Main point:</strong> ${starter}.</p>
        <p><strong>Use this idea:</strong> Show how this connects to your argument that ${argument.toLowerCase()}.</p>
        <p><strong>Analysis:</strong> ${analysisPrompt}.</p>
        <p><strong>Include:</strong> Evidence, explanation, and a clear link back to the question.</p>
      </div>
    `;
  }).join("");
}

function renderBasicStructure(subject, question, argument, paragraphCount) {
  essayOutput.innerHTML = `
    <div class="essay-block">
      <h3>Essay overview</h3>
      <p><strong>Subject:</strong> ${capitalise(subject)}</p>
      <p><strong>Question:</strong> ${question}</p>
      <p><strong>Core argument:</strong> ${capitalise(argument)}</p>
    </div>

    <div class="essay-block">
      <h3>Introduction</h3>
      <p>Open by directly answering the question and introducing the main idea that ${argument.toLowerCase()}.</p>
      <p>Briefly mention the points you will explore across the essay so your structure feels clear from the start.</p>
    </div>

    ${buildParagraphs(argument, paragraphCount)}

    <div class="essay-block">
      <h3>Conclusion</h3>
      <p>Return to the question, restate your argument clearly, and sum up the strongest ideas from the main paragraphs.</p>
      <p>Finish with one final sentence that leaves the reader with the importance of your overall point.</p>
    </div>
  `;
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

essayForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const subject = document.querySelector("#essay-subject").value.trim();
  const question = document.querySelector("#essay-question").value.trim();
  const argument = document.querySelector("#essay-argument").value.trim();
  const paragraphCount = clampParagraphCount(paragraphInput.value);
  paragraphInput.value = paragraphCount;

  renderBasicStructure(subject, question, argument, paragraphCount);
});

paragraphInput.addEventListener("input", () => {
  if (paragraphInput.value === "") {
    return;
  }

  paragraphInput.value = clampParagraphCount(paragraphInput.value);
});
