import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://axnhwectuynkbvhqqdxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bmh3ZWN0dXlua2J2aHFxZHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTI4MjMsImV4cCI6MjA4ODc2ODgyM30.gAHtpvkZBildrVqF3UmkvqnZdfing5SEQA7As-Ic8CU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  status: document.getElementById("status"),
  authSection: document.getElementById("authSection"),
  appSection: document.getElementById("appSection"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  signInBtn: document.getElementById("signInBtn"),
  signUpBtn: document.getElementById("signUpBtn"),
  forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  userBadge: document.getElementById("userBadge"),

  refreshQueuesBtn: document.getElementById("refreshQueuesBtn"),
  queuesList: document.getElementById("queuesList"),

  adminCreateQueue: document.getElementById("adminCreateQueue"),
  newQueueName: document.getElementById("newQueueName"),
  newQueueDescription: document.getElementById("newQueueDescription"),
  newQueueCommentsMode: document.getElementById("newQueueCommentsMode"),
  createQueueBtn: document.getElementById("createQueueBtn"),

  queueDetailEmpty: document.getElementById("queueDetailEmpty"),
  queueDetail: document.getElementById("queueDetail"),
  queueName: document.getElementById("queueName"),
  queueDescription: document.getElementById("queueDescription"),
  queueCommentsMode: document.getElementById("queueCommentsMode"),
  currentPerson: document.getElementById("currentPerson"),
  currentUpdatedAt: document.getElementById("currentUpdatedAt"),
  advanceComment: document.getElementById("advanceComment"),
  advanceBtn: document.getElementById("advanceBtn"),
  membersList: document.getElementById("membersList"),
  eventsList: document.getElementById("eventsList"),
};

const state = {
  session: null,
  profile: null,
  queues: [],
  selectedQueueId: null,
  realtimeChannel: null,
};

function setStatus(message = "", type = "info") {
  els.status.textContent = message;
  els.status.className = "status";
  if (type === "success") els.status.classList.add("success-text");
  if (type === "error") els.status.classList.add("danger-text");
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString();
}

function requireSelectedQueue() {
  return state.selectedQueueId;
}

function getSelectedQueue() {
  return state.queues.find((q) => q.queue_id === state.selectedQueueId) || null;
}

async function signUp() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email || !password) {
    setStatus("Enter email and password.", "error");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: email.split("@")[0] }
    }
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Account created. You can now sign in.", "success");
}

async function signIn() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email || !password) {
    setStatus("Enter email and password.", "error");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Signed in.", "success");
}
async function forgotPassword() {
  const email = els.emailInput.value.trim();

  if (!email) {
    setStatus("Enter your email first.", "error");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/app/"
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Password reset email sent.", "success");
}
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  setStatus("Signed out.", "success");
}

async function loadSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  state.session = data.session;
}

async function loadProfile() {
  if (!state.session?.user?.id) {
    state.profile = null;
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", state.session.user.id)
    .single();

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  state.profile = data;
}

async function loadQueues() {
  const { data, error } = await supabase
    .from("queue_current_view")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  state.queues = data || [];

  if (!state.selectedQueueId && state.queues.length > 0) {
    state.selectedQueueId = state.queues[0].queue_id;
  }

  renderQueues();
  await loadSelectedQueueDetails();
}

async function loadSelectedQueueDetails() {
  const queueId = requireSelectedQueue();
  if (!queueId) {
    els.queueDetail.classList.add("hidden");
    els.queueDetailEmpty.classList.remove("hidden");
    return;
  }

  els.queueDetailEmpty.classList.add("hidden");
  els.queueDetail.classList.remove("hidden");

  const queue = getSelectedQueue();
  if (queue) {
    els.queueName.textContent = queue.name || "Unnamed queue";
    els.queueDescription.textContent = queue.description || "";
    els.queueCommentsMode.textContent = `Comments: ${queue.comments_mode}`;
    els.currentPerson.textContent = queue.current_user_name || "No current member";
    els.currentUpdatedAt.textContent = queue.updated_at
      ? `Last updated: ${formatDate(queue.updated_at)}`
      : "";
  }

  await Promise.all([loadMembers(queueId), loadEvents(queueId)]);
}

async function loadMembers(queueId) {
  const { data, error } = await supabase
    .from("queue_members")
    .select(`
      id,
      position,
      is_enabled,
      user_id,
      profiles!queue_members_user_id_fkey (
        full_name,
        role
      )
    `)
    .eq("queue_id", queueId)
    .order("position", { ascending: true });

  if (error) {
    els.membersList.innerHTML = `<div class="danger-text">Failed to load members: ${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    els.membersList.innerHTML = `<div class="muted">No members yet.</div>`;
    return;
  }

  els.membersList.innerHTML = data.map((m) => `
    <div class="member-item">
      <div><strong>#${m.position}</strong> — ${m.profiles?.full_name || "Unknown user"}</div>
      <div class="muted small">Role: ${m.profiles?.role || "unknown"} | ${m.is_enabled ? "Enabled" : "Disabled"}</div>
    </div>
  `).join("");
}

async function loadEvents(queueId) {
  const { data, error } = await supabase
    .from("queue_events")
    .select(`
      id,
      event_type,
      comment,
      created_at,
      actor_id,
      actor:profiles!queue_events_actor_id_fkey (
        full_name
      )
    `)
    .eq("queue_id", queueId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    els.eventsList.innerHTML = `<div class="danger-text">Failed to load events: ${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    els.eventsList.innerHTML = `<div class="muted">No activity yet.</div>`;
    return;
  }

  els.eventsList.innerHTML = data.map((e) => `
    <div class="event-item">
      <div><strong>${e.event_type}</strong></div>
      <div class="muted small">By: ${e.actor?.full_name || "Unknown"} | ${formatDate(e.created_at)}</div>
      ${e.comment ? `<div style="margin-top:6px;">${escapeHtml(e.comment)}</div>` : ""}
    </div>
  `).join("");
}

function renderQueues() {
  if (!state.queues.length) {
    els.queuesList.innerHTML = `<div class="muted">No queues found.</div>`;
    return;
  }

  els.queuesList.innerHTML = state.queues.map((q) => `
    <div class="queue-item">
      <div class="row space-between">
        <div>
          <div><strong>${escapeHtml(q.name)}</strong></div>
          <div class="muted small">${escapeHtml(q.description || "")}</div>
          <div class="muted small">Current: ${escapeHtml(q.current_user_name || "None")}</div>
        </div>
        <div>
          <button data-queue-id="${q.queue_id}" class="secondary select-queue-btn">
            ${state.selectedQueueId === q.queue_id ? "Selected" : "Open"}
          </button>
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".select-queue-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.selectedQueueId = btn.dataset.queueId;
      renderQueues();
      await loadSelectedQueueDetails();
      await subscribeToQueueChanges();
    });
  });
}

async function createQueue() {
  const name = els.newQueueName.value.trim();
  const description = els.newQueueDescription.value.trim();
  const commentsMode = els.newQueueCommentsMode.value;

  if (!name) {
    setStatus("Enter a queue name.", "error");
    return;
  }

  const { data, error } = await supabase.rpc("create_queue", {
    p_name: name,
    p_description: description || null,
    p_comments_mode: commentsMode,
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  els.newQueueName.value = "";
  els.newQueueDescription.value = "";
  els.newQueueCommentsMode.value = "optional";

  setStatus("Queue created.", "success");
  state.selectedQueueId = data;
  await loadQueues();
  await subscribeToQueueChanges();
}

async function advanceQueue() {
  const queue = getSelectedQueue();
  if (!queue) {
    setStatus("Select a queue first.", "error");
    return;
  }

  const comment = els.advanceComment.value.trim();

  if (queue.comments_mode === "required" && !comment) {
    setStatus("Comment is required for this queue.", "error");
    return;
  }

  const { error } = await supabase.rpc("advance_queue", {
    p_queue_id: queue.queue_id,
    p_comment: comment || null,
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  els.advanceComment.value = "";
  setStatus("Queue advanced.", "success");
  await loadQueues();
}

function renderAuthState() {
  const signedIn = !!state.session;

  els.authSection.classList.toggle("hidden", signedIn);
  els.appSection.classList.toggle("hidden", !signedIn);
  els.logoutBtn.classList.toggle("hidden", !signedIn);
  els.userBadge.classList.toggle("hidden", !signedIn);

  if (signedIn && state.profile) {
    const name = state.profile.full_name || state.session.user.email || "User";
    els.userBadge.textContent = `${name} (${state.profile.role})`;
    els.adminCreateQueue.classList.toggle("hidden", state.profile.role !== "admin");
  } else {
    els.userBadge.textContent = "";
    els.adminCreateQueue.classList.add("hidden");
  }
}

async function refreshApp() {
  await loadSession();
  if (state.session) {
    await loadProfile();
    await loadQueues();
    await subscribeToQueueChanges();
  } else {
    state.profile = null;
    state.queues = [];
    state.selectedQueueId = null;
    unsubscribeRealtime();
  }
  renderAuthState();
}

function unsubscribeRealtime() {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }
}

async function subscribeToQueueChanges() {
  unsubscribeRealtime();

  const queueId = requireSelectedQueue();
  if (!queueId || !state.session) return;

  state.realtimeChannel = supabase
    .channel(`queue-${queueId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "queue_state", filter: `queue_id=eq.${queueId}` },
      async () => {
        await loadQueues();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "queue_events", filter: `queue_id=eq.${queueId}` },
      async () => {
        await loadSelectedQueueDetails();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "queue_members", filter: `queue_id=eq.${queueId}` },
      async () => {
        await loadSelectedQueueDetails();
      }
    )
    .subscribe();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  els.signUpBtn.addEventListener("click", signUp);
  els.signInBtn.addEventListener("click", signIn);
  els.forgotPasswordBtn.addEventListener("click", forgotPassword);
  els.logoutBtn.addEventListener("click", signOut);
  els.refreshQueuesBtn.addEventListener("click", loadQueues);
  els.createQueueBtn.addEventListener("click", createQueue);
  els.advanceBtn.addEventListener("click", advanceQueue);
}

async function init() {
  bindEvents();
  await refreshApp();

  supabase.auth.onAuthStateChange(async () => {
    await refreshApp();
  });
}

init();
