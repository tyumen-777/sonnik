import type { ReactNode } from 'react';

/** A titled group: the heading sits on the page, the content on a panel below it. */
export default function Section({
  title,
  aside,
  children,
  className = 'space-y-3',
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
        <h2 className="heading">{title}</h2>
        {aside}
      </div>
      <div className={`panel ${className}`}>{children}</div>
    </section>
  );
}
