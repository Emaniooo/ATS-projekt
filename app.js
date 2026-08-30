const SUPABASE_URL = "https://ociqnhrzyyphecbdzjdw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0eSjt8UQ9jvlKiSBsU4EEw_m847MCqW";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HÄMTA PROFIL
async function getProfile() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from("user_profiles")
    .select("role, customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getProfile error:", error);
    return null;
  }

  //  Om profilen saknas → skapa en automatiskt
  if (!data) {
    await client.from("user_profiles").insert({
      id: user.id,
      role: "customer",
      customer_id: null   // eller sätt rätt värde om du vill
    });

    return { role: "customer", customer_id: null };
  }

  return data;
}


document.addEventListener("DOMContentLoaded", async () => {
  // LOGIN
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailEl = document.getElementById("email");
      const passwordEl = document.getElementById("password");
      const errorEl = document.getElementById("login-error");

      const email = emailEl ? emailEl.value : "";
      const password = passwordEl ? passwordEl.value : "";

      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        if (errorEl) errorEl.textContent = error.message;
        return;
      }

      const profile = await getProfile();
      if (!profile || !profile.role) {
        window.location.href = "dashboard.html";
        return;
      }

      window.location.href = profile.role === "admin" ? "admin.html" : "dashboard.html";
    });
  }

  // PROFILMENY (navbar)
  const authButton = document.getElementById("auth-button");
  const adminLink = document.getElementById("admin-link");
  const profileIconContainer = document.getElementById("profile-icon-container");
  const profileDropdown = document.getElementById("profile-dropdown");
  const ddName = document.getElementById("dd-name");
  const ddEmail = document.getElementById("dd-email");
  const logoutBtn = document.getElementById("logout-btn");
  const profileIcon = document.getElementById("profile-icon");

  const { data: { user } } = await client.auth.getUser();

  if (user) {
    if (profileIconContainer) profileIconContainer.style.display = "block";
    if (authButton) authButton.style.display = "none";

    const profile = await getProfile();

    if (ddName) ddName.textContent = user.email.split("@")[0];
    if (ddEmail) ddEmail.textContent = user.email;

    if (profile && profile.role !== "admin" && adminLink) {
      adminLink.style.display = "none";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = "home.html";
      });
    }

    if (profileIcon && profileDropdown && profileIconContainer) {
      profileIcon.addEventListener("click", () => {
        profileDropdown.style.display =
          profileDropdown.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (!profileIconContainer.contains(e.target)) {
          profileDropdown.style.display = "none";
        }
      });
    }
  } else {
    if (authButton) authButton.style.display = "block";
    if (profileIconContainer) profileIconContainer.style.display = "none";
    if (adminLink) adminLink.style.display = "none";
  }

  // DASHBOARD: jobb + kandidater + kanban
  if (document.getElementById("jobs-list")) {
    loadJobs();
    loadKanban();
  }

  const createJobForm = document.getElementById("create-job-form");
  if (createJobForm) {
    createJobForm.addEventListener("submit", (e) => {
      e.preventDefault();
      createJob();
    });
  }

  const createCandidateForm = document.getElementById("create-candidate-form");
  if (createCandidateForm) {
    createCandidateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      createCandidate();
    });
  }

  const filterJob = document.getElementById("filter-job");
  if (filterJob) {
    filterJob.addEventListener("change", loadKanban);
  }
  const filterName = document.getElementById("filter-name");
  if (filterName) {
    filterName.addEventListener("input", loadKanban);
  }

  // ADMIN PANEL: skapa kund
  const createCustomerForm = document.getElementById("create-customer-form");
  if (createCustomerForm) {
    createCustomerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameEl = document.getElementById("customer-name");
      const name = nameEl ? nameEl.value : "";

      const { error } = await client.from("customers").insert({ name });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Kund skapad!");
      createCustomerForm.reset();
    });
  }

  // ADMIN PANEL: skapa användare via Edge Function
const createUserForm = document.getElementById("create-user-form");
if (createUserForm) {
  createUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailEl = document.getElementById("new-user-email");
    const passwordEl = document.getElementById("new-user-password");

    const email = emailEl ? emailEl.value : "";
    const password = passwordEl ? passwordEl.value : "";

    // 1. Hämta adminens profil (för customer_id)
    const { data: { user: adminUser } } = await client.auth.getUser();
    const { data: adminProfile, error: adminProfileError } = await client
      .from("user_profiles")
      .select("customer_id")
      .eq("id", adminUser.id)
      .maybeSingle();

    if (adminProfileError || !adminProfile) {
      alert("Kunde inte hämta adminens profil.");
      return;
    }

    // 2. Anropa Edge Function för att skapa användaren
    const res = await fetch(
      "https://ociqnhrzyyphecbdzjdw.supabase.co/functions/v1/createUser",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          customer_id: adminProfile.customer_id
        })
      }
    );

    const result = await res.json();

    if (result.error) {
      alert(result.error.message);
      return;
    }

    alert("Användare skapad!");
    createUserForm.reset();
  });
}


  // Drag‑and‑drop listeners för kanban
  document.querySelectorAll(".kanban-items").forEach(col => {
    col.addEventListener("dragover", e => e.preventDefault());

    col.addEventListener("drop", async e => {
      e.preventDefault();

      const id = e.dataTransfer.getData("id");
      const column = col.closest(".kanban-column");
      if (!column) return;

      const newStage = column.dataset.stage;

      await client
        .from("candidates")
        .update({ stage: newStage })
        .eq("id", id);

      loadKanban();
    });
  });
});

// LÄS JOBB
async function loadJobs() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
.maybeSingle();

  if (profileError || !profile) {
    console.error("loadJobs profile error:", profileError);
    return;
  }

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

  const jobSelect = document.getElementById("candidate-job");
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">Välj jobb</option>';
    jobs.forEach(job => {
      jobSelect.innerHTML += `<option value="${job.id}">${job.title}</option>`;
    });
  }

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
  const titleEl = document.getElementById("job-title");
  const descriptionEl = document.getElementById("job-description");
  const msgEl = document.getElementById("job-message");

  const title = titleEl ? titleEl.value : "";
  const description = descriptionEl ? descriptionEl.value : "";

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
.maybeSingle();

  if (profileError || !profile) {
    if (msgEl) msgEl.textContent = "Kunde inte hämta profil.";
    return;
  }

  const { error } = await client
    .from("jobs")
    .insert({
      title,
      description,
      customer_id: profile.customer_id,
      status: "open"
    });

  if (error) {
    if (msgEl) msgEl.textContent = error.message;
    return;
  }

  if (msgEl) msgEl.textContent = "Jobb skapat!";
  const form = document.getElementById("create-job-form");
  if (form) form.reset();

  await loadJobs();
  await loadKanban();
}

// SKAPA KANDIDAT
async function createCandidate() {
  const nameEl = document.getElementById("candidate-name");
  const emailEl = document.getElementById("candidate-email");
  const linkedinEl = document.getElementById("candidate-linkedin");
  const jobIdEl = document.getElementById("candidate-job");
  const msgEl = document.getElementById("candidate-message");

  const name = nameEl ? nameEl.value : "";
  const email = emailEl ? emailEl.value : "";
  const linkedin = linkedinEl ? linkedinEl.value : "";
  const jobId = jobIdEl ? jobIdEl.value : "";

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
.maybeSingle();

  if (profileError || !profile) {
    if (msgEl) msgEl.textContent = "Kunde inte hämta profil.";
    return;
  }

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
    if (msgEl) msgEl.textContent = error.message;
    return;
  }

  if (msgEl) msgEl.textContent = "Kandidat skapad!";
  const form = document.getElementById("create-candidate-form");
  if (form) form.reset();

  await loadKanban();
}

const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"];

async function loadKanban() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("customer_id")
    .eq("id", user.id)
.maybeSingle();

  if (profileError || !profile) {
    console.error("loadKanban profile error:", profileError);
    return;
  }

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
const resetBtn = document.getElementById("reset-filters");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const jobFilter = document.getElementById("filter-job");
    const nameFilter = document.getElementById("filter-name");

    if (jobFilter) jobFilter.value = "";
    if (nameFilter) nameFilter.value = "";

    loadKanban();
  });
}
