interface ProjectMarkProps {
  size?: number;
}

export function ProjectMark({ size = 36 }: ProjectMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className="project-mark"
      height={size}
      viewBox="0 0 48 48"
      width={size}
    >
      <path d="M7 32 24 6l17 26-17 10L7 32Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="m14 31 10-15 10 15-10 6-10-6Z" fill="currentColor" opacity=".22" />
      <path d="M24 16v21" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
