"use client";

import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
  created_at: string;
};

function apiBase() {
  // Prefer same-origin when unset so deployments work behind Traefik/Cloudflared without CORS.
  return process.env.NEXT_PUBLIC_API_BASE || "";
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export default function HomePage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [slug, setSlug] = useState("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loggedIn = useMemo(() => !!me, [me]);

  useEffect(() => {
    (async () => {
      try {
        const m = await apiFetch("/api/me");
        setMe(m);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    (async () => {
      try {
        const ps = await apiFetch("/api/projects");
        setProjects(ps);
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();
  }, [loggedIn]);

  async function onLogin() {
    setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      const m = await apiFetch("/api/me");
      setMe(m);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function onLogout() {
    setError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setMe(null);
      setProjects([]);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function onCreateProject() {
    setError(null);
    try {
      const p = await apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ slug, repo_full_name: repo }) });
      setProjects([p, ...projects]);
      setSlug("");
      setRepo("");
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, letterSpacing: -0.5 }}>OpenCel</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.8 }}>Self-hosted deployments (v1 scaffold)</p>
        </div>
        {loggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ opacity: 0.85, fontSize: 13 }}>{me?.email}</div>
            <button onClick={onLogout} style={btn("ghost")}>Logout</button>
          </div>
        ) : null}
      </header>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.25)" }}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {!loggedIn ? (
        <section style={cardStyle({ marginTop: 24 })}>
          <h2 style={{ marginTop: 0 }}>Login</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <label style={labelStyle}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </label>
            <button onClick={onLogin} style={btn("primary")}>Login</button>
          </div>
          <p style={{ marginBottom: 0, opacity: 0.75, fontSize: 13 }}>
            Set `OPENCEL_BOOTSTRAP_EMAIL` and `OPENCEL_BOOTSTRAP_PASSWORD` on first start to create the initial admin.
          </p>
        </section>
      ) : (
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div style={cardStyle({})}>
            <h2 style={{ marginTop: 0 }}>Create Project</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <label style={labelStyle}>
                Slug
                <input placeholder="my-app" value={slug} onChange={(e) => setSlug(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                GitHub repo
                <input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} style={inputStyle} />
              </label>
              <button onClick={onCreateProject} style={btn("primary")}>Create</button>
            </div>
          </div>

          <div style={cardStyle({})}>
            <h2 style={{ marginTop: 0 }}>Projects</h2>
            {projects.length === 0 ? (
              <div style={{ opacity: 0.75, fontSize: 13 }}>No projects yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {projects.map((p) => (
                  <a key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 650 }}>{p.slug}</div>
                          <div style={{ opacity: 0.75, fontSize: 13 }}>{p.repo_full_name}</div>
                        </div>
                        <div style={{ opacity: 0.6, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function btn(variant: "primary" | "ghost") {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 650,
    cursor: "pointer",
    background: "transparent",
    color: "#e8edf6"
  };
  if (variant === "primary") return { ...base, background: "linear-gradient(135deg, #2f6bff, #00c2ff)", borderColor: "rgba(0,0,0,0.0)", color: "#08101c" };
  return base;
}

function cardStyle(extra: React.CSSProperties) {
  return {
    padding: 16,
    borderRadius: 14,
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.10)",
    ...extra
  } as React.CSSProperties;
}

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, opacity: 0.9 };
const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.25)",
  color: "#e8edf6",
  padding: "10px 12px",
  outline: "none"
};
