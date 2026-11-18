export default function Avatar({ name, photo, className = "feed-initials" }: {
  name: string; photo?: string; className?: string;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => [...part][0]).join("").toUpperCase();
  return photo ? <img className={className + " avatar-image"} src={photo} alt={`Fotografia de ${name}`} />
    : <span className={className} aria-hidden="true">{initials}</span>;
}
