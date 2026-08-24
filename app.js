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
});