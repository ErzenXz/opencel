import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-center">
      <h1 className="text-[120px] font-bold leading-none text-[#333]">404</h1>
      <div className="mt-4 space-y-2">
        <h2 className="text-xl font-semibold text-white">
          This page could not be found.
        </h2>
        <p className="text-sm text-[#888]">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/projects"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="rounded-md border border-[#333] px-4 py-2 text-sm text-[#888] transition-colors hover:border-[#555] hover:text-white"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
