/**
 * Formats large numbers into standard finance suffix scales (K, M, B, T, Qa)
 * as described in section 5.2 & 6.1 of the design spec.
 */
export function formatCurrency(amount: number): string {
  if (amount < 0) {
    return '-' + formatCurrency(Math.abs(amount));
  }
  if (amount < 1_000) {
    return `¥${Math.floor(amount).toLocaleString('ja-JP')}`;
  }
  if (amount < 1_000_000) {
    return `¥${(amount / 1_000).toFixed(2)}K`;
  }
  if (amount < 1_000_000_000) {
    return `¥${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount < 1_000_000_000_000) {
    return `¥${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount < 1_000_000_000_000_000) {
    return `¥${(amount / 1_000_000_000_000).toFixed(2)}T`;
  }
  return `¥${(amount / 1_000_000_000_000_000).toFixed(2)}Qa`;
}

export function formatNumber(amount: number): string {
  if (amount < 0) {
    return '-' + formatNumber(Math.abs(amount));
  }
  if (amount < 1_000) {
    return `${Math.floor(amount)}`;
  }
  if (amount < 1_000_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  if (amount < 1_000_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount < 1_000_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount < 1_000_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toFixed(2)}T`;
  }
  return `${(amount / 1_000_000_000_000_000).toFixed(2)}Qa`;
}

/**
 * Calculates gauge displacement velocity dG/dt based on the spec formula:
 * dG/dt = - [ alpha * (A_play - A_opp) / P_market + beta * sgn(diff) * ln(1 + |diff|/P_market) ] * Phi_skill
 */
export function calculateGaugeVelocity(
  A_play: number,
  A_opp: number,
  P_market: number,
  Phi_skill: number = 1.0
): number {
  const alpha = 0.6; // Controlled linear scaling for standard tug-of-war
  const beta = 0.4;  // Logarithmic weight for relative capital advantage
  const diff = A_play - A_opp;
  const sgn = diff > 0 ? 1 : diff < 0 ? -1 : 0;
  const absRatio = Math.abs(diff) / Math.max(P_market, 1);

  const linearTerm = alpha * (diff / Math.max(P_market, 1));
  const logTerm = beta * sgn * Math.log(1 + absRatio);

  // Negative means moving towards -100 (Player Victory)
  const dG_dt = -(linearTerm + logTerm) * Phi_skill;
  return dG_dt;
}

/**
 * Independence / Rebellion Probability calculation formula:
 * P_rebellion = 1 / (1 + e^-(lambda * (L_risk - delta)))
 * lambda = 0.1, delta = 60
 */
export function calculateRebellionProbability(L_risk: number): number {
  if (L_risk <= 10) return 0.0;
  const lambda = 0.1;
  const delta = 60;
  return 1 / (1 + Math.exp(-lambda * (L_risk - delta)));
}

/**
 * Returns UI color & status label for Loyalty Risk (L_risk in [0, 100])
 * Safe: 0-39 (Blue/Green)
 * Caution: 40-79 (Yellow)
 * Danger: 80-100 (Red)
 */
export function getLoyaltyRiskStatus(L_risk: number): {
  state: 'Safe' | 'Caution' | 'Danger';
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} {
  if (L_risk < 40) {
    return {
      state: 'Safe',
      label: '安全 (Safe)',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-500/30',
    };
  }
  if (L_risk < 80) {
    return {
      state: 'Caution',
      label: '警告 (Caution)',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-500/30',
    };
  }
  return {
    state: 'Danger',
    label: '危機 (Danger)',
    textColor: 'text-rose-400 font-bold animate-pulse',
    bgColor: 'bg-rose-950/50',
    borderColor: 'border-rose-500/50',
  };
}
