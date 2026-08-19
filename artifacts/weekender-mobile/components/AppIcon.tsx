import React from 'react';
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';

export const appIconNames = [
  'activity',
  'alert-circle',
  'arrow-up-right',
  'beer',
  'bottle-soda',
  'chevron-right',
  'coffee',
  'compass',
  'crosshair',
  'cup',
  'external-link',
  'glass-cocktail',
  'glass-wine',
  'heart',
  'home',
  'info',
  'liquor',
  'loader',
  'map-pin',
  'moon',
  'navigation',
  'plus',
  'radio',
  'rotate-cw',
  'settings',
  'shield',
  'star',
  'trash-2',
  'trending-up',
  'user',
  'users',
  'wifi-off',
  'x',
  'zap',
] as const;

export type AppIconName = (typeof appIconNames)[number];

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color: string;
};

function IconPath({ name }: Pick<AppIconProps, 'name'>) {
  switch (name) {
    case 'home':
      return <><Path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><Polyline points="9 22 9 13 15 13 15 22" /></>;
    case 'map-pin':
      return <><Path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z" /><Circle cx="12" cy="10" r="2.5" /></>;
    case 'navigation':
      return <><Path d="m4 20 7.6-16.2a.45.45 0 0 1 .8 0L20 20a.45.45 0 0 1-.57.61L12 18l-7.43 2.61A.45.45 0 0 1 4 20Z" /><Path d="m12 18-.4-14.2" /></>;
    case 'compass':
      return <><Circle cx="12" cy="12" r="9" /><Path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5Z" /></>;
    case 'crosshair':
      return <><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>;
    case 'heart':
      return <Path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.5l8.9-8.9a5.5 5.5 0 0 0-.1-7.8Z" />;
    case 'user':
      return <><Circle cx="12" cy="7" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>;
    case 'users':
      return <><Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>;
    case 'coffee':
      return <><Path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><Path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M7 3v3M11 3v3M15 3v3" /></>;
    case 'cup':
      return <><Path d="M5 5h14l-1 14H6Z" /><Path d="M8 5v-2M16 5v-2M4 21h16" /></>;
    case 'glass-cocktail':
      return <><Path d="M5 3h14l-7 8Z" /><Path d="M12 11v7M8 21h8M9 18h6" /></>;
    case 'glass-wine':
      return <><Path d="M6 3h12v5a6 6 0 0 1-12 0Z" /><Path d="M12 14v6M8 21h8" /></>;
    case 'beer':
      return <><Path d="M6 5h10v14H6Z" /><Path d="M16 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 8h10" /><Path d="M8 3v2M11 3v2M14 3v2" /></>;
    case 'bottle-soda':
      return <><Path d="M9 3h6M10 3v3l-2 2v12h8V8l-2-2V3" /><Path d="M8 10h8M8 15h8" /></>;
    case 'liquor':
      return <><Path d="M9 3h6M10 3v4l-2 3v10h8V10l-2-3V3" /><Path d="M8 11h8M10 15h4" /></>;
    case 'moon':
      return <Path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 9 9 0 1 0 20.5 15.2Z" />;
    case 'activity':
      return <Polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />;
    case 'trending-up':
      return <><Polyline points="3 17 9 11 13 15 21 7" /><Polyline points="15 7 21 7 21 13" /></>;
    case 'zap':
      return <Path d="m13 2-9 12h7l-1 8 9-12h-7Z" />;
    case 'chevron-right':
      return <Polyline points="9 18 15 12 9 6" />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" />;
    case 'star':
      return <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />;
    case 'shield':
      return <Path d="M12 3 20 6.5V12c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6.5Z" />;
    case 'wifi-off':
      return <><Path d="M3 9a14 14 0 0 1 17.5 1M5.5 13a9 9 0 0 1 9.8 1.2M8.8 17a4.5 4.5 0 0 1 3.2.5" /><Path d="m3 3 18 18" /><Circle cx="12" cy="21" r="1" /></>;
    case 'settings':
      return <><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L8.7 5.9l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>;
    case 'info':
    case 'alert-circle':
      return <><Circle cx="12" cy="12" r="9" /><Path d="M12 11v5M12 8h.01" /></>;
    case 'trash-2':
      return <><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>;
    case 'external-link':
    case 'arrow-up-right':
      return <><Path d="M7 17 17 7M10 7h7v7" /><Path d="M17 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6" /></>;
    case 'radio':
      return <><Circle cx="12" cy="12" r="2" /><Path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></>;
    case 'rotate-cw':
      return <><Path d="M20 11a8 8 0 1 0 1 4.2" /><Polyline points="20 4 20 11 13 11" /></>;
    case 'loader':
      return <Circle cx="12" cy="12" r="8" strokeDasharray="4 4" />;
    case 'x':
      return <Path d="M6 6l12 12M18 6 6 18" />;
    default:
      return null;
  }
}

export function AppIcon({ name, size = 24, color }: AppIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <IconPath name={name} />
      </G>
    </Svg>
  );
}