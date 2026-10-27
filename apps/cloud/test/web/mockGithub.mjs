// A stand-in for github.com and api.github.com in the [web] tests: OAuth that signs in "dev" at
// once, the user and organization APIs, repository permissions, and an OIDC signing key.
// Every repository under "acme" and "guild", organizations, and under "dev", the user's own account,
// is the user's as admin. Under "crew", an organization, the user can only read. Names starting with
// "open" are public. The user's repository list holds one public repository of dev, acme and crew.
import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";

const port = Number(process.argv[2] ?? 3211);
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwks = { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "web-test", alg: "RS256", use: "sig" }] };

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function idOf(name) {
  return [...name].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) % 1_000_000;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  if (url.pathname === "/login/oauth/authorize") {
    const back = new URL(url.searchParams.get("redirect_uri") ?? "");
    back.searchParams.set("code", "web-code");
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    response.writeHead(302, { location: back.toString() });
    response.end();
  } else if (url.pathname === "/login/oauth/access_token") {
    json(response, 200, { access_token: "gho_web_token", token_type: "bearer", scope: "read:user,read:org" });
  } else if (url.pathname === "/user") {
    json(response, 200, { id: 1, login: "dev", name: "Dev Example", avatar_url: "" });
  } else if (url.pathname === "/user/orgs") {
    json(response, 200, [{ id: 7, login: "acme" }]);
  } else if (url.pathname === "/user/memberships/orgs") {
    json(response, 200, [
      { role: "admin", state: "active", organization: { login: "acme" } },
      { role: "admin", state: "active", organization: { login: "guild" } },
      { role: "member", state: "active", organization: { login: "crew" } },
    ]);
  } else if (url.pathname === "/user/repos") {
    json(response, 200, [
      { id: idOf("open-journal"), name: "open-journal", owner: { login: "dev" }, private: false, default_branch: "main", permissions: { admin: true, push: true, pull: true } },
      { id: idOf("open-site"), name: "open-site", owner: { login: "acme" }, private: false, default_branch: "main", permissions: { admin: true, push: true, pull: true } },
      { id: idOf("open-docs"), name: "open-docs", owner: { login: "crew" }, private: false, default_branch: "main", permissions: { admin: false, push: false, pull: true } },
    ]);
  } else if (/^\/repos\/(acme|dev|guild|crew)\/[^/]+$/.test(url.pathname)) {
    const [, , owner, encoded] = url.pathname.split("/");
    const name = decodeURIComponent(encoded);
    json(response, 200, { id: idOf(name), name, owner: { login: owner }, private: !name.startsWith("open"), default_branch: "main", permissions: owner === "crew" ? { admin: false, push: false, pull: true } : { admin: true, push: true, pull: true } });
  } else if (url.pathname === "/.well-known/jwks") {
    json(response, 200, jwks);
  } else if (url.pathname === "/__test/private-key") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(privateKey.export({ format: "pem", type: "pkcs8" }));
  } else {
    json(response, 404, { message: "Not Found" });
  }
}).listen(port, "127.0.0.1");
