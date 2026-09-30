import { Link } from "react-router";
import { splitLinks } from "@/lib/links";

/** Text with its app paths and web addresses turned into links. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        !part.href ? (
          part.text
        ) : part.external ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-2">
            {part.text}
          </a>
        ) : (
          <Link key={i} to={part.href} className="font-semibold underline underline-offset-2">
            {part.text}
          </Link>
        ),
      )}
    </>
  );
}
