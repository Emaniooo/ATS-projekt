const SUPABASE_URL = "https://ociqnhrzyyphecbdzjdw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0eSjt8UQ9jvlKiSBsU4EEw_m847MCqW";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// LOGIN
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        document.getElementById("login-error").textContent = error.message;
        return;
      }

      const profile = await getProfile();

      if (profile.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    });
  }

  // Ladda jobb när dashboard öppnas
  if (document.getElementById("jobs-list")) {
    loadJobs();
    loadKanban();
  }

  // Skapa jobb
  const createJobForm = document.getElementById("create-job-form");
  if (createJobForm) {
    createJobForm.addEventListener("submit", (e) => {
      e.preventDefault();
      createJob();
    });
  }

  // Skapa kandidat
  const createCandidateForm = document.getElementById("create-candidate-form");
  if (createCandidateForm) {
    createCandidateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      createCandidate();
    });
  }

  // Filter‑events för kanban
  const filterJob = document.getElementById("filter-job");
  if (filterJob) {
    filterJob.addEventListener("change", loadKanban);
  }
  const filterName = document.getElementById("filter-name");
  if (filterName) {
    filterName.addEventListener("input", loadKanban);
  }

  // Drag‑and‑drop listeners
  document.querySelectorAll(".kanban-items").forEach(col => {
    col.addEventListener("dragover", e => e.preventDefault());

    col.addEventListener("drop", async e => {
      e.preventDefault();

      const id = e.dataTransfer.getData("id");

      const column = col.closest(".kanban-column");
      const newStage = column.dataset.stage;

      await client
        .from("candidates")
        .update({ stage: newStage })
        .eq("id", id);

      loadKanban();
    });
  });
});

// HÄMTA PROFIL
async function getProfile() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("user_profiles")
    .select("role, customer_id")
    .eq("id", user.id)
    .single();

  return data;
}

// LÄS JOBB
async function loadJobs() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
    .single();

  const { data: jobs, error } = await client
    .from("jobs")
    .select("*")
    .eq("customer_id", profile.customer_id);

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("jobs-list");
  if (container) {
    container.innerHTML = "";

    jobs.forEach(job => {
      const div = document.createElement("div");
      div.className = "job-card";
      div.innerHTML = `
        <h3>${job.title}</h3>
        <p>${job.status}</p>
      `;
      container.appendChild(div);
    });
  }

  // Fyll dropdown för kandidater
  const jobSelect = document.getElementById("candidate-job");
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">Välj jobb</option>';
    jobs.forEach(job => {
      jobSelect.innerHTML += `<option value="${job.id}">${job.title}</option>`;
    });
  }

  // Fyll filter-job dropdown
  const filterJob = document.getElementById("filter-job");
  if (filterJob) {
    filterJob.innerHTML = '<option value="">Alla jobb</option>';
    jobs.forEach(job => {
      filterJob.innerHTML += `<option value="${job.id}">${job.title}</option>`;
    });
  }
}

// SKAPA JOBB
async function createJob() {
  const title = document.getElementById("job-title").value;
  const description = document.getElementById("job-description").value;

  const { data: { user } } = await client.auth.getUser();

  const { data: profile } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
    .single();

  const { error } = await client
    .from("jobs")
    .insert({
      title,
      description,
      customer_id: profile.customer_id,
      status: "open"
    });

  if (error) {
    document.getElementById("job-message").textContent = error.message;
    return;
  }

  document.getElementById("job-message").textContent = "Jobb skapat!";
  document.getElementById("create-job-form").reset();

  await loadJobs();
  await loadKanban();
}

// SKAPA KANDIDAT
async function createCandidate() {
  const name = document.getElementById("candidate-name").value;
  const email = document.getElementById("candidate-email").value;
  const linkedin = document.getElementById("candidate-linkedin").value;
  const jobId = document.getElementById("candidate-job").value;

  const { data: { user } } = await client.auth.getUser();

  const { data: profile } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
    .single();

  const { error } = await client
    .from("candidates")
    .insert({
      name,
      email,
      linkedin,
      job_id: jobId,
      customer_id: profile.customer_id,
      stage: "applied"
    });

  if (error) {
    document.getElementById("candidate-message").textContent = error.message;
    return;
  }

  document.getElementById("candidate-message").textContent = "Kandidat skapad!";
  document.getElementById("create-candidate-form").reset();

  await loadKanban();
}

const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"];

async function loadKanban() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
    .single();

  const { data: candidates, error } = await client
    .from("candidates")
    .select("*")
    .eq("customer_id", profile.customer_id);

  if (error) {
    console.error(error);
    return;
  }

  renderKanban(candidates || []);
}

function renderKanban(candidates) {
  stages.forEach(stage => {
    const col = document.getElementById(`col-${stage}`);
    if (col) col.innerHTML = "";
  });

  const jobFilterEl = document.getElementById("filter-job");
  const nameFilterEl = document.getElementById("filter-name");

  const jobFilter = jobFilterEl ? jobFilterEl.value : "";
  const nameFilter = nameFilterEl ? nameFilterEl.value.toLowerCase() : "";

  candidates
    .filter(c => !jobFilter || c.job_id === jobFilter)
    .filter(c => c.name.toLowerCase().includes(nameFilter))
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "kanban-card";
      card.draggable = true;
      card.dataset.id = c.id;
      card.innerHTML = `
        <strong>${c.name}</strong><br>
        ${c.email}<br>
        <small>${c.stage}</small>
      `;

      card.addEventListener("dragstart", dragStart);

      const col = document.getElementById(`col-${c.stage}`);
      if (col) col.appendChild(card);
    });
}

function dragStart(e) {
  e.dataTransfer.setData("id", e.target.dataset.id);
}

function dragStart(e) {
  console.log("DRAG START FIRED");
  e.dataTransfer.setData("id", e.target.dataset.id);
}
