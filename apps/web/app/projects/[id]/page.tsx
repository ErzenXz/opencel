"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Deployment = {
  id: string;
  git_sha: string;
  git_ref: string;
  type: string;
  status: string;
  preview_url?: string | null;
  created_at: string;
};

function apiBase() {
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

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logDeploymentID, setLogDeploymentID] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");

  const selected = useMemo(() => deployments.find((d) => d.id === logDeploymentID) || null, [deployments, logDeploymentID]);

  useEffect(() => {
    if (!projectID) return;
    (async () => {
      try {
        const p = await apiFetch(`/api/projects/${projectID}`);
        setProject(p);
        const ds = await apiFetch(`/api/projects/${projectID}/deployments`);
        setDeployments(ds);
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();
  }, [projectID]);

  useEffect(() => {
    if (!logDeploymentID) return;
    setLogs("");
    const url = `${apiBase()}/api/deployments/${logDeploymentID}/logs`;
    const es = new EventSource(url, { withCredentials: true } as any);
    es.addEventListener("log", (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        setLogs((prev) => prev + (data.chunk || ""));
      } catch {
        // ignore
      }
    });
    es.addEventListener("error", () => {
      es.close();
    });
    return () => es.close();
  }, [logDeploymentID]);

  async function promote(deploymentID: string) {
    setError(null);
    try {
      await apiFetch(`/api/deployments/${deploymentID}/promote`, { method: "POST", body: "{}" });
      // refresh project info
      const p = await apiFetch(`/api/projects/${projectID}`);
      setProject(p);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <a href="/" style={{ opacity: 0.8, textDecoration: "none" }}>{"<-"} Back</a>
      <h1 style={{ marginBottom: 6 }}>{project?.slug || "Project"}</h1>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{project?.repo_full_name}</div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.25)" }}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle({})}>
          <h2 style={{ marginTop: 0 }}>Deployments</h2>
          {deployments.length === 0 ? (
            <div style={{ opacity: 0.75, fontSize: 13 }}>No deployments yet. Push to GitHub to trigger a deploy.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {deployments.map((d) => (
                <div key={d.id} style={rowStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 650 }}>{d.status}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        {d.type} · {d.git_ref.replace("refs/heads/", "")} · {d.git_sha.slice(0, 7)}
                      </div>
                      {d.preview_url ? (
                        <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>
                          <a href={d.preview_url} target="_blank" rel="noreferrer">{d.preview_url}</a>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                      <div style={{ opacity: 0.6, fontSize: 12 }}>{new Date(d.created_at).toLocaleString()}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setLogDeploymentID(d.id)} style={btn("ghost")}>Logs</button>
                        <button onClick={() => promote(d.id)} style={btn("primary")}>Promote</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle({})}>
          <h2 style={{ marginTop: 0 }}>Logs</h2>
          <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
            {selected ? `Streaming logs for ${selected.id.slice(0, 8)}...` : "Select a deployment to view logs."}
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.4, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12, minHeight: 420 }}>
            {logs || (selected ? "(waiting for logs...)" : "")}
          </pre>
        </div>
      </section>
    </main>
  );
}

function btn(variant: "primary" | "ghost") {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "8px 12px",
    fontWeight: 650,
    cursor: "pointer",
    background: "transparent",
    color: "#e8edf6",
    fontSize: 13
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

const rowStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)"
};
