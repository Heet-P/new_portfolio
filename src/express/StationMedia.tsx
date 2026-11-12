import type { Media } from "@/content/route";
import styles from "./express.module.css";

/**
 * Media slot for a station (demo video + photos).
 * Until files arrive in media-inbox/ every station has `media: undefined`, so this
 * renders nothing and the card stays stats + links only. Task 11 adds the Skiper67
 * video player here; for now photos (if any) render as plain lazy-loaded images.
 */
export function StationMedia({ media }: { media?: Media }) {
  if (!media?.photos?.length) return null;

  return (
    <div className={styles.media}>
      {media.photos.map((photo) => (
        // Plain <img>: static export serves files as-is, and below-the-fold images lazy-load.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={photo.src}
          src={photo.src}
          alt={photo.alt}
          width={photo.w}
          height={photo.h}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}
