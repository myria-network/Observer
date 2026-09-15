import { sha256 } from '@noble/hashes/sha2.js';
const SIZE = 96;
const palettes = [
    { branch: '#4168b1', accent: '#6f9bea', growth: '#acd0ff' },
    { branch: '#7043a6', accent: '#a474df', growth: '#d5b5ff' },
    { branch: '#963e7c', accent: '#cf72b3', growth: '#f8b3df' },
    { branch: '#187a83', accent: '#43a6aa', growth: '#9bd9d3' },
    { branch: '#32735c', accent: '#60a77e', growth: '#b1dab9' },
    { branch: '#9b5d35', accent: '#d18b54', growth: '#f1c698' },
    { branch: '#9a4147', accent: '#d36c6f', growth: '#f3ada5' },
    { branch: '#486392', accent: '#778ab8', growth: '#c0c9e5' },
];
const compositions = ['islands', 'stream', 'canopy', 'forks', 'rift'];
/** Deterministic Pixel Blast derived only from a public wallet address.
 * It intentionally contains no letter, central core or ownership information. */
export function walletAvatar(address) {
    if (typeof address !== 'string' || !address.trim() || address.length > 256)
        throw new TypeError('INVALID_WALLET_ADDRESS');
    let digest = sha256(new TextEncoder().encode('MYRIA|WALLET_PIXEL_BLAST|V2|' + address.trim())), cursor = 0;
    const random = () => { if (cursor === digest.length) {
        digest = sha256(digest);
        cursor = 0;
    } return digest[cursor++] / 256; };
    const palette = palettes[Math.floor(random() * palettes.length)];
    const composition = compositions[Math.floor(random() * compositions.length)];
    const density = .3 + random() * .44, reach = random(), turnRate = .18 + random() * .42;
    const cells = new Map();
    const put = (x, y, power) => { if (x < 0 || x >= 24 || y < 0 || y >= 24)
        return; const key = y * 24 + x; cells.set(key, Math.max(cells.get(key) ?? 0, power)); };
    const anchors = [];
    const addField = (centerX, centerY, radiusX, radiusY, power, angle) => {
        anchors.push({ x: centerX, y: centerY, radius: Math.max(radiusX, radiusY) });
        const cosine = Math.cos(angle), sine = Math.sin(angle);
        for (let y = 0; y < 24; y++)
            for (let x = 0; x < 24; x++) {
                const offsetX = x - centerX, offsetY = y - centerY, rotatedX = offsetX * cosine - offsetY * sine, rotatedY = offsetX * sine + offsetY * cosine;
                const distance = Math.hypot(rotatedX / radiusX, rotatedY / radiusY), field = power - distance * .48;
                if (field > 0 && random() + field > 1.08 - density * .24)
                    put(x, y, .26 + field * .72);
            }
    };
    if (composition === 'islands') {
        const count = 2 + Math.floor(random() * 4);
        for (let index = 0; index < count; index++)
            addField(3 + random() * 18, 3 + random() * 18, 2.8 + random() * 4.8, 2.4 + random() * 4.2, .48 + random() * .34, random() * Math.PI);
    }
    else if (composition === 'stream') {
        const angle = random() * Math.PI, startX = 4 + random() * 16, startY = 4 + random() * 16, count = 3 + Math.floor(random() * 3);
        for (let index = 0; index < count; index++) {
            const offset = index - (count - 1) / 2;
            addField(startX + Math.cos(angle) * offset * 4.2, startY + Math.sin(angle) * offset * 4.2, 5.5 + random() * 3, 1.8 + random() * 2, .5 + random() * .28, angle);
        }
    }
    else if (composition === 'canopy') {
        const upper = random() < .5, baseY = upper ? 3 + random() * 5 : 16 + random() * 5;
        addField(5 + random() * 14, baseY, 9 + random() * 5, 2.8 + random() * 3, .58 + random() * .28, random() * .35 - .175);
        if (random() > .35)
            addField(4 + random() * 16, upper ? 10 + random() * 5 : 8 + random() * 5, 4 + random() * 5, 3 + random() * 4, .42 + random() * .25, random() * Math.PI);
    }
    else if (composition === 'forks') {
        addField(4 + random() * 16, 4 + random() * 16, 3.5 + random() * 4, 3.5 + random() * 4, .56 + random() * .3, random() * Math.PI);
    }
    else {
        const vertical = random() < .5;
        addField(vertical ? 4 + random() * 5 : 4 + random() * 16, vertical ? 4 + random() * 16 : 4 + random() * 5, 3 + random() * 3, 5 + random() * 5, .5 + random() * .3, random() * Math.PI);
        addField(vertical ? 15 + random() * 5 : 4 + random() * 16, vertical ? 4 + random() * 16 : 15 + random() * 5, 3 + random() * 3, 5 + random() * 5, .5 + random() * .3, random() * Math.PI);
    }
    const branchCount = 2 + Math.floor(density * 7), primaryAngle = random() * Math.PI * 2;
    for (let branch = 0; branch < branchCount; branch++) {
        const anchor = anchors[Math.floor(random() * anchors.length)];
        let x = Math.round(anchor.x + (random() - .5) * anchor.radius), y = Math.round(anchor.y + (random() - .5) * anchor.radius);
        let angle = composition === 'stream' ? primaryAngle + (random() - .5) * .55 : composition === 'canopy' ? (random() < .5 ? 0 : Math.PI) + (random() - .5) * .9 : random() * Math.PI * 2;
        if (branch < Math.floor(reach * 3)) {
            const edge = Math.floor(random() * 4);
            x = edge === 0 ? 0 : edge === 1 ? 23 : Math.floor(random() * 24);
            y = edge === 2 ? 0 : edge === 3 ? 23 : Math.floor(random() * 24);
            angle = edge === 0 ? 0 : edge === 1 ? Math.PI : edge === 2 ? Math.PI / 2 : -Math.PI / 2;
        }
        const steps = 7 + Math.floor(random() * (7 + density * 15));
        for (let step = 0; step < steps; step++) {
            put(x, y, .68 + random() * .32);
            if (random() < density * .58)
                put(x + (random() < .5 ? -1 : 1), y + (random() < .5 ? -1 : 1), .34 + random() * .34);
            if (random() < turnRate)
                angle += (random() - .5) * 1.25;
            x = Math.round(x + Math.cos(angle));
            y = Math.round(y + Math.sin(angle));
            if (x < 0 || x > 23 || y < 0 || y > 23)
                break;
        }
    }
    const voidX = 3 + random() * 18, voidY = 3 + random() * 18, voidRadius = 2.5 + random() * 5.5;
    if (random() > .26)
        for (const cell of [...cells.keys()]) {
            const x = cell % 24, y = Math.floor(cell / 24);
            if (Math.hypot(x - voidX, y - voidY) < voidRadius && random() > .18)
                cells.delete(cell);
        }
    const pixels = [];
    for (const [cell, power] of [...cells].sort(([a], [b]) => a - b)) {
        const x = cell % 24, y = Math.floor(cell / 24), bright = power > .72 || random() > .8;
        const size = 2.15 + random() * 1.5;
        pixels.push({ x: Math.min(SIZE - size, x * 4 + .35 + random() * .65), y: Math.min(SIZE - size, y * 4 + .35 + random() * .65), size, opacity: .38 + random() * .5, tone: bright ? (random() > .45 ? 'growth' : 'accent') : 'branch' });
    }
    const nodes = [];
    const auras = anchors.slice(0, 1 + Math.floor(random() * Math.min(3, anchors.length))).map(anchor => ({ x: anchor.x * 4, y: anchor.y * 4, radius: 13 + anchor.radius * 3, opacity: .025 + random() * .05 }));
    const gridRegions = random() > .22 ? anchors.slice(0, 1 + Math.floor(random() * Math.min(3, anchors.length))).map(anchor => ({ x: anchor.x * 4, y: anchor.y * 4, radius: 16 + anchor.radius * 3.2 })) : [];
    return { version: 11, size: SIZE, background: '#0f1426', gridSize: 8 + Math.floor(random() * 6), gridOffset: Math.floor(random() * 8), gridOpacity: .04 + random() * .035, palette, composition, density, pixels, nodes, auras, gridRegions };
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
/** Platform-neutral rasterizer used by the extension and sample tooling. */
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
    const gridAlpha = (x, y) => { let alpha = 0; for (const region of art.gridRegions) {
        const fade = Math.max(0, 1 - Math.hypot(x - region.x * scale, y - region.y * scale) / (region.radius * scale));
        alpha = Math.max(alpha, art.gridOpacity * fade);
    } return alpha; };
    for (let line = gridOffset; line < resolution; line += gridSize) {
        const p = Math.round(line);
        for (let i = 0; i < resolution; i++) {
            blend(bytes, resolution, p, i, grid, gridAlpha(p, i));
            blend(bytes, resolution, i, p, grid, gridAlpha(i, p));
        }
    }
    for (const pixel of art.pixels) {
        const color = rgb(art.palette[pixel.tone]), left = Math.floor(pixel.x * scale), top = Math.floor(pixel.y * scale), side = Math.max(2, Math.round(pixel.size * scale));
        for (let y = top; y < top + side; y++)
            for (let x = left; x < left + side; x++)
                blend(bytes, resolution, x, y, color, pixel.opacity);
    }
    return { width: resolution, height: resolution, bytes, art };
}
