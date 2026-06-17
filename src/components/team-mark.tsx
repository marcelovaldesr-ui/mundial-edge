import type { Team } from "@/lib/types";

export function TeamMark({ team, className = "" }: { team?: Team | null; className?: string }) {
  const flag = team?.flag;
  if (!flag) return <span className={"inline-block h-5 w-5 rounded-full bg-muted " + className} aria-hidden="true" />;

  if (/^https?:\/\//.test(flag)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={flag}
        alt=""
        className={"inline-block h-5 w-5 rounded-full object-contain " + className}
        loading="lazy"
      />
    );
  }

  return <span className={"inline-block text-lg leading-none " + className}>{flag}</span>;
}
