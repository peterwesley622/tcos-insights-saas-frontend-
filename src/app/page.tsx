import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">
          TCOS Insights
        </h1>
        <p className="mb-8 text-lg text-slate-600">
          Automated weekly performance reports for trade contractors.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
