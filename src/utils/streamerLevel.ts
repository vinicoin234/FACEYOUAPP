export interface StreamerLevelInfo {
  level: number;
  title: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  currentLevelProgressXp: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
  icon: string;
  perks: string[];
}

export const XP_PER_COIN = 10;
export const XP_PER_STREAM_MINUTE = 5;

// Milestone level thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, title: 'Rookie Streamer', badgeColor: '#a3a3a3', badgeBg: 'bg-neutral-800', borderColor: 'border-neutral-700', icon: '🌱', perks: ['Standard live broadcast quality', 'Visible in general feed'] },
  { level: 2, xp: 250, title: 'Rising Broadcaster', badgeColor: '#38bdf8', badgeBg: 'bg-sky-950/60', borderColor: 'border-sky-500/40', icon: '⚡', perks: ['Feed discovery boost (+10%)', 'Rising creator badge'] },
  { level: 3, xp: 650, title: 'Bronze Host', badgeColor: '#f97316', badgeBg: 'bg-amber-950/60', borderColor: 'border-orange-500/40', icon: '🥉', perks: ['Custom stream reaction burst', 'Featured in trending tray'] },
  { level: 4, xp: 1300, title: 'Silver Creator', badgeColor: '#e2e8f0', badgeBg: 'bg-slate-900', borderColor: 'border-slate-400/40', icon: '🥈', perks: ['Prioritized live stream ranking', 'Animated stream border'] },
  { level: 5, xp: 2200, title: 'Gold Streamer', badgeColor: '#eab308', badgeBg: 'bg-amber-950/80', borderColor: 'border-amber-400/50', icon: '🥇', perks: ['Top of Feed placement guarantee', 'VIP creator glow in chats'] },
  { level: 6, xp: 3500, title: 'Platinum Host', badgeColor: '#2dd4bf', badgeBg: 'bg-teal-950/80', borderColor: 'border-teal-400/50', icon: '💎', perks: ['Exclusive gift multiplier multiplier', 'Fast-track OPay payouts'] },
  { level: 7, xp: 5200, title: 'Diamond Star', badgeColor: '#00f2fe', badgeBg: 'bg-cyan-950/80', borderColor: 'border-cyan-400/60', icon: '✨', perks: ['Top spotlight on Feed page', 'Diamond streamer verification'] },
  { level: 8, xp: 7500, title: 'Elite Master', badgeColor: '#a855f7', badgeBg: 'bg-purple-950/80', borderColor: 'border-purple-400/60', icon: '🔮', perks: ['Hype booster 1.5x multiplier', 'FaceYou home banner placement'] },
  { level: 9, xp: 10500, title: 'Grandmaster Creator', badgeColor: '#ff0050', badgeBg: 'bg-rose-950/80', borderColor: 'border-rose-500/60', icon: '👑', perks: ['Permanent hero feature', 'Exclusive creator trophy'] },
  { level: 10, xp: 15000, title: 'Legendary Icon', badgeColor: '#ffd700', badgeBg: 'bg-gradient-to-r from-amber-950 to-rose-950', borderColor: 'border-amber-400', icon: '🌟', perks: ['Apex creator status', 'Global broadcast syndication'] },
];

/**
 * Calculates total Streamer XP:
 * - 1 coin received from viewer gifts = 10 XP
 * - 1 minute of streaming = 5 XP
 */
export function calculateStreamerXp(coinsEarnedFromGifts: number, totalStreamSeconds: number): number {
  const coinXp = Math.max(0, coinsEarnedFromGifts) * XP_PER_COIN;
  const minutes = Math.floor(Math.max(0, totalStreamSeconds) / 60);
  const durationXp = minutes * XP_PER_STREAM_MINUTE;
  return coinXp + durationXp;
}

/**
 * Computes streamer level, current progress, and next level goals
 */
export function getStreamerLevelInfo(totalXp: number): StreamerLevelInfo {
  const xp = Math.max(0, totalXp);

  let currentTier = LEVEL_THRESHOLDS[0];
  let nextTier = LEVEL_THRESHOLDS[1];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      currentTier = LEVEL_THRESHOLDS[i];
      nextTier = LEVEL_THRESHOLDS[i + 1] || null;
      break;
    }
  }

  if (!nextTier) {
    // Max level achieved
    return {
      level: currentTier.level,
      title: currentTier.title,
      badgeColor: currentTier.badgeColor,
      badgeBg: currentTier.badgeBg,
      borderColor: currentTier.borderColor,
      currentLevelBaseXp: currentTier.xp,
      nextLevelXp: currentTier.xp,
      currentLevelProgressXp: xp - currentTier.xp,
      xpNeededForNextLevel: 0,
      progressPercent: 100,
      icon: currentTier.icon,
      perks: currentTier.perks,
    };
  }

  const range = nextTier.xp - currentTier.xp;
  const progressInLevel = xp - currentTier.xp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((progressInLevel / range) * 100)));
  const xpNeeded = nextTier.xp - xp;

  return {
    level: currentTier.level,
    title: currentTier.title,
    badgeColor: currentTier.badgeColor,
    badgeBg: currentTier.badgeBg,
    borderColor: currentTier.borderColor,
    currentLevelBaseXp: currentTier.xp,
    nextLevelXp: nextTier.xp,
    currentLevelProgressXp: progressInLevel,
    xpNeededForNextLevel: xpNeeded,
    progressPercent,
    icon: currentTier.icon,
    perks: currentTier.perks,
  };
}
