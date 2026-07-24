const JOB_ART = [
  '/ff14-fankit/job-paladin.png',
  '/ff14-fankit/job-darkknight.png',
  '/ff14-fankit/job-blackmage.png',
  '/ff14-fankit/job-04.png',
  '/ff14-fankit/job-05.png',
  '/ff14-fankit/job-06.png',
  '/ff14-fankit/job-07.png',
  '/ff14-fankit/job-08.png',
  '/ff14-fankit/job-09.png',
  '/ff14-fankit/job-10.png',
  '/ff14-fankit/job-11.png',
  '/ff14-fankit/job-12.png',
] as const;

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

export const getFankitJobArt = (seed: string) => JOB_ART[hashText(seed) % JOB_ART.length];

export const FANKIT_ART = {
  marketBackdrop: '/ff14-fankit/dawntrail-fankit.jpg',
  battleBackdrop: '/ff14-fankit/stormblood-fankit.jpg',
  jobs: JOB_ART,
} as const;
