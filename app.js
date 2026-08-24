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