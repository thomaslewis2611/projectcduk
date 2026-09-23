import type { ReactNode } from "react";

/** Forest band at the top of inner pages: eyebrow, light headline, intro. */
export default function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="band border-b border-lime/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="frame px-6 sm:px-10 py-12 sm:py-16">
          <p className="text-sm text-lime/75 mb-3">{eyebrow}</p>
          <h1 className="display text-4xl sm:text-5xl text-lime max-w-3xl">{title}</h1>
          {children && <div className="mt-4 max-w-2xl text-lime/75 text-base">{children}</div>}
        </div>
      </div>
    </section>
  );
}
