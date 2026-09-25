import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type AppleEmojiName =
  | 'globe'
  | 'ruler'
  | 'temple'
  | 'handshake'
  | 'cross'
  | 'eagle'
  | 'moon'
  | 'bell'
  | 'calendar'
  | 'scroll'
  | 'clipboard'
  | 'members'
  | 'gear';

interface AppleEmojiProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  name: AppleEmojiName | string;
  size?: number;
  className?: string;
}

export function AppleEmoji({ name, size = 18, className, alt = '', ...props }: AppleEmojiProps) {
  const map: Record<string, string> = {
    globe: 'globe',
    '🌐': 'globe',
    ruler: 'ruler',
    '📐': 'ruler',
    temple: 'temple',
    '🏛️': 'temple',
    '🏛': 'temple',
    handshake: 'handshake',
    '🤝': 'handshake',
    cross: 'cross',
    '✝': 'cross',
    '☩': 'cross',
    eagle: 'eagle',
    '🦅': 'eagle',
    moon: 'moon',
    '🌙': 'moon',
    bell: 'bell',
    '🔔': 'bell',
    calendar: 'calendar',
    '📅': 'calendar',
    scroll: 'scroll',
    '📜': 'scroll',
    clipboard: 'clipboard',
    '📋': 'clipboard',
    members: 'members',
    '👥': 'members',
    gear: 'gear',
    '⚙️': 'gear',
    '⚙': 'gear',
  };

  const fileId = map[name] || name;
  const src = `/apple-emojis/${fileId}.png`;

  return (
    <img
      src={src}
      alt={alt || name}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={cn('inline-block object-contain select-none shrink-0 align-middle', className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      {...props}
    />
  );
}
