import { getCurrentSession } from "./auth-client.js";
import { getMemberstackToken } from "./memberstack-client.js";
import { getCurrentMemberstackMember } from "./memberstack-client.js";

export async function requireUser() {
  const session = await getCurrentSession();
  return session?.user || null;
}

async function authedApiRequest(path, options = {}) {
  let token = null;
  let member = null;
  let sessionUser = null;

  try {
    token = await getMemberstackToken();
  } catch {
    // Some Memberstack builds don't expose a token method reliably.
    // We can still continue with member-id fallback.
    token = null;
  }

  try {
    member = await getCurrentMemberstackMember();
  } catch {
    member = null;
  }

  try {
    const session = await getCurrentSession();
    sessionUser = session?.user || null;
  } catch {
    sessionUser = null;
  }

  const memberId = String(member?.id || sessionUser?.id || "").trim();
  const memberEmail = String(member?.auth?.email || sessionUser?.email || "").trim();

  if (!token && !memberId) {
    throw new Error("You need to log in first.");
  }

  const url =
    typeof window !== "undefined"
      ? new URL(path, window.location.origin).toString()
      : path;

  let response;

  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(memberId ? { "X-Memberstack-Id": memberId } : {}),
        ...(memberEmail ? { "X-Memberstack-Email": memberEmail } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const message = String(error?.message || "");

    if (message.includes("Unexpected token '<'")) {
      throw new Error("Network session parsing failed. Please refresh and try again.");
    }

    throw error;
  }

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
