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

// Keep the seeded JOB_ART order stable, and expose semantic job names separately.
// Some of the original local filenames predate their current artwork, so callers
// should use these named entries instead of relying on those filenames.
const JOB_ART_BY_JOB = {
  paladin: JOB_ART[0],
  warrior: JOB_ART[1],
  darkKnight: JOB_ART[2],
  gunbreaker: JOB_ART[3],
  monk: JOB_ART[4],
  samurai: JOB_ART[5],
  dragoon: JOB_ART[6],
  reaper: JOB_ART[7],
  ninja: JOB_ART[8],
  viper: JOB_ART[9],
  bard: JOB_ART[10],
  machinist: JOB_ART[11],
  whiteMage: publicAsset('ff14-fankit/job-whitemage.png'),
  astrologian: publicAsset('ff14-fankit/job-astrologian.png'),
} as const;

const COMMERCE_ICONS = [
  publicAsset('ff14-fankit/icon-goldsmith.png'),
  publicAsset('ff14-fankit/icon-weaver.png'),
  publicAsset('ff14-fankit/icon-culinarian.png'),
  publicAsset('ff14-fankit/icon-botanist.png'),
] as const;

const TRAINING_DUMMY_ART = [
  publicAsset('ff14-fankit/training-cactuar-1.png'),
  publicAsset('ff14-fankit/training-cactuar-2.png'),
  publicAsset('ff14-fankit/training-cactuar-3.png'),
  publicAsset('ff14-fankit/training-cactuar-4.png'),
  publicAsset('ff14-fankit/training-cactuar-5.png'),
] as const;

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

export const getFankitJobArt = (seed: string) => JOB_ART[hashText(seed) % JOB_ART.length];
export const getFankitJobPartyArt = (seed: string, requestedCount: number) => {
  const count = Math.max(1, Math.min(3, Math.floor(requestedCount)));
  const firstIndex = hashText(seed) % JOB_ART.length;
  // Five is coprime to the twelve-art set, so the first three entries are
  // always distinct without retries, random state or extra runtime work.
  return Array.from(
    { length: count },
    (_, index) => JOB_ART[(firstIndex + index * 5) % JOB_ART.length]
  );
};
export const getFankitCommerceIcon = (seed: string) => COMMERCE_ICONS[hashText(seed) % COMMERCE_ICONS.length];
export const getFankitTrainingDummyArt = (level: number) =>
  TRAINING_DUMMY_ART[
    Math.min(TRAINING_DUMMY_ART.length - 1, Math.max(0, level - 1))
  ];

export const FANKIT_ART = {
  titleHero: publicAsset('title-hero-v1.webp'),
  jobs: JOB_ART,
  jobsByJob: JOB_ART_BY_JOB,
  commerceIcons: COMMERCE_ICONS,
  trainingDummies: TRAINING_DUMMY_ART,
  ...JOB_ART_BY_JOB,
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
