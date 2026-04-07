import { getCurrentSession } from "./auth-client.js?v=20260409";
import { getMemberstackToken } from "./memberstack-client.js?v=20260409";

export async function requireUser() {
  const session = await getCurrentSession();
  return session?.user || null;
}

async function authedApiRequest(path, options = {}) {
  const token = await getMemberstackToken();

  if (!token) {
    throw new Error("You need to log in first.");
  }

  const url =
    typeof window !== "undefined"
      ? new URL(path, window.location.origin).toString()
      : path;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  let payload = null;

  if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    if (rawText.trim().startsWith("<!DOCTYPE") || rawText.trim().startsWith("<html")) {
      throw new Error(
        "App received an HTML page instead of API JSON. Please hard refresh and redeploy latest files."
      );
    }

    throw new Error("Server returned an invalid response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
}

export async function fetchHomework() {
  const payload = await authedApiRequest("/api/homework");
  return Array.isArray(payload.tasks) ? payload.tasks : [];
}

export async function createHomework(task) {
  const payload = await authedApiRequest("/api/homework", {
    method: "POST",
    body: {
      title: String(task.title || "").trim(),
      subject: String(task.subject || "").trim(),
      dueDate: String(task.dueDate || "").trim(),
    },
  });

  return payload.task;
}

export async function updateHomework(task) {
  await authedApiRequest(`/api/homework/${task.id}`, {
    method: "PATCH",
    body: {
      title: String(task.title || "").trim(),
      subject: String(task.subject || "").trim(),
      dueDate: String(task.dueDate || "").trim(),
      completed: Boolean(task.completed),
      completedDate: task.completedDate || null,
    },
  });
}

export async function deleteHomework(id) {
  await authedApiRequest(`/api/homework/${id}`, {
    method: "DELETE",
  });
}

export async function fetchRevisionSessions() {
  const payload = await authedApiRequest("/api/revision-sessions");
  return payload.sessions && typeof payload.sessions === "object" ? payload.sessions : {};
}

export async function incrementRevisionSession(sessionDate) {
  const payload = await authedApiRequest("/api/revision-sessions/increment", {
    method: "POST",
    body: {
      sessionDate,
    },
  });

  return Number(payload.sessionCount || 0);
}

export async function fetchRevisionLog() {
  const payload = await authedApiRequest("/api/revision-log");
  return Array.isArray(payload.entries) ? payload.entries : [];
}

export async function createRevisionLogEntry(entry) {
  const payload = await authedApiRequest("/api/revision-log", {
    method: "POST",
    body: {
      subject: entry.subject,
      topic: entry.topic,
      duration: entry.duration,
      date: entry.date,
      notes: entry.notes || "",
    },
  });

  return payload.entry;
}

export async function deleteRevisionLogEntry(id) {
  await authedApiRequest(`/api/revision-log/${id}`, {
    method: "DELETE",
  });
}

export async function fetchBrainDumpState() {
  const payload = await authedApiRequest("/api/brain-dump-state");
  return payload.state || null;
}

export async function saveBrainDumpState({ notes, canvasData }) {
  await authedApiRequest("/api/brain-dump-state", {
    method: "PUT",
    body: {
      notes: notes || "",
      canvasData: canvasData || "",
    },
  });
}

export async function fetchBrainDumpOutlines() {
  const payload = await authedApiRequest("/api/brain-dump-outlines");
  return Array.isArray(payload.outlines) ? payload.outlines : [];
}

export async function createBrainDumpOutline(outline) {
  const payload = await authedApiRequest("/api/brain-dump-outlines", {
    method: "POST",
    body: {
      sourceNotes: outline.sourceNotes,
      introduction: outline.introduction,
      paragraphs: outline.paragraphs,
      conclusion: outline.conclusion,
      keyPoints: outline.keyPoints,
      sentenceStarters: outline.sentenceStarters,
    },
  });

  return payload.outline;
}
