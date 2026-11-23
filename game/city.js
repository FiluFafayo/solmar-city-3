// Solmar City — city: roads, blocks, buildings, districts, collision.
// The city is a fixed grid, generated once from a seeded RNG so every load
// (and every screenshot) sees the same streets.

SC.roadsV = [];   // vertical road centre x values
SC.roadsH = [];   // horizontal road centre y values
SC.buildings = []; // {x,y,w,h,color,roof,district,h}
SC.trees = [];     // {x,y,r}
SC.parks = [];     // {x,y,w,h}
SC.containers = []; // port containers {x,y,w,h,color}
SC.piers = [];     // {x,y,w,h}
SC.boats = [];     // {x,y,angle}
SC.blocked = [];   // solid rects for collision (buildings + containers + water edge)

SC.roadAt = (x, y) => {
  for (const rx of SC.roadsV) if (Math.abs(x - rx) < SC.ROAD_W / 2 + 6) return true;
  for (const ry of SC.roadsH) if (Math.abs(y - ry) < SC.ROAD_W / 2 + 6) return true;
  return false;
};
SC.onRoad = (x, y) => SC.roadAt(x, y);
SC.nearestRoadPoint = (x, y) => {
  let best = null, bd = 1e12;
  for (const rx of SC.roadsV) for (const ry of SC.roadsH) {
    const d = dist2(x, y, rx, ry);
    if (d < bd) { bd = d; best = { x: rx, y: ry }; }
  }
  return best;
};
// A random intersection, optionally restricted to a rectangle.
SC.randomJunction = (x0, y0, x1, y1) => {
  const xs = SC.roadsV.filter((v) => v >= x0 && v <= x1);
  const ys = SC.roadsH.filter((v) => v >= y0 && v <= y1);
  return { x: pick(xs), y: pick(ys) };
};
// District of a block centre: downtown | oldtown | suburbs | port | beach | marina.
SC.districtAt = (x, y) => {
  if (y > SC.SAND_Y) return 'beach';
  if (x > 1900 && y > 560 && y < 1500) return 'port';
  if (y < 420) return 'suburbs';
  if (x > 780 && x < 1620 && y > 420 && y < 1140) return 'downtown';
  if (x > 1980 && y > 1140) return 'marina';
  return 'oldtown';
};

const PALETTES = {
  downtown: ['#7fa8a0', '#5f8f96', '#c9b18a', '#8fa3b8', '#d9a441', '#6f7f8c'],
  oldtown: ['#b0704f', '#c98d5f', '#a85f4b', '#d9c9a8', '#96705a'],
  suburbs: ['#d9c9a8', '#e8dcc0', '#b8a88a', '#c9b18a', '#a8b8a0'],
  port: ['#7a6a58', '#8c8578', '#6f7f8c', '#a89a7a'],
  beach: ['#e0c98f'],
  marina: ['#c9b18a', '#8fa3b8'],
};
const CONTAINER_COLORS = ['#c96a3b', '#3b7a8c', '#d9a441', '#7a9a5c', '#8c4a5a'];

SC.buildCity = () => {
  for (let i = 0; i <= 9; i++) SC.roadsV.push(120 + i * SC.PITCH);
  for (let j = 0; j <= 7; j++) SC.roadsH.push(120 + j * SC.PITCH);

  // Buildings, block by block.
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 7; j++) {
      const bx0 = SC.roadsV[i] + SC.ROAD_W / 2 + 10;
      const by0 = SC.roadsH[j] + SC.ROAD_W / 2 + 10;
      const bx1 = SC.roadsV[i + 1] - SC.ROAD_W / 2 - 10;
      const by1 = SC.roadsH[j + 1] - SC.ROAD_W / 2 - 10;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const d = SC.districtAt(cx, cy);
      if (d === 'beach') continue;
      // Two park blocks.
      if ((i === 2 && j === 4) || (i === 6 && j === 1)) {
        SC.parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        for (let t = 0; t < 9; t++) {
          SC.trees.push({ x: bx0 + 14 + SC.rng() * (bx1 - bx0 - 28), y: by0 + 14 + SC.rng() * (by1 - by0 - 28), r: 8 + SC.rng() * 6 });
        }
        continue;
      }
      if (d === 'port') {
        // Containers and warehouses instead of buildings.
        for (let c = 0; c < 7; c++) {
          const cw = 46 + SC.rng() * 30, ch = 20;
          const x = bx0 + 8 + SC.rng() * Math.max(1, bx1 - bx0 - cw - 16);
          const y = by0 + 8 + SC.rng() * Math.max(1, by1 - by0 - ch - 16);
          SC.containers.push({ x, y, w: cw, h: ch, color: pick(CONTAINER_COLORS) });
          SC.blocked.push({ x, y, w: cw, h: ch });
        }
        continue;
      }
      const n = d === 'downtown' ? 1 + Math.floor(SC.rng() * 2) : 2 + Math.floor(SC.rng() * 2);
      const bw = (bx1 - bx0) / (n === 1 ? 1 : 2) - 14;
      for (let k = 0; k < n; k++) {
        const cols = n === 1 ? 1 : 2;
        const gx = k % cols, gy = Math.floor(k / cols);
        const w = d === 'downtown' ? 96 + SC.rng() * 46 : 56 + SC.rng() * 40;
        const h = d === 'downtown' ? 96 + SC.rng() * 46 : 52 + SC.rng() * 36;
        const x = bx0 + gx * ((bx1 - bx0) / cols) + 8 + SC.rng() * Math.max(1, (bx1 - bx0) / cols - w - 16);
        const y = by0 + gy * ((by1 - by0) / Math.ceil(n / cols)) + 8 + SC.rng() * Math.max(1, (by1 - by0) / Math.ceil(n / cols) - h - 16);
        const b = { x, y, w, h, color: pick(PALETTES[d]), district: d, hgt: d === 'downtown' ? 3 : 1 };
        SC.buildings.push(b);
        SC.blocked.push({ x, y, w, h });
      }
      // A few street trees on the block corners.
      if (SC.rng() < 0.6) {
        SC.trees.push({ x: bx0 + 6, y: by0 + 6, r: 7 + SC.rng() * 4 });
        SC.trees.push({ x: bx1 - 6, y: by1 - 6, r: 7 + SC.rng() * 4 });
      }
    }
  }

  // Beach palms + pier + boats.
  for (let t = 0; t < 26; t++) {
    SC.trees.push({ x: 60 + SC.rng() * (SC.W - 120), y: SC.SAND_Y + 12 + SC.rng() * 70, r: 7 + SC.rng() * 5 });
  }
  SC.piers.push({ x: 1140, y: SC.SEA_Y - 120, w: 26, h: 150 });
  for (let b = 0; b < 6; b++) {
    SC.boats.push({ x: 260 + b * 340 + SC.rng() * 60, y: SC.SEA_Y + 34 + SC.rng() * 40, angle: SC.rng() * TAU });
  }
  // Sea is solid (no swimming).
  SC.blocked.push({ x: -40, y: SC.SEA_Y, w: SC.W + 80, h: 200 });
  // World borders.
  SC.blocked.push({ x: -40, y: -40, w: SC.W + 80, h: 40 });
  SC.blocked.push({ x: -40, y: SC.H, w: SC.W + 80, h: 40 });
  SC.blocked.push({ x: -40, y: 0, w: 40, h: SC.H });
  SC.blocked.push({ x: SC.W, y: 0, w: 40, h: SC.H });
};

// Resolve a circle against all solid rects; mutates {x,y} in place.
SC.collide = (e, r) => {
  for (const b of SC.blocked) {
    const push = circleRect(e.x, e.y, r, b.x, b.y, b.w, b.h);
    if (push) { e.x += push.x; e.y += push.y; }
  }
};
