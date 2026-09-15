export type WalletAvatarTone = 'branch' | 'accent' | 'growth';

export interface WalletAvatarPixel {
  x: number;
  y: number;
  size: number;
  opacity: number;
  tone: WalletAvatarTone;
}

export interface WalletAvatarNode {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  tone: Exclude<WalletAvatarTone, 'branch'>;
}

export interface WalletAvatarAura {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

export interface WalletAvatarArt {
  version: number;
  size: number;
  background: string;
  gridSize: number;
  gridOffset: number;
  palette: Readonly<{branch: string; accent: string; growth: string}>;
  pixels: WalletAvatarPixel[];
  nodes: WalletAvatarNode[];
  auras: WalletAvatarAura[];
}

export interface WalletAvatarRaster {
  width: number;
  height: number;
  bytes: Uint8ClampedArray<ArrayBuffer>;
  art: WalletAvatarArt;
}

/** Returns deterministic, platform-neutral Pixel Blast drawing instructions. */
export declare function walletAvatar(address: string): WalletAvatarArt;

/** Rasterizes a wallet portrait to square RGBA bytes. Resolution must be 300–1024. */
export declare function walletAvatarRgba(address: string, resolution?: number): WalletAvatarRaster;
