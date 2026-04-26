import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "#f8fafc",
      }}
    >
      <div style={{ maxWidth: "42rem", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: "1rem",
          }}
        >
          TCOS Insights
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "#475569",
            marginBottom: "2rem",
          }}
        >
          Automated weekly performance reports for trade contractors.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.375rem",
            fontWeight: 600,
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
