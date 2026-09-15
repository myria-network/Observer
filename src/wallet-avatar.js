import { sha256 } from '@noble/hashes/sha2.js';
const SIZE = 96;
const palettes = [
    { branch: '#4168b1', accent: '#6f9bea', growth: '#acd0ff' },
    { branch: '#7043a6', accent: '#a474df', growth: '#d5b5ff' },
    { branch: '#963e7c', accent: '#cf72b3', growth: '#f8b3df' },
];
/** Deterministic full-frame Pixel Blast derived only from a public wallet address.
 * It intentionally contains no letter, central core or ownership information. */
export function walletAvatar(address) {
    if (typeof address !== 'string' || !address.trim() || address.length > 256)
        throw new TypeError('INVALID_WALLET_ADDRESS');
    let digest = sha256(new TextEncoder().encode('MYRIA|WALLET_PIXEL_BLAST|V1|' + address.trim())), cursor = 0;
    const random = () => { if (cursor === digest.length) {
        digest = sha256(digest);
        cursor = 0;
    } return digest[cursor++] / 256; };
    const palette = palettes[Math.floor(random() * palettes.length)];
    const cells = new Map();
    const put = (x, y, power) => { if (x < 0 || x >= 24 || y < 0 || y >= 24)
        return; const key = y * 24 + x; cells.set(key, Math.max(cells.get(key) ?? 0, power)); };
    // Irregular field clusters give the blast density without forming a logo core.
    const fields = Array.from({ length: 5 }, () => ({ x: 2 + random() * 20, y: 2 + random() * 20, power: .48 + random() * .28, radius: 5 + random() * 5 }));
    for (let y = 0; y < 24; y++)
        for (let x = 0; x < 24; x++) {
            let field = 0;
            for (const source of fields)
                field = Math.max(field, source.power - Math.hypot(x - source.x, y - source.y) / source.radius * .42);
            if (random() + field > .88)
                put(x, y, Math.max(.2, field));
        }
    // Edge-seeded walkers make the branching blast reach the frame naturally.
    for (let branch = 0; branch < 10; branch++) {
        const edge = branch % 4;
        let x = edge === 0 ? 0 : edge === 1 ? 23 : Math.floor(random() * 24), y = edge === 2 ? 0 : edge === 3 ? 23 : Math.floor(random() * 24);
        let dx = edge === 0 ? 1 : edge === 1 ? -1 : random() < .5 ? -1 : 1, dy = edge === 2 ? 1 : edge === 3 ? -1 : random() < .5 ? -1 : 1;
        const steps = 15 + Math.floor(random() * 18);
        for (let step = 0; step < steps; step++) {
            put(x, y, .72 + random() * .28);
            if (random() < .52)
                put(x + (dy === 0 ? (random() < .5 ? -1 : 1) : 0), y + (dx === 0 ? (random() < .5 ? -1 : 1) : 0), .4 + random() * .3);
            if (random() < .34) {
                if (random() < .5)
                    dx = Math.max(-1, Math.min(1, dx + (random() < .5 ? -1 : 1)));
                else
                    dy = Math.max(-1, Math.min(1, dy + (random() < .5 ? -1 : 1)));
            }
            if (dx === 0 && dy === 0)
                dx = edge === 1 ? -1 : 1;
            x = Math.max(0, Math.min(23, x + dx));
            y = Math.max(0, Math.min(23, y + dy));
        }
    }
    const pixels = [];
    for (const [cell, power] of [...cells].sort(([a], [b]) => a - b)) {
        const x = cell % 24, y = Math.floor(cell / 24), bright = power > .72 || random() > .78;
        const size = 2.35 + random() * 1.25;
        pixels.push({ x: Math.min(SIZE - size, x * 4 + .35 + random() * .65), y: Math.min(SIZE - size, y * 4 + .35 + random() * .65), size, opacity: .38 + random() * .5, tone: bright ? (random() > .45 ? 'growth' : 'accent') : 'branch' });
    }
    const candidates = [...pixels], nodes = [];
    for (let index = candidates.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    }
    const nodeCount = 9 + Math.floor(random() * 7);
    for (const pixel of candidates) {
        if (nodes.length >= nodeCount)
            break;
        const radius = .8 + random() * 1.35, x = Math.max(radius, Math.min(SIZE - radius, pixel.x + pixel.size / 2)), y = Math.max(radius, Math.min(SIZE - radius, pixel.y + pixel.size / 2));
        if (nodes.every(node => Math.hypot(node.x - x, node.y - y) > 8))
            nodes.push({ x, y, radius, opacity: .5 + random() * .4, tone: random() > .35 ? 'growth' : 'accent' });
    }
    const auras = Array.from({ length: 3 }, () => ({ x: random() * SIZE, y: random() * SIZE, radius: 22 + random() * 30, opacity: .035 + random() * .045 }));
    return { version: 9, size: SIZE, background: '#101426', gridSize: 8 + Math.floor(random() * 5), gridOffset: Math.floor(random() * 8), palette, pixels, nodes, auras };
}
function rgb(value) { return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)]; }
function blend(bytes, width, x, y, color, alpha) {
    if (x < 0 || x >= width || y < 0 || y >= width || alpha <= 0)
        return;
    const at = (y * width + x) * 4, a = Math.min(1, alpha), inv = 1 - a;
    bytes[at] = Math.round(bytes[at] * inv + color[0] * a);
    bytes[at + 1] = Math.round(bytes[at + 1] * inv + color[1] * a);
    bytes[at + 2] = Math.round(bytes[at + 2] * inv + color[2] * a);
    bytes[at + 3] = 255;
}
/** Platform-neutral rasterizer for community interfaces and rendering tools. */
export function walletAvatarRgba(address, resolution = 384) {
    if (!Number.isInteger(resolution) || resolution < 300 || resolution > 1024)
        throw new TypeError('INVALID_WALLET_AVATAR_SIZE');
    const art = walletAvatar(address), bytes = new Uint8ClampedArray(resolution * resolution * 4), background = rgb(art.background), scale = resolution / art.size;
    for (let at = 0; at < bytes.length; at += 4) {
        bytes[at] = background[0];
        bytes[at + 1] = background[1];
        bytes[at + 2] = background[2];
        bytes[at + 3] = 255;
    }
    for (const aura of art.auras) {
        const color = rgb(art.palette.branch), cx = aura.x * scale, cy = aura.y * scale, radius = aura.radius * scale;
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(resolution, Math.ceil(cy + radius)); y++)
            for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(resolution, Math.ceil(cx + radius)); x++) {
                const fade = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / radius);
                blend(bytes, resolution, x, y, color, aura.opacity * fade * fade);
            }
    }
    const grid = rgb(art.palette.accent), gridSize = art.gridSize * scale, gridOffset = art.gridOffset * scale;
    for (let line = gridOffset; line < resolution; line += gridSize) {
        const p = Math.round(line);
        for (let i = 0; i < resolution; i++) {
            blend(bytes, resolution, p, i, grid, .045);
            blend(bytes, resolution, i, p, grid, .045);
        }
    }
    for (const pixel of art.pixels) {
        const color = rgb(art.palette[pixel.tone]), left = Math.floor(pixel.x * scale), top = Math.floor(pixel.y * scale), side = Math.max(2, Math.round(pixel.size * scale));
        for (let y = top; y < top + side; y++)
            for (let x = left; x < left + side; x++)
                blend(bytes, resolution, x, y, color, pixel.opacity);
    }
    for (const node of art.nodes) {
        const color = rgb(art.palette[node.tone]), cx = node.x * scale, cy = node.y * scale, radius = node.radius * scale, outer = radius + scale * .65;
        for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++)
            for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
                const d = Math.hypot(x + .5 - cx, y + .5 - cy), edge = Math.max(0, Math.min(1, outer - d));
                if (d <= outer)
                    blend(bytes, resolution, x, y, color, node.opacity * edge * (d <= radius ? 1 : .28));
            }
    }
    return { width: resolution, height: resolution, bytes, art };
}
