export const formatWinRate = (value: string): string => value.replace(/^0/, '');

export const formatGamesBehind = (value: string): string => (value === '0' ? '-' : value);
