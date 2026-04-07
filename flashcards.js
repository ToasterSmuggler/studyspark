const studyGeneratorForm = document.querySelector("#study-generator-form");
const flashcardList = document.querySelector("#flashcard-list");
const studySetSummary = document.querySelector("#study-set-summary");
const studySetTitle = document.querySelector("#study-set-title");
const studySetCopy = document.querySelector("#study-set-copy");
const studyGeneratorStatus = document.querySelector("#study-generator-status");
const quizPanel = document.querySelector("#quiz-panel");
const quizCounter = document.querySelector("#quiz-counter");
const quizScore = document.querySelector("#quiz-score");
const quizSubject = document.querySelector("#quiz-subject");
const quizQuestion = document.querySelector("#quiz-question");
const quizInput = document.querySelector("#quiz-input");
const quizFeedback = document.querySelector("#quiz-feedback");
const quizAnswer = document.querySelector("#quiz-answer");
const checkAnswerButton = document.querySelector("#check-answer");
const showAnswerButton = document.querySelector("#show-answer");
const markCorrectButton = document.querySelector("#mark-correct");
const markWrongButton = document.querySelector("#mark-wrong");

const flashcardStorageKey = "studyspark-flashcards";
const studySetStorageKey = "studyspark-study-set";

function safeParse(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

const storedFlashcards = safeParse(flashcardStorageKey, []);
let flashcards = Array.isArray(storedFlashcards) ? storedFlashcards : [];
let studySet = safeParse(studySetStorageKey, null);
let currentIndex = 0;
let score = 0;

function setGeneratorStatus(message, tone = "info") {
  if (!message) {
    studyGeneratorStatus.textContent = "";
    studyGeneratorStatus.className = "study-generator-status hidden";
    return;
  }

  studyGeneratorStatus.textContent = message;
  studyGeneratorStatus.className = `study-generator-status study-generator-status-${tone}`;
}

function saveFlashcards() {
  localStorage.setItem(flashcardStorageKey, JSON.stringify(flashcards));
}

function saveStudySet() {
  if (!studySet) {
    localStorage.removeItem(studySetStorageKey);
    return;
  }

  localStorage.setItem(studySetStorageKey, JSON.stringify(studySet));
}

function setQuizVisibility(hasCards) {
  quizPanel.classList.toggle("hidden", !hasCards);
}

function normaliseTopic(text) {
  return text.trim().replace(/\s+/g, " ");
}

function getTopicStudySet(subject, topic) {
  const cleanSubject = normaliseTopic(subject);
  const cleanTopic = normaliseTopic(topic);
  const topicKey = cleanTopic.toLowerCase();

  const topicSets = {
    photosynthesis: [
      {
        front: "What is photosynthesis?",
        back: "Photosynthesis is the process by which green plants use light energy to turn carbon dioxide and water into glucose and oxygen.",
      },
      {
        front: "What is the word equation for photosynthesis?",
        back: "Carbon dioxide + water -> glucose + oxygen, using light energy and chlorophyll.",
      },
      {
        front: "Where in a plant cell does photosynthesis happen?",
        back: "Photosynthesis happens in the chloroplasts, which contain chlorophyll to absorb light energy.",
      },
      {
        front: "Why is chlorophyll important in photosynthesis?",
        back: "Chlorophyll absorbs light energy, which is needed to drive the chemical reactions in photosynthesis.",
      },
      {
        front: "Why is photosynthesis important for plants and other living things?",
        back: "It makes glucose for the plant to use or store, and it releases oxygen needed by most living things for respiration.",
      },
    ],
    osmosis: [
      {
        front: "What is osmosis?",
        back: "Osmosis is the movement of water molecules from a dilute solution to a more concentrated solution through a partially permeable membrane.",
      },
      {
        front: "What kind of membrane is needed for osmosis?",
        back: "A partially permeable membrane is needed so water can pass through but some dissolved substances cannot.",
      },
      {
        front: "What happens to a plant cell in a dilute solution?",
        back: "Water moves into the cell by osmosis, making the cell turgid.",
      },
      {
        front: "What happens to an animal cell in a concentrated solution?",
        back: "Water moves out of the cell by osmosis, so the cell shrinks.",
      },
      {
        front: "Why is osmosis important in living organisms?",
        back: "It helps control water balance in cells and is important for processes such as water uptake in plant roots.",
      },
    ],
    respiration: [
      {
        front: "What is respiration?",
        back: "Respiration is the process of releasing energy from glucose inside cells.",
      },
      {
        front: "What is the word equation for aerobic respiration?",
        back: "Glucose + oxygen -> carbon dioxide + water.",
      },
      {
        front: "Where does aerobic respiration mainly happen in cells?",
        back: "It mainly happens in the mitochondria.",
      },
      {
        front: "Why do cells need respiration?",
        back: "Cells need respiration to release energy for processes like movement, active transport, growth, and keeping warm.",
      },
      {
        front: "What is the difference between aerobic and anaerobic respiration?",
        back: "Aerobic respiration uses oxygen and releases more energy, while anaerobic respiration happens without oxygen and releases less energy.",
      },
    ],
  };

  const selectedSet = topicSets[topicKey];

  if (selectedSet) {
    return selectedSet.map((card) => ({
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: card.front,
      back: card.back,
    }));
  }

  return null;
}

function createStudySet(subject, topic) {
  const cleanSubject = normaliseTopic(subject);
  const cleanTopic = normaliseTopic(topic);
  const topicLower = cleanTopic.toLowerCase();

  const specificSet = getTopicStudySet(cleanSubject, cleanTopic);

  if (specificSet) {
    return specificSet;
  }

  return [
    {
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: `What is ${topicLower}?`,
      back: `${cleanTopic} is an important topic in ${cleanSubject}. Start with a clear definition in your own words, then add one precise detail from class.`,
    },
    {
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: `Why does ${topicLower} matter in ${cleanSubject}?`,
      back: `Explain why ${cleanTopic} is significant, what it affects, and why teachers or exam questions might focus on it.`,
    },
    {
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: `What are the main features of ${topicLower}?`,
      back: `List the key characteristics, stages, or parts of ${cleanTopic}. Aim for two or three strong points you could remember in a test.`,
    },
    {
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: `What example could you use for ${topicLower}?`,
      back: `Choose one clear example, case, quote, formula, or process linked to ${cleanTopic} that would strengthen an answer.`,
    },
    {
      id: crypto.randomUUID(),
      subject: cleanSubject,
      front: `How would you explain ${topicLower} in an exam answer?`,
      back: `Give a short, structured explanation of ${cleanTopic}: point, evidence or detail, then why it matters.`,
    },
  ];
}

function sanitiseAiCards(cards, subject) {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards
    .filter((card) => card && typeof card.question === "string" && typeof card.answer === "string")
    .map((card) => ({
      id: crypto.randomUUID(),
      subject,
      front: normaliseTopic(card.question),
      back: normaliseTopic(card.answer),
    }))
    .filter((card) => card.front && card.back);
}

async function fetchAiStudySet(subject, topic) {
  const response = await fetch("/api/study-set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subject, topic }),
  });

  if (!response.ok) {
    throw new Error("AI generation unavailable");
  }

  const payload = await response.json();
  return sanitiseAiCards(payload.cards, normaliseTopic(subject));
}

function updateStudySetSummary() {
  if (!studySet) {
    studySetSummary.classList.add("hidden");
    return;
  }

  studySetSummary.classList.remove("hidden");
  studySetTitle.textContent = `${studySet.subject}: ${studySet.topic}`;
  studySetCopy.textContent = `This set contains ${flashcards.length} generated cards for ${studySet.topic}. You can flip each card below and then use the quiz straight underneath.`;
}

function renderFlashcards() {
  flashcardList.innerHTML = "";

  if (flashcards.length === 0) {
    flashcardList.innerHTML = `
      <div class="essay-block">
        <h3>No flashcards yet</h3>
        <p>Generate a study set above and your flashcards will appear here.</p>
      </div>
    `;
    return;
  }

  flashcards.forEach((card) => {
    const cardElement = document.createElement("article");
    cardElement.className = "flashcard-item";

    cardElement.innerHTML = `
      <div class="flashcard-top">
        <span class="flashcard-subject">${card.subject}</span>
        <button class="delete-btn" data-delete-id="${card.id}">Delete</button>
      </div>
      <div class="flashcard-face">
        <span class="flashcard-label">Front</span>
        <strong>${card.front}</strong>
        <button class="secondary-btn flashcard-toggle" data-flip-id="${card.id}">Show answer</button>
        <div class="flashcard-back hidden" id="answer-${card.id}">
          <span class="flashcard-label">Back</span>
          <p>${card.back}</p>
        </div>
      </div>
    `;

    flashcardList.appendChild(cardElement);
  });
}

function resetQuiz() {
  currentIndex = 0;
  score = 0;

  if (flashcards.length === 0) {
    setQuizVisibility(false);
    return;
  }

  setQuizVisibility(true);
  quizInput.value = "";
  quizFeedback.classList.add("hidden");
  quizAnswer.classList.add("hidden");
  checkAnswerButton.disabled = false;
  showAnswerButton.disabled = false;
  markCorrectButton.disabled = false;
  markWrongButton.disabled = false;
  renderQuizCard();
}

function renderQuizCard() {
  const card = flashcards[currentIndex];

  if (!card) {
    quizSubject.textContent = "Finished";
    quizQuestion.textContent = `Quiz complete. Final score: ${score} / ${flashcards.length}`;
    quizAnswer.textContent = "Generate a new topic or refresh the page if you want another run-through.";
    quizAnswer.classList.remove("hidden");
    showAnswerButton.disabled = true;
    markCorrectButton.disabled = true;
    markWrongButton.disabled = true;
    quizCounter.textContent = `Card ${flashcards.length} of ${flashcards.length}`;
    quizScore.textContent = `Score: ${score}`;
    return;
  }

  quizCounter.textContent = `Card ${currentIndex + 1} of ${flashcards.length}`;
  quizScore.textContent = `Score: ${score}`;
  quizSubject.textContent = card.subject;
  quizQuestion.textContent = card.front;
  quizInput.value = "";
  quizFeedback.classList.add("hidden");
  quizAnswer.textContent = card.back;
  quizAnswer.classList.add("hidden");
}

function moveToNextCard(wasCorrect) {
  if (wasCorrect) {
    score += 1;
  }

  currentIndex += 1;
  renderQuizCard();
}

studyGeneratorForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const subject = document.querySelector("#study-subject").value.trim();
  const topic = document.querySelector("#study-topic").value.trim();

  setGeneratorStatus("Generating your study set...", "info");

  studySet = {
    subject: normaliseTopic(subject),
    topic: normaliseTopic(topic),
  };

  try {
    const aiCards = await fetchAiStudySet(subject, topic);
    flashcards = aiCards.length > 0 ? aiCards : createStudySet(subject, topic);
    setGeneratorStatus("AI study set generated.", "success");
  } catch {
    flashcards = createStudySet(subject, topic);
    setGeneratorStatus(
      "AI is not connected right now, so StudySpark used its built-in generator instead.",
      "warning"
    );
  }

  saveFlashcards();
  saveStudySet();
  updateStudySetSummary();
  renderFlashcards();
  resetQuiz();
});

flashcardList.addEventListener("click", (event) => {
  const flipId = event.target.closest("[data-flip-id]")?.getAttribute("data-flip-id");
  const deleteId = event.target.getAttribute("data-delete-id");

  if (flipId) {
    const answer = document.querySelector(`#answer-${flipId}`);
    const toggleButton = event.target.closest("[data-flip-id]");
    if (answer) {
      answer.classList.toggle("hidden");
      if (toggleButton) {
        toggleButton.textContent = answer.classList.contains("hidden")
          ? "Show answer"
          : "Hide answer";
      }
    }
  }

  if (deleteId) {
    flashcards = flashcards.filter((card) => card.id !== deleteId);
    if (flashcards.length === 0) {
      studySet = null;
      saveStudySet();
    }
    saveFlashcards();
    updateStudySetSummary();
    renderFlashcards();
    resetQuiz();
  }
});

showAnswerButton.addEventListener("click", () => {
  quizAnswer.classList.remove("hidden");
});

checkAnswerButton.addEventListener("click", () => {
  quizFeedback.classList.remove("hidden");
  quizAnswer.classList.remove("hidden");
});

markCorrectButton.addEventListener("click", () => {
  moveToNextCard(true);
});

markWrongButton.addEventListener("click", () => {
  moveToNextCard(false);
});

renderFlashcards();
updateStudySetSummary();
resetQuiz();
