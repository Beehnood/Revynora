import Image from "next/image";
import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Revynora — accueil">
      <Image src="/brand/logo-mark.svg" width={44} height={44} alt="" />
      <span>
        Revynora{!compact && <small>Learn smarter. Remember longer.</small>}
      </span>
    </Link>
  );
}
