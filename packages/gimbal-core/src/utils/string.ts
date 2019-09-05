export const pad = (amount: number, character = ' '): string => new Array(amount).fill(character).join('');
export const splitOnWhitespace = (str: string): string[] => str.trim().split(/\s+/);
