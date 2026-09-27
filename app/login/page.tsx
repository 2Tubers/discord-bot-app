"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0f1117",
      color: "#e0e0e0",
      fontFamily: "system-ui, sans-serif",
    }}>
      <form onSubmit={handleLogin} style={{
        width: "100%",
        maxWidth: "360px",
        padding: "40px",
        backgroundColor: "#1a1b23",
        borderRadius: "12px",
        border: "1px solid #2a2b35",
      }}>
        <h1 style={{ fontSize: "24px", marginBottom: "24px", fontWeight: 600 }}>
          Admin Login
        </h1>

        {error && (
          <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>
            {error}
          </p>
        )}

        <label style={{ display: "block", fontSize: "14px", marginBottom: "6px" }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: "16px",
            backgroundColor: "#0f1117",
            border: "1px solid #2a2b35",
            borderRadius: "8px",
            color: "#e0e0e0",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", fontSize: "14px", marginBottom: "6px" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: "24px",
            backgroundColor: "#0f1117",
            border: "1px solid #2a2b35",
            borderRadius: "8px",
            color: "#e0e0e0",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#5865f2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}