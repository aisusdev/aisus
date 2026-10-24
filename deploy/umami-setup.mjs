// Run inside the Umami container by deploy.sh: waits for Umami, replaces the default admin password
// ("umami") with ADMIN_PASSWORD, creates the website for SITE once, and prints the website's id.
const base = "http://localhost:3000/api";

async function call(path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

const login = (password) => call("/auth/login", null, { username: "admin", password });

for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(`${base}/heartbeat`)).ok) break;
  } catch {
    // Umami is still starting.
  }
  if (attempt === 60) throw new Error("Umami did not start within two minutes");
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

// Changing the password ends the session, so the setup signs in again with the new one.
try {
  const first = await login("umami");
  await call("/me/password", first.token, { currentPassword: "umami", newPassword: process.env.ADMIN_PASSWORD });
} catch {
  // The default password was replaced on an earlier deploy.
}
const session = await login(process.env.ADMIN_PASSWORD);
const listed = await call("/websites?pageSize=100", session.token);
const found = (listed.data ?? listed).find((site) => site.domain === process.env.SITE);
const site = found ?? (await call("/websites", session.token, { name: "Sustain", domain: process.env.SITE }));
console.log(site.id);
