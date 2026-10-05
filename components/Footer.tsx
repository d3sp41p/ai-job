import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-rule mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid gap-6 md:grid-cols-[1fr_auto] text-sm">
        <p className="max-w-prose text-inksoft">
          This is a meme project, not an investment product. Nothing here is a promise of income.
          Salaries come only from creator fees in the pool and can be zero. Do your own research
          and never spend more than you can afford to lose.
        </p>
        <div className="flex gap-4 md:justify-end">
          <Link href="/dashboard/" className="underline underline-offset-4">Payroll</Link>
          <a href="#" className="underline underline-offset-4">X</a>
        </div>
      </div>
    </footer>
  );
}
