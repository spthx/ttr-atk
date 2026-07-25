const PUBLIC_ASSET_BASE = (import.meta.env.VITE_PUBLIC_BASE || '/').replace(/\/?$/, '/');
const publicAsset = (path: string) => `${PUBLIC_ASSET_BASE}${path.replace(/^\/+/, '')}`;

const JOB_ART = [
  publicAsset('ff14-fankit/job-paladin.png'),
  publicAsset('ff14-fankit/job-darkknight.png'),
  publicAsset('ff14-fankit/job-blackmage.png'),
  publicAsset('ff14-fankit/job-04.png'),
  publicAsset('ff14-fankit/job-05.png'),
  publicAsset('ff14-fankit/job-06.png'),
  publicAsset('ff14-fankit/job-07.png'),
  publicAsset('ff14-fankit/job-08.png'),
  publicAsset('ff14-fankit/job-09.png'),
  publicAsset('ff14-fankit/job-10.png'),
  publicAsset('ff14-fankit/job-11.png'),
  publicAsset('ff14-fankit/job-12.png'),
] as const;

const COMMERCE_ICONS = [
  publicAsset('ff14-fankit/icon-goldsmith.png'),
  publicAsset('ff14-fankit/icon-weaver.png'),
  publicAsset('ff14-fankit/icon-culinarian.png'),
  publicAsset('ff14-fankit/icon-botanist.png'),
] as const;

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

export const getFankitJobArt = (seed: string) => JOB_ART[hashText(seed) % JOB_ART.length];
export const getFankitCommerceIcon = (seed: string) => COMMERCE_ICONS[hashText(seed) % COMMERCE_ICONS.length];

export const FANKIT_ART = {
  titleHero: publicAsset('title-hero-v1.png'),
  marketBackdrop: publicAsset('ff14-fankit/dawntrail-fankit.jpg'),
  launchWallpaperMobile: publicAsset('ff14-fankit/launch-wallpaper-mobile.jpg'),
  battleBackdrop: publicAsset('ff14-fankit/stormblood-fankit.jpg'),
  jobs: JOB_ART,
  commerceIcons: COMMERCE_ICONS,
  tataru: {
    dressUp: publicAsset('ff14-fankit/minion-dress-up-tataru.png'),
    windUp: publicAsset('ff14-fankit/minion-wind-up-tataru.png'),
  },
} as const;
export const FANKIT_AUDIO = {
  dutyStart: publicAsset('ff14-fankit/audio/FFXIV_Enter_Instance.mp3'),
  featureUnlocked: publicAsset('ff14-fankit/audio/FFXIV_Feature_Unlocked.mp3'),
  limitBreak: publicAsset('ff14-fankit/audio/FFXIV_Limit_Break_Activated.mp3'),
  victory: publicAsset('ff14-fankit/audio/FFXIV_FATE01_Complete.mp3'),
  defeat: publicAsset('ff14-fankit/audio/FFXIV_Instance_Failed.mp3'),
} as const;