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
  if (!container) return;

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

  // Fyll dropdown för kandidater
  const jobSelect = document.getElementById("candidate-job");
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">Välj jobb</option>';
    jobs.forEach(job => {
      jobSelect.innerHTML += `<option value="${job.id}">${job.title}</option>`;
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

  loadJobs();
}

// SKAPA KANDIDAT
async function createCandidate() {
  const name = document.getElementById("candidate-name").value;
  const email = document.getElementById("candidate-email").value;
  const linkedin = document.getElementById("candidate-linkedin").value;
  const jobId = document.getElementById("candidate-job").value;

  const { data: { user } } = await client.auth.getUser();

  // Hämta customer_id från user_profiles
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
      customer_id: profile.customer_id,   // ← DENNA ÄR NYCKELN
      stage: "applied"
    });

  if (error) {
    document.getElementById("candidate-message").textContent = error.message;
    return;
  }

  document.getElementById("candidate-message").textContent = "Kandidat skapad!";
  document.getElementById("create-candidate-form").reset();
}

