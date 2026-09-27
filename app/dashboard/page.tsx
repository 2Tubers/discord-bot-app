"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface CommandLog {
  id: string;
  command_name: string;
  user_name: string;
  options: any;
  response: string;
  status: string;
  created_at: string;
  guild_id: string;
  ai_category: string | null;
  ai_severity: string | null;
  ai_summary: string | null;
}

interface CommandConfig {
  id: string;
  command_name: string;
  enabled: boolean;
  mirror_enabled: boolean;
  ai_triage_enabled: boolean;
  response_template: string | null;
  default_severity: string;
  guild_id: string | null;
}

interface Server {
  id: string;
  guild_id: string;
  guild_name: string;
  added_at: string;
}

interface ErrorLog {
  id: string;
  guild_id: string | null;
  interaction_id: string;
  error_type: string;
  error_message: string;
  context: any;
  resolved: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [configs, setConfigs] = useState<CommandConfig[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "settings" | "failures">("logs");
  const [selectedServer, setSelectedServer] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    checkAuth(supabase);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchServers();
      refreshData();
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, selectedServer]);

  async function checkAuth(supabase: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    } else {
      setAuthenticated(true);
    }
  }

  async function refreshData() {
    const supabase = createBrowserSupabaseClient();
    await Promise.all([fetchLogs(supabase), fetchConfigs(), fetchErrors()]);
  }

  async function fetchServers() {
    try {
      const response = await fetch("/api/servers");
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error("Failed to fetch servers:", error);
    }
  }

  async function fetchLogs(supabase: any) {
    let query = supabase
      .from("command_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (selectedServer !== "all") {
      query = query.eq("guild_id", selectedServer);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch logs:", error);
    } else {
      setLogs(data ?? []);
    }
    setLoading(false);
  }

  async function fetchConfigs() {
    try {
      const guildParam = selectedServer !== "all" ? `?guild_id=${selectedServer}` : "";
      const response = await fetch(`/api/config${guildParam}`);
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error("Failed to fetch configs:", error);
    }
  }

  async function fetchErrors() {
    try {
      const guildParam = selectedServer !== "all" ? `?guild_id=${selectedServer}` : "";
      const response = await fetch(`/api/errors${guildParam}`);
      const data = await response.json();
      setErrors(data);
    } catch (error) {
      console.error("Failed to fetch errors:", error);
    }
  }

  async function updateConfig(commandName: string, updates: Partial<CommandConfig>) {
    setSaving(true);
    try {
      const current = configs.find((c) => c.command_name === commandName);
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...current,
          ...updates,
          command_name: commandName,
          guild_id: selectedServer !== "all" ? selectedServer : null,
        }),
      });
      const updated = await response.json();
      setConfigs(configs.map((c) => (c.command_name === commandName ? updated : c)));
    } catch (error) {
      console.error("Failed to update config:", error);
    }
    setSaving(false);
  }

  async function resolveError(errorId: string) {
    try {
      await fetch("/api/errors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: errorId }),
      });
      setErrors(errors.map((e) => (e.id === errorId ? { ...e, resolved: true } : e)));
    } catch (error) {
      console.error("Failed to resolve error:", error);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!authenticated) return null;

  const unresolvedCount = errors.filter((e) => !e.resolved).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", color: "#e0e0e0", fontFamily: "system-ui, sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600 }}>Command Dashboard</h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Server Picker */}
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Servers</option>
              {servers.map((s) => (
                <option key={s.guild_id} value={s.guild_id}>
                  {s.guild_name}
                </option>
              ))}
            </select>
            <button onClick={handleLogout} style={logoutBtnStyle}>Log out</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          <button onClick={() => setActiveTab("logs")} style={{ ...tabStyle, backgroundColor: activeTab === "logs" ? "#5865f2" : "#2a2b35" }}>
            Command Log
          </button>
          <button onClick={() => setActiveTab("settings")} style={{ ...tabStyle, backgroundColor: activeTab === "settings" ? "#5865f2" : "#2a2b35" }}>
            Settings
          </button>
          <button onClick={() => setActiveTab("failures")} style={{ ...tabStyle, backgroundColor: activeTab === "failures" ? "#5865f2" : "#2a2b35", position: "relative" }}>
            Failures
            {unresolvedCount > 0 && (
              <span style={{ position: "absolute", top: "-6px", right: "-6px", backgroundColor: "#ef4444", color: "white", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>
                {unresolvedCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Command Log Tab ─────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2b35" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Command</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>AI Category</th>
                  <th style={thStyle}>AI Summary</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center" }}>Loading...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center" }}>No commands logged yet.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #1f2029" }}>
                      <td style={tdStyle}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={tdStyle}><code style={codeStyle}>/{log.command_name}</code></td>
                      <td style={tdStyle}>{log.user_name}</td>
                      <td style={tdStyle}>
                        {log.ai_category ? <span style={tagStyle}>{log.ai_category}</span> : <span style={{ color: "#555" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.ai_summary ?? log.response}
                      </td>
                      <td style={tdStyle}><span style={statusStyle(log.status)}>{log.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p style={{ marginTop: "16px", fontSize: "12px", color: "#666" }}>Auto-refreshes every 5 seconds</p>
          </div>
        )}

        {/* ── Settings Tab ────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {selectedServer !== "all" && (
              <p style={{ fontSize: "13px", color: "#888" }}>
                Editing config for: <strong>{servers.find((s) => s.guild_id === selectedServer)?.guild_name ?? selectedServer}</strong>
              </p>
            )}
            {configs.map((config) => (
              <div key={config.command_name} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 600 }}>/{config.command_name}</h2>
                  <span style={{ padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, backgroundColor: config.enabled ? "#064e3b" : "#7f1d1d", color: config.enabled ? "#34d399" : "#fca5a5" }}>
                    {config.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <ToggleRow label="Command Enabled" description="When disabled, users see a warning." checked={config.enabled} onChange={(val) => updateConfig(config.command_name, { enabled: val })} />
                  <ToggleRow label="Mirror to Notifications" description="Send a copy to the notifications channel." checked={config.mirror_enabled} onChange={(val) => updateConfig(config.command_name, { mirror_enabled: val })} />
                  {config.command_name === "report" && (
                    <ToggleRow label="AI Triage" description="Automatically categorize and summarize reports." checked={config.ai_triage_enabled} onChange={(val) => updateConfig(config.command_name, { ai_triage_enabled: val })} />
                  )}
                  {config.command_name === "report" && (
                    <div>
                      <label style={labelStyle}>Default Severity</label>
                      <select value={config.default_severity} onChange={(e) => updateConfig(config.command_name, { default_severity: e.target.value })} style={selectStyle}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>
                      Response Template
                      {config.command_name === "status" && <span style={{ color: "#666", fontWeight: 400 }}> — use {"{user}"} and {"{time}"}</span>}
                    </label>
                    <textarea value={config.response_template ?? ""} onChange={(e) => updateConfig(config.command_name, { response_template: e.target.value || null })} placeholder="Leave empty for default" rows={3} style={textareaStyle} />
                  </div>
                </div>
                {saving && <p style={{ marginTop: "12px", fontSize: "12px", color: "#5865f2" }}>Saving...</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── Failures Tab ────────────────────────────────────────── */}
        {activeTab === "failures" && (
          <div style={cardStyle}>
            {errors.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>No failures recorded. Everything is running smoothly.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2a2b35" }}>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Error</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err) => (
                    <tr key={err.id} style={{ borderBottom: "1px solid #1f2029", opacity: err.resolved ? 0.5 : 1 }}>
                      <td style={tdStyle}>{new Date(err.created_at).toLocaleString()}</td>
                      <td style={tdStyle}><span style={errorTypeStyle}>{err.error_type}</span></td>
                      <td style={{ ...tdStyle, maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{err.error_message}</td>
                      <td style={tdStyle}>
                        <span style={err.resolved ? resolvedBadgeStyle : unresolvedBadgeStyle}>
                          {err.resolved ? "Resolved" : "Open"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {!err.resolved && (
                          <button onClick={() => resolveError(err.id)} style={resolveButtonStyle}>
                            Dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toggle Component ─────────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1f2029" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{description}</div>
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", backgroundColor: checked ? "#5865f2" : "#2a2b35", cursor: "pointer", position: "relative", transition: "background-color 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "2px", left: checked ? "22px" : "2px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = { backgroundColor: "#1a1b23", borderRadius: "12px", border: "1px solid #2a2b35", padding: "24px", overflow: "hidden" };
const tabStyle: React.CSSProperties = { padding: "8px 20px", color: "#e0e0e0", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 500 };
const logoutBtnStyle: React.CSSProperties = { padding: "8px 16px", backgroundColor: "#2a2b35", color: "#e0e0e0", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "12px 16px" };
const codeStyle: React.CSSProperties = { backgroundColor: "#2a2b35", padding: "2px 8px", borderRadius: "4px" };
const tagStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: "4px", fontSize: "12px", backgroundColor: "#1e3a5f", color: "#93c5fd" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" };
const selectStyle: React.CSSProperties = { padding: "8px 12px", backgroundColor: "#0f1117", border: "1px solid #2a2b35", borderRadius: "8px", color: "#e0e0e0", fontSize: "14px" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", backgroundColor: "#0f1117", border: "1px solid #2a2b35", borderRadius: "8px", color: "#e0e0e0", fontSize: "14px", resize: "vertical", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
const errorTypeStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: "4px", fontSize: "12px", backgroundColor: "#78350f", color: "#fbbf24" };
const resolvedBadgeStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: "4px", fontSize: "12px", backgroundColor: "#064e3b", color: "#34d399" };
const unresolvedBadgeStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: "4px", fontSize: "12px", backgroundColor: "#7f1d1d", color: "#fca5a5" };
const resolveButtonStyle: React.CSSProperties = { padding: "4px 12px", backgroundColor: "#2a2b35", color: "#e0e0e0", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" };

function statusStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    success: { bg: "#064e3b", text: "#34d399" },
    error: { bg: "#7f1d1d", text: "#fca5a5" },
    resolved: { bg: "#064e3b", text: "#34d399" },
    escalated: { bg: "#78350f", text: "#fbbf24" },
    assigned: { bg: "#1e3a5f", text: "#93c5fd" },
  };
  const c = colors[status] ?? colors.success;
  return { padding: "2px 8px", borderRadius: "4px", fontSize: "12px", backgroundColor: c.bg, color: c.text };
}