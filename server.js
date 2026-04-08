const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cpaedgcrikdbgcmoqllz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "openai/gpt-oss-120b:fastest";
const AI21_API_KEY = process.env.AI21_API_KEY;
const AI21_MODEL = process.env.AI21_MODEL || "jamba-large";
const rootDir = __dirname;
const PLUS_PLAN_HINTS = [
  "studysparkplus",
  "pln_studysparkplus-ml6u0s2r",
  "prc_studysparkplus-33710sk0",
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

let supabaseAdminPromise = null;
let memberstackAdminPromise = null;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function getBearerToken(request) {
  const authHeader = request.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice("Bearer ".length).trim();
}

function isLikelyJwtToken(value) {
  const token = String(value || "").trim();

  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  return parts.every((part) => /^[A-Za-z0-9\-_]+$/.test(part));
}

function decodeJwtPayload(token) {
  try {
    const payloadPart = String(token || "").split(".")[1];

    if (!payloadPart) {
      return null;
    }

    const normalised = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getMemberIdFromJwtPayload(token) {
  const payload = decodeJwtPayload(token);
  const possibleId = String(payload?.sub || payload?.id || "").trim();
  return possibleId || "";
}

function hasPlusPlanHint(value) {
  const lower = String(value || "").toLowerCase();
  return PLUS_PLAN_HINTS.some((hint) => lower.includes(hint));
}

function getPlusPlanKeyFromMemberData(memberData) {
  if (!memberData || typeof memberData !== "object") {
    return "";
  }

  const possibleCollections = [
    memberData.planConnections,
    memberData.plan_connections,
    memberData.plans,
    memberData.plan,
    memberData.data?.planConnections,
    memberData.data?.plans,
  ];

  for (const collection of possibleCollections) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        const valuesToCheck = [
          item?.id,
          item?.planId,
          item?.plan_id,
          item?.slug,
          item?.name,
          item?.key,
          item?.plan?.id,
          item?.plan?.slug,
          item?.plan?.name,
        ].filter(Boolean);

        const matchedValue = valuesToCheck.find((value) => hasPlusPlanHint(value));

        if (matchedValue) {
          return String(matchedValue);
        }
      }
    } else if (collection && typeof collection === "object") {
      const valuesToCheck = [
        collection.id,
        collection.planId,
        collection.plan_id,
        collection.slug,
        collection.name,
        collection.key,
      ].filter(Boolean);
      const matchedValue = valuesToCheck.find((value) => hasPlusPlanHint(value));

      if (matchedValue) {
        return String(matchedValue);
      }
    }
  }

  const blob = JSON.stringify(memberData);
  return hasPlusPlanHint(blob) ? "studysparkplus" : "";
}

function normaliseText(text = "") {
  return String(text).trim().replace(/\s+/g, " ");
}

function extractJsonObject(text = "") {
  const trimmed = String(text).trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model did not return valid JSON.");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function ensureArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`Model response is missing a valid ${fieldName} list.`);
  }

  return value;
}

function ensureString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Model response is missing ${fieldName}.`);
  }

  return value;
}

function pickFirstDefined(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return undefined;
}

function unwrapSchemaLikePayload(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.properties &&
    typeof value.properties === "object"
  ) {
    return value.properties;
  }

  return value;
}

function normaliseParagraphs(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          title: `Paragraph ${index + 1}`,
          point: normaliseText(item),
        };
      }

      const title = pickFirstDefined(item, ["title", "heading", "name", "pointTitle"]);
      const point = pickFirstDefined(item, ["point", "content", "text", "explanation", "detail"]);

      if (!point) {
        return null;
      }

      return {
        title: normaliseText(title || `Paragraph ${index + 1}`),
        point: normaliseText(point),
      };
    })
    .filter(Boolean);
}

function normaliseStringList(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return normaliseText(item);
      }

      if (item && typeof item === "object") {
        const picked = pickFirstDefined(item, ["text", "point", "content", "value"]);

        if (picked) {
          return normaliseText(picked);
        }
      }

      return "";
    })
    .filter(Boolean);
}

function splitLines(text = "") {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseBrainDumpTextFallback(text = "") {
  const lines = splitLines(text);

  if (!lines.length) {
    return null;
  }

  const sections = {
    introduction: "",
    conclusion: "",
    paragraphs: [],
    keyPoints: [],
    sentenceStarters: [],
  };

  let currentSection = "";

  for (const line of lines) {
    const normalisedLine = line.toLowerCase().replace(/[*_#:-]/g, "").trim();

    if (normalisedLine.startsWith("introduction") || normalisedLine.startsWith("intro")) {
      currentSection = "introduction";
      continue;
    }

    if (
      normalisedLine.startsWith("main points") ||
      normalisedLine.startsWith("paragraphs") ||
      normalisedLine.startsWith("body paragraphs") ||
      normalisedLine.startsWith("outline")
    ) {
      currentSection = "paragraphs";
      continue;
    }

    if (normalisedLine.startsWith("conclusion") || normalisedLine.startsWith("summary")) {
      currentSection = "conclusion";
      continue;
    }

    if (
      normalisedLine.startsWith("key points") ||
      normalisedLine.startsWith("remember") ||
      normalisedLine.startsWith("things to remember")
    ) {
      currentSection = "keyPoints";
      continue;
    }

    if (
      normalisedLine.startsWith("sentence starters") ||
      normalisedLine.startsWith("starters") ||
      normalisedLine.startsWith("writing starters")
    ) {
      currentSection = "sentenceStarters";
      continue;
    }

    if (currentSection === "introduction" && !sections.introduction) {
      sections.introduction = line.replace(/^[-*•]\s*/, "");
      continue;
    }

    if (currentSection === "conclusion" && !sections.conclusion) {
      sections.conclusion = line.replace(/^[-*•]\s*/, "");
      continue;
    }

    if (currentSection === "paragraphs") {
      sections.paragraphs.push({
        title: `Paragraph ${sections.paragraphs.length + 1}`,
        point: line.replace(/^[-*•]\s*/, ""),
      });
      continue;
    }

    if (currentSection === "keyPoints") {
      sections.keyPoints.push(line.replace(/^[-*•]\s*/, ""));
      continue;
    }

    if (currentSection === "sentenceStarters") {
      sections.sentenceStarters.push(line.replace(/^[-*•]\s*/, ""));
    }
  }

  if (
    !sections.introduction &&
    !sections.conclusion &&
    !sections.paragraphs.length &&
    !sections.keyPoints.length
  ) {
    return null;
  }

  return sections;
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function getSupabaseAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!supabaseAdminPromise) {
    supabaseAdminPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    );
  }

  return supabaseAdminPromise;
}

async function getMemberstackAdminClient() {
  if (!memberstackAdminPromise) {
    memberstackAdminPromise = import("@memberstack/admin").then((module) => {
      const memberstackAdmin =
        typeof module.init === "function"
          ? module
          : typeof module.default?.init === "function"
          ? module.default
          : null;

      if (!memberstackAdmin) {
        throw new Error("Could not load the Memberstack admin package.");
      }

      if (!MEMBERSTACK_SECRET_KEY) {
        throw new Error("Missing MEMBERSTACK_SECRET_KEY.");
      }

      return memberstackAdmin.init(MEMBERSTACK_SECRET_KEY);
    });
  }

  return memberstackAdminPromise;
}

async function verifyMemberstackRequest(request) {
  const token = getBearerToken(request);
  const headerMemberId = String(request.headers["x-memberstack-id"] || "").trim();
  const headerMemberEmail = String(request.headers["x-memberstack-email"] || "").trim();

  if (!token && !headerMemberId) {
    throw new Error("You need to log in first.");
  }

  let verified = null;

  if (token && isLikelyJwtToken(token)) {
    try {
      const memberstack = await getMemberstackAdminClient();
      verified = await memberstack.verifyToken({ token });
    } catch (error) {
      if (!headerMemberId) {
        const decodedId = getMemberIdFromJwtPayload(token);

        if (decodedId) {
          verified = { id: decodedId };
          return {
            id: decodedId,
            email: headerMemberEmail || `${decodedId}@memberstack.studyspark.local`,
          };
        }

        throw error;
      }
    }
  }

  const memberId = verified?.id || verified?.data?.id || headerMemberId;

  if (!memberId) {
    throw new Error("Could not verify Memberstack member.");
  }

  return {
    id: memberId,
    email: headerMemberEmail || `${memberId}@memberstack.studyspark.local`,
  };
}

async function findSupabaseUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const matchingUser = users.find(
      (user) => user.email?.toLowerCase() === String(email).toLowerCase()
    );

    if (matchingUser) {
      return matchingUser;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function getOrCreateSupabaseUserForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const email = member.email;
  const existingUser = await findSupabaseUserByEmail(supabase, email);

  if (existingUser) {
    return existingUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      memberstack_id: member.id,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function fetchStoredMemberAccess(member) {
  const supabase = await getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_access")
    .select("*")
    .eq("memberstack_id", member.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function saveMemberAccess(member, { isPremium, planKey }) {
  const supabase = await getSupabaseAdminClient();
  const payload = {
    memberstack_id: member.id,
    email: member.email || null,
    is_premium: Boolean(isPremium),
    plan_key: planKey || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("member_access")
    .upsert(payload, { onConflict: "memberstack_id" })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || payload;
}

async function fetchMemberstackMember(memberId) {
  if (!MEMBERSTACK_SECRET_KEY) {
    return null;
  }

  try {
    const memberstack = await getMemberstackAdminClient();
    const response = await memberstack.members.retrieve({ id: memberId });
    return response?.data || response || null;
  } catch {
    return null;
  }
}

async function resolveMemberAccess(member) {
  let storedAccess = null;

  try {
    storedAccess = await fetchStoredMemberAccess(member);
  } catch {
    storedAccess = null;
  }

  let isPremium = Boolean(storedAccess?.is_premium);
  let planKey = String(storedAccess?.plan_key || "").trim();
  const memberstackMember = await fetchMemberstackMember(member.id);

  if (memberstackMember) {
    const detectedPlanKey = getPlusPlanKeyFromMemberData(memberstackMember);
    const detectedPremium = Boolean(detectedPlanKey);

    isPremium = detectedPremium;
    planKey = detectedPlanKey || planKey;

    try {
      storedAccess = await saveMemberAccess(member, {
        isPremium: detectedPremium,
        planKey: detectedPlanKey || null,
      });
    } catch {
      // Keep runtime status even if db write fails.
    }
  } else if (!storedAccess) {
    try {
      storedAccess = await saveMemberAccess(member, {
        isPremium: false,
        planKey: null,
      });
    } catch {
      storedAccess = null;
    }
  }

  return {
    memberstackId: member.id,
    email: member.email || "",
    isPremium: Boolean(
      storedAccess?.is_premium !== undefined ? storedAccess.is_premium : isPremium
    ),
    planKey: String(storedAccess?.plan_key || planKey || "").trim() || null,
  };
}

function mapHomeworkRow(item) {
  return {
    id: item.id,
    title: item.title,
    subject: item.subject,
    dueDate: item.due_date,
    completed: item.completed,
    completedDate: item.completed_date,
    justCompleted: false,
  };
}

function mapRevisionLogRow(entry) {
  return {
    id: entry.id,
    subject: entry.subject,
    topic: entry.topic,
    duration: entry.duration_minutes,
    date: entry.entry_date,
    notes: entry.notes,
  };
}

function mapBrainDumpOutlineRow(outline) {
  return {
    id: outline.id,
    sourceNotes: outline.source_notes,
    introduction: outline.introduction,
    paragraphs: Array.isArray(outline.paragraph_points) ? outline.paragraph_points : [],
    conclusion: outline.conclusion,
    keyPoints: Array.isArray(outline.key_points) ? outline.key_points : [],
    sentenceStarters: Array.isArray(outline.sentence_starters)
      ? outline.sentence_starters
      : [],
    createdAt: outline.created_at,
  };
}

async function fetchHomeworkForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("homework_items")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapHomeworkRow);
}

async function createHomeworkForMember(member, task) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("homework_items")
    .insert({
      user_id: user.id,
      title: task.title,
      subject: task.subject,
      due_date: task.dueDate,
      completed: false,
      completed_date: null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapHomeworkRow(data);
}

async function updateHomeworkForMember(member, taskId, task) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { error } = await supabase
    .from("homework_items")
    .update({
      title: task.title,
      subject: task.subject,
      due_date: task.dueDate,
      completed: task.completed,
      completed_date: task.completedDate,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

async function deleteHomeworkForMember(member, taskId) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { error } = await supabase
    .from("homework_items")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

async function fetchRevisionSessionsForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("revision_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("session_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).reduce((accumulator, row) => {
    accumulator[row.session_date] = row.session_count;
    return accumulator;
  }, {});
}

async function incrementRevisionSessionForMember(member, sessionDate) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data: existing, error: fetchError } = await supabase
    .from("revision_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("session_date", sessionDate)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existing) {
    const { error } = await supabase.from("revision_sessions").insert({
      user_id: user.id,
      session_date: sessionDate,
      session_count: 1,
    });

    if (error) {
      throw error;
    }

    return 1;
  }

  const nextCount = existing.session_count + 1;
  const { error } = await supabase
    .from("revision_sessions")
    .update({ session_count: nextCount })
    .eq("id", existing.id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return nextCount;
}

async function fetchRevisionLogForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("revision_log_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapRevisionLogRow);
}

async function createRevisionLogForMember(member, entry) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("revision_log_entries")
    .insert({
      user_id: user.id,
      subject: entry.subject,
      topic: entry.topic,
      duration_minutes: entry.duration,
      entry_date: entry.date,
      notes: entry.notes,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRevisionLogRow(data);
}

async function deleteRevisionLogForMember(member, entryId) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { error } = await supabase
    .from("revision_log_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

async function fetchBrainDumpStateForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("brain_dump_states")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    notes: data.notes || "",
    canvasData: data.canvas_data || "",
  };
}

async function saveBrainDumpStateForMember(member, state) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { error } = await supabase.from("brain_dump_states").upsert(
    {
      user_id: user.id,
      notes: state.notes || "",
      canvas_data: state.canvasData || "",
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw error;
  }
}

async function fetchBrainDumpOutlinesForMember(member) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("brain_dump_outlines")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapBrainDumpOutlineRow);
}

async function createBrainDumpOutlineForMember(member, outline) {
  const supabase = await getSupabaseAdminClient();
  const user = await getOrCreateSupabaseUserForMember(member);
  const { data, error } = await supabase
    .from("brain_dump_outlines")
    .insert({
      user_id: user.id,
      source_notes: outline.sourceNotes,
      introduction: outline.introduction,
      paragraph_points: outline.paragraphs,
      conclusion: outline.conclusion,
      key_points: outline.keyPoints,
      sentence_starters: outline.sentenceStarters,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapBrainDumpOutlineRow(data);
}

async function generateJsonWithLLM({ systemPrompt, userPrompt, schema, fallbackError }) {
  if (OPENAI_API_KEY) {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "structured_output",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`OpenAI request failed: ${errorText}`);
    }

    const data = await apiResponse.json();

    if (!data.output_text) {
      throw new Error("No output_text returned from OpenAI");
    }

    return JSON.parse(data.output_text);
  }

  if (HF_TOKEN) {
    const schemaPrompt = JSON.stringify(schema, null, 2);
    const apiResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HF_TOKEN}`,
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nReturn JSON only. Follow this schema exactly:\n${schemaPrompt}`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Hugging Face request failed: ${errorText}`);
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No message content returned from Hugging Face");
    }

    return extractJsonObject(content);
  }

  if (AI21_API_KEY) {
    const schemaPrompt = JSON.stringify(schema, null, 2);
    const apiResponse = await fetch("https://api.ai21.com/studio/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI21_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI21_MODEL,
        max_tokens: 1400,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nReturn JSON only. Follow this schema exactly:\n${schemaPrompt}`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`AI21 request failed: ${errorText}`);
    }

    const data = await apiResponse.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const content = Array.isArray(rawContent)
      ? rawContent
          .map((item) => {
            if (typeof item === "string") {
              return item;
            }

            if (item?.text) {
              return item.text;
            }

            return "";
          })
          .join("")
      : rawContent;

    if (!content) {
      throw new Error("No message content returned from AI21");
    }

    try {
      return extractJsonObject(content);
    } catch {
      return content;
    }
  }

  throw new Error(fallbackError);
}

async function generateStudySetWithOpenAI(subject, topic) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
    },
  };

  const prompt = [
    `Create exactly 5 high-quality study flashcards for the subject "${subject}" and topic "${topic}".`,
    "Make the cards appropriate for a school student revising for homework or tests.",
    "Each question should be specific and useful.",
    "Each answer should be factually helpful, concise, and clear.",
    "Avoid placeholder language like 'write in your own words' or 'add detail from class'.",
    "Return JSON only.",
  ].join(" ");

  const parsed = await generateJsonWithLLM({
    systemPrompt:
      "You are a study assistant that creates accurate flashcards for school revision. Output only valid JSON.",
    userPrompt: prompt,
    schema,
    fallbackError: "Missing OPENAI_API_KEY, HF_TOKEN, or AI21_API_KEY",
  });

  return {
    cards: ensureArray(parsed.cards, "cards").map((card) => ({
      question: normaliseText(card.question),
      answer: normaliseText(card.answer),
    })),
  };
}

async function generateBrainDumpOutlineWithOpenAI(notes) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["introduction", "paragraphs", "conclusion", "keyPoints", "sentenceStarters"],
    properties: {
      introduction: { type: "string" },
      paragraphs: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "point"],
          properties: {
            title: { type: "string" },
            point: { type: "string" },
          },
        },
      },
      conclusion: { type: "string" },
      keyPoints: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },
      sentenceStarters: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: { type: "string" },
      },
    },
  };

  const prompt = [
    "Turn these messy study notes into a clear, exam-ready outline.",
    "Create a short introduction, 2 to 5 main paragraph points, a clear conclusion, 3 to 5 key points to remember, and 3 to 4 sentence starters.",
    "Keep the output useful for school revision and essay planning.",
    "Use the student's own ideas where possible instead of inventing a totally different answer.",
    "If quotes or evidence appear in the notes, preserve the strongest ones in the structure.",
    "Return JSON only.",
    "",
    notes,
  ].join("\n");

  const parsed = await generateJsonWithLLM({
    systemPrompt:
      "You are StudySpark's essay and revision organiser. Turn rough student notes into clear structured outlines and output only valid JSON.",
    userPrompt: prompt,
    schema,
    fallbackError: "Missing OPENAI_API_KEY, HF_TOKEN, or AI21_API_KEY",
  });

  const parsedValue = unwrapSchemaLikePayload(
    typeof parsed === "string" ? parseBrainDumpTextFallback(parsed) || { raw: parsed } : parsed
  );

  const introduction = pickFirstDefined(parsedValue, [
    "introduction",
    "intro",
    "overview",
    "opening",
  ]);
  const conclusion = pickFirstDefined(parsedValue, [
    "conclusion",
    "summary",
    "finalThought",
    "ending",
  ]);
  const paragraphs = normaliseParagraphs(
    pickFirstDefined(parsedValue, [
      "paragraphs",
      "mainPoints",
      "main_points",
      "bodyParagraphs",
      "body_paragraphs",
      "points",
      "outline",
    ])
  );
  const keyPoints = normaliseStringList(
    pickFirstDefined(parsedValue, [
      "keyPoints",
      "key_points",
      "rememberPoints",
      "thingsToRemember",
      "revisionPoints",
    ])
  );
  const sentenceStarters = normaliseStringList(
    pickFirstDefined(parsedValue, [
      "sentenceStarters",
      "sentence_starters",
      "starters",
      "writingStarters",
    ])
  );

  if (!introduction) {
    throw new Error(
      `Model response is missing introduction. Raw response: ${JSON.stringify(parsedValue).slice(0, 500)}`
    );
  }

  return {
    introduction: normaliseText(ensureString(introduction, "introduction")),
    paragraphs: ensureArray(paragraphs, "paragraphs"),
    conclusion: normaliseText(ensureString(conclusion, "conclusion")),
    keyPoints: ensureArray(keyPoints, "keyPoints"),
    sentenceStarters: ensureArray(sentenceStarters, "sentenceStarters"),
  };
}

async function generateEssayStructureWithAI({ subject, question, argument, paragraphCount }) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["overview", "introduction", "paragraphs", "conclusion"],
    properties: {
      overview: { type: "string" },
      introduction: { type: "string" },
      paragraphs: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "point", "analysis", "include"],
          properties: {
            title: { type: "string" },
            point: { type: "string" },
            analysis: { type: "string" },
            include: { type: "string" },
          },
        },
      },
      conclusion: { type: "string" },
    },
  };

  const prompt = [
    `Subject: ${subject}`,
    `Essay question: ${question}`,
    `Core argument: ${argument}`,
    `Number of body paragraphs: ${paragraphCount}`,
    "",
    "Create a strong school-level essay structure.",
    "Make it specific to the question and argument.",
    "The overview should summarise the line of argument clearly.",
    "The introduction should show how to open the essay directly and clearly.",
    "Each paragraph should have a focused title, a main point, a short analysis direction, and what evidence or detail to include.",
    "The conclusion should show how to finish the essay with confidence.",
    "Return JSON only.",
  ].join("\n");

  const parsed = await generateJsonWithLLM({
    systemPrompt:
      "You are StudySpark's premium essay planner. Build clear, specific essay structures for school students and output only valid JSON.",
    userPrompt: prompt,
    schema,
    fallbackError: "Missing OPENAI_API_KEY, HF_TOKEN, or AI21_API_KEY",
  });

  const parsedValue = unwrapSchemaLikePayload(
    typeof parsed === "string" ? parseBrainDumpTextFallback(parsed) || { raw: parsed } : parsed
  );
  const overview = pickFirstDefined(parsedValue, [
    "overview",
    "summary",
    "essayOverview",
    "essay_overview",
    "thesisOverview",
  ]);
  const introduction = pickFirstDefined(parsedValue, [
    "introduction",
    "intro",
    "opening",
  ]);
  const conclusion = pickFirstDefined(parsedValue, [
    "conclusion",
    "summaryEnding",
    "ending",
    "finalThought",
  ]);
  const paragraphs = normaliseParagraphs(
    pickFirstDefined(parsedValue, [
      "paragraphs",
      "mainPoints",
      "main_points",
      "bodyParagraphs",
      "body_paragraphs",
      "points",
      "outline",
    ])
  );

  const safeOverview = normaliseText(
    overview ||
      `This ${subject} essay argues that ${argument}. Each paragraph should directly answer: ${question}.`
  );

  return {
    overview: safeOverview,
    introduction: normaliseText(ensureString(introduction, "introduction")),
    paragraphs: ensureArray(paragraphs, "paragraphs").map((paragraph) => ({
      title: normaliseText(paragraph.title),
      point: normaliseText(paragraph.point),
      analysis: normaliseText(
        pickFirstDefined(paragraph, ["analysis", "explanation", "commentary"]) || paragraph.point
      ),
      include: normaliseText(
        pickFirstDefined(paragraph, ["include", "evidence", "support", "detail"]) ||
          "Relevant evidence, explanation, and a link back to the question."
      ),
    })),
    conclusion: normaliseText(ensureString(conclusion, "conclusion")),
  };
}

async function serveStatic(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/study-set") {
    try {
      const body = await readRequestBody(request);
      const subject = normaliseText(body.subject);
      const topic = normaliseText(body.topic);

      if (!subject || !topic) {
        sendJson(response, 400, { error: "Subject and topic are required." });
        return;
      }

      const studySet = await generateStudySetWithOpenAI(subject, topic);
      sendJson(response, 200, studySet);
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Failed to generate study set.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/member-access") {
    try {
      const member = await verifyMemberstackRequest(request);
      const access = await resolveMemberAccess(member);
      sendJson(response, 200, { access });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load membership access.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/brain-dump-outline") {
    try {
      const member = await verifyMemberstackRequest(request);
      const access = await resolveMemberAccess(member);

      if (!access.isPremium) {
        sendJson(response, 403, {
          error: "StudySpark Plus is required for the AI Brain Dump organiser.",
        });
        return;
      }

      const body = await readRequestBody(request);
      const notes = String(body.notes || "").trim();

      if (!notes) {
        sendJson(response, 400, { error: "Notes are required." });
        return;
      }

      const outline = await generateBrainDumpOutlineWithOpenAI(notes);
      sendJson(response, 200, outline);
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Failed to organise brain dump.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/essay-structure") {
    try {
      const member = await verifyMemberstackRequest(request);
      const access = await resolveMemberAccess(member);

      if (!access.isPremium) {
        sendJson(response, 403, {
          error: "StudySpark Plus is required for the AI Essay builder.",
        });
        return;
      }

      const body = await readRequestBody(request);
      const subject = normaliseText(body.subject);
      const question = normaliseText(body.question);
      const argument = normaliseText(body.argument);
      const paragraphCount = Math.min(5, Math.max(2, Number(body.paragraphCount) || 3));

      if (!subject || !question || !argument) {
        sendJson(response, 400, {
          error: "Subject, question, and argument are required.",
        });
        return;
      }

      const structure = await generateEssayStructureWithAI({
        subject,
        question,
        argument,
        paragraphCount,
      });
      sendJson(response, 200, structure);
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Failed to generate essay structure.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/homework") {
    try {
      const member = await verifyMemberstackRequest(request);
      const tasks = await fetchHomeworkForMember(member);
      sendJson(response, 200, { tasks });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load homework.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/homework") {
    try {
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);
      const title = normaliseText(body.title);
      const subject = normaliseText(body.subject);
      const dueDate = normaliseText(body.dueDate);

      if (!title || !subject || !dueDate) {
        sendJson(response, 400, { error: "Title, subject, and due date are required." });
        return;
      }

      const task = await createHomeworkForMember(member, { title, subject, dueDate });
      sendJson(response, 200, { task });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not save homework.",
      });
      return;
    }
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/homework/")) {
    try {
      const taskId = url.pathname.split("/").pop();
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);
      const title = normaliseText(body.title);
      const subject = normaliseText(body.subject);
      const dueDate = normaliseText(body.dueDate);

      if (!taskId || !title || !subject || !dueDate) {
        sendJson(response, 400, { error: "Valid homework details are required." });
        return;
      }

      await updateHomeworkForMember(member, taskId, {
        title,
        subject,
        dueDate,
        completed: Boolean(body.completed),
        completedDate: body.completedDate ? normaliseText(body.completedDate) : null,
      });
      sendJson(response, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not update homework.",
      });
      return;
    }
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/homework/")) {
    try {
      const taskId = url.pathname.split("/").pop();
      const member = await verifyMemberstackRequest(request);

      if (!taskId) {
        sendJson(response, 400, { error: "A homework ID is required." });
        return;
      }

      await deleteHomeworkForMember(member, taskId);
      sendJson(response, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not delete homework.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/revision-sessions") {
    try {
      const member = await verifyMemberstackRequest(request);
      const sessions = await fetchRevisionSessionsForMember(member);
      sendJson(response, 200, { sessions });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load revision sessions.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/revision-sessions/increment") {
    try {
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);
      const sessionDate = normaliseText(body.sessionDate);

      if (!sessionDate) {
        sendJson(response, 400, { error: "A session date is required." });
        return;
      }

      const sessionCount = await incrementRevisionSessionForMember(member, sessionDate);
      sendJson(response, 200, { sessionCount });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not record revision session.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/revision-log") {
    try {
      const member = await verifyMemberstackRequest(request);
      const entries = await fetchRevisionLogForMember(member);
      sendJson(response, 200, { entries });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load revision log.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/revision-log") {
    try {
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);
      const subject = normaliseText(body.subject);
      const topic = normaliseText(body.topic);
      const duration = Number(body.duration) || 0;
      const date = normaliseText(body.date);
      const notes = normaliseText(body.notes || "");

      if (!subject || !topic || !duration || !date) {
        sendJson(response, 400, {
          error: "Subject, topic, duration, and date are required.",
        });
        return;
      }

      const entry = await createRevisionLogForMember(member, {
        subject,
        topic,
        duration,
        date,
        notes,
      });
      sendJson(response, 200, { entry });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not save revision log entry.",
      });
      return;
    }
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/revision-log/")) {
    try {
      const entryId = url.pathname.split("/").pop();
      const member = await verifyMemberstackRequest(request);

      if (!entryId) {
        sendJson(response, 400, { error: "A revision log ID is required." });
        return;
      }

      await deleteRevisionLogForMember(member, entryId);
      sendJson(response, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not delete revision log entry.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/brain-dump-state") {
    try {
      const member = await verifyMemberstackRequest(request);
      const state = await fetchBrainDumpStateForMember(member);
      sendJson(response, 200, { state });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load brain dump state.",
      });
      return;
    }
  }

  if (request.method === "PUT" && url.pathname === "/api/brain-dump-state") {
    try {
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);

      await saveBrainDumpStateForMember(member, {
        notes: String(body.notes || ""),
        canvasData: String(body.canvasData || ""),
      });
      sendJson(response, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not save brain dump state.",
      });
      return;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/brain-dump-outlines") {
    try {
      const member = await verifyMemberstackRequest(request);
      const outlines = await fetchBrainDumpOutlinesForMember(member);
      sendJson(response, 200, { outlines });
      return;
    } catch (error) {
      sendJson(response, 401, {
        error: error.message || "Could not load saved outlines.",
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/brain-dump-outlines") {
    try {
      const member = await verifyMemberstackRequest(request);
      const body = await readRequestBody(request);
      const introduction = normaliseText(body.introduction);
      const conclusion = normaliseText(body.conclusion);
      const sourceNotes = String(body.sourceNotes || "").trim();
      const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [];
      const keyPoints = Array.isArray(body.keyPoints) ? body.keyPoints : [];
      const sentenceStarters = Array.isArray(body.sentenceStarters)
        ? body.sentenceStarters
        : [];

      if (!sourceNotes || !introduction || !conclusion || !paragraphs.length) {
        sendJson(response, 400, { error: "A complete outline is required." });
        return;
      }

      const outline = await createBrainDumpOutlineForMember(member, {
        sourceNotes,
        introduction,
        paragraphs,
        conclusion,
        keyPoints,
        sentenceStarters,
      });
      sendJson(response, 200, { outline });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Could not save outline.",
      });
      return;
    }
  }

  await serveStatic(url.pathname, response);
});

server.listen(PORT, () => {
  console.log(`StudySpark running at http://localhost:${PORT}`);
});
