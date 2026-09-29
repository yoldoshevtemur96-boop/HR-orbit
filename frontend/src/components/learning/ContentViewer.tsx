'use client';

import { useRef } from 'react';
import { resolveFileUrl } from '@/lib/api';
import type { LearningMaterialDetail } from '@/types/learning';

// YouTube/Vimeo havolasini iframe uchun embed manzilga aylantiradi
function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

// Platforma ichida ko'rsatish (displayMode = EMBED): PDF, video, audio, rasm,
// YouTube/Vimeo. Video/audio'da progress 10% qadam bilan, tugaganda — onFinished.
export function ContentViewer({
  material,
  currentProgress,
  onProgress,
  onFinished,
}: {
  material: LearningMaterialDetail;
  currentProgress: number;
  onProgress: (percent: number) => void;
  onFinished: () => void;
}) {
  const lastReported = useRef(currentProgress);
  const src = resolveFileUrl(material.contentUrl);
  if (!src) return null;

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLMediaElement>) {
    const el = e.currentTarget;
    if (!el.duration || !Number.isFinite(el.duration)) return;
    const percent = Math.floor((el.currentTime / el.duration) * 100);
    // Faqat oldinga, har 10% da bir marta — serverni ortiqcha yuklamaslik uchun
    const bucket = Math.floor(percent / 10) * 10;
    if (bucket > lastReported.current && bucket < 100) {
      lastReported.current = bucket;
      onProgress(bucket);
    }
  }

  const mime = material.contentFile?.mimeType ?? '';
  const frame = 'w-full rounded-xl border border-stone-200 bg-black/5';

  if (material.contentSource === 'LINK') {
    const embed = toEmbedUrl(src);
    if (!embed) return null;
    return (
      <iframe
        src={embed}
        title={material.title}
        className={`${frame} aspect-video`}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  if (mime === 'application/pdf') {
    return <iframe src={src} title={material.title} className={`${frame} h-[75vh] bg-white`} />;
  }
  if (mime.startsWith('video/')) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={src}
        controls
        controlsList={material.allowDownload ? undefined : 'nodownload'}
        className={`${frame} max-h-[75vh] bg-black`}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onFinished}
      />
    );
  }
  if (mime.startsWith('audio/')) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio
        src={src}
        controls
        controlsList={material.allowDownload ? undefined : 'nodownload'}
        className="w-full"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onFinished}
      />
    );
  }
  if (mime.startsWith('image/')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={material.title} className={`${frame} object-contain`} />;
  }
  return null;
}

export function canEmbedContent(material: LearningMaterialDetail) {
  if (material.displayMode !== 'EMBED' || !material.contentUrl) return false;
  if (material.contentSource === 'LINK') return toEmbedUrl(material.contentUrl) !== null;
  const mime = material.contentFile?.mimeType ?? '';
  return mime === 'application/pdf' || mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('image/');
}
