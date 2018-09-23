/*
 * Points
 */

interface Point {
  x: number;
  y: number;
}

const id = function(p): string {
  return `(${p.x},${p.y})`;
};

const lt = function(p: Point, q: Point): boolean {
  return p.x < q.x;
};

const plus = function(p: Point, q: Point): Point {
  return { x: p.x + q.x, y: p.y + q.y };
}

const sum = function(points: Point[]): Point {
  return points.reduce(plus, { x: 0, y: 0 });
}

const minus = function(p: Point, q: Point): Point {
  return { x: p.x - q.x, y: p.y - q.y };
};

const scale = function(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

const norm2 = function(p: Point): number {
  return p.x * p.x + p.y * p.y;
};

/*
 * Geometry functions
 */


// Permutations for determinant computation
type Permutation = number[];
const S_cache: {[key: number]: {p: Permutation; sign: number}[]} = {};
const S = function(n: number): {p: Permutation; sign: number}[] {
  if (S_cache[n]) {
    return S_cache[n];
  }
  
  if (n == 1) {
    return [{p: [1], sign: 1}];
  }

  const SS: {p: Permutation, sign: number}[]  = [];
  for (const {p, sign:sign_p} of S(n - 1)) {
    for (let i = 0; i < n; i++) {
      const q = p.slice(0,i).concat([n], p.slice(i));
      const sign_q = (-1)**(n - i + 1) * sign_p;
      SS.push({p: q, sign: sign_q});
    }
  }
  S_cache[n] = SS;
  return SS;
};
const det = function(M: number[][]): number {
  let n = M.length;
  let d = 0
  for (const {p, sign} of S(n)) {
    let x = sign;
    for (let i = 0; i < n; i++) {
      x *= M[i][p[i] - 1];
    }
    d += x;
  }
  return d;
};

const ccw = function(p: Point, q: Point, r: Point): boolean {
  return det([
    [p.x, p.y, 1],
    [q.x, q.y, 1],
    [r.x, r.y, 1],
  ]) > 0;
}

const belowLine = function(p: Point, [a, b]: Point[]): boolean {
  if ([a, b].includes(p)) {
    return false;
  }

  [a, b] = [a, b].sort((l, r) => l.x - r.x);
  return det([
    [a.x, a.y, 1],
    [b.x, b.y, 1],
    [p.x, p.y, 1],
  ]) < 0;
};

const aboveLine = function(p: Point, [a, b]: Point[]): boolean {
  if ([a, b].includes(p)) {
    return false;
  }

  [a, b] = [a, b].sort((l, r) => l.x - r.x);
  return det([
    [a.x, a.y, 1],
    [b.x, b.y, 1],
    [p.x, p.y, 1],
  ]) > 0;
};

const inCircle = function(p: Point, [a, b, c]: Point[]): boolean {
  if ([a, b, c].includes(p)) {
    return false;
  }

  return det([
    [a.x, a.y, norm2(a), 1],
    [b.x, b.y, norm2(b), 1],
    [c.x, c.y, norm2(c), 1],
    [p.x, p.y, norm2(p), 1],
  ]) > 0;
};

const centerOf = function(p: Point, q: Point, r: Point): Point {
  const Mxy = det([[p.x, p.y, 1], [q.x, q.y, 1], [r.x, r.y, 1]]);
  const Mny = det([[norm2(p), p.y, 1], [norm2(q), q.y, 1], [norm2(r), r.y, 1]]);
  const Mnx = det([[norm2(p), p.x, 1], [norm2(q), q.x, 1], [norm2(r), r.x, 1]]);
  const x = 0.5 * (Mny / Mxy);
  const y = -0.5 * (Mnx / Mxy);
  return { x, y };
};

/*
 * The data structure we use will consist of a "ring" of "links" associated to each point
 */

/*
 * Link ring functions
 */

interface Link {
  point: Point;
  angle: number;
};

interface Ring {
  center: Point;
  links: Link[];
};

const nextConnectionFromAngle = function(angle: number, ring: Ring, { direction }: { direction: number }): Point {
  let i = 0;
  while (i < ring.links.length) {
    if (ring.links[i].angle === angle && direction <= 0) {
      break;
    }
    if (ring.links[i].angle > angle) {
      break;
    }
    i += 1;
  }
  let nextConnection;
  if (direction > 0) {
    nextConnection = ring.links[i] || ring.links[0];
  } else {
    nextConnection = ring.links[i - 1] || ring.links[ring.links.length - 1];
  }
  return nextConnection.point;
}

const nextConnection = function(p: number | Point, ring: Ring, { direction }: { direction: number }): Point {
  if (typeof p === 'number') {
    return nextConnectionFromAngle(p, ring, { direction });
  }
  const D = minus(p, ring.center);
  const angle = Math.atan2(D.y, D.x);
  return nextConnectionFromAngle(angle, ring, { direction });
};

const nextConnectionAbove = function(p: Point, ring: Ring, opts: { direction: number }, line: Point[]): null | Point {
  const q = nextConnection(p, ring, opts);
  return (aboveLine(q, line) || null) && q;
};

/*
 * Meshes
 */

interface Connections { [key: string]: Ring };

const emptyConnections = function(pts: Point[]): Connections {
  const connections = {};
  for (const pt of pts) {
    connections[id(pt)] = { center: pt, links: [] };
  }
  return connections;
};

const addPoint = function(p: Point, connections: Connections): Connections {
  connections[id(p)] = { center: p, links: [] };
  return connections;
};

const getPoints = function(connections: Connections): Point[] {
  return Object.entries(connections).map(([k, r]) => r.center);
};

const addConnection = function(p: Point, ring: Ring): Ring {
  const D = minus(p, ring.center);
  ring.links.push({
    point: p,
    angle: Math.atan2(D.y, D.x),
  });
  ring.links.sort((c, d) => c.angle - d.angle);
  return ring;
};

const removeConnection = function(p: Point, ring: Ring): Ring {
  ring.links = ring.links.filter(c => c.point !== p);
  return ring;
};

const connect = function(p: Point, q: Point, connections: Connections): Connections {
  connections[id(p)] = addConnection(q, connections[id(p)]);
  connections[id(q)] = addConnection(p, connections[id(q)]);
  return connections;
};

const disconnect = function(p: Point, q: Point, connections: Connections): Connections {
  connections[id(p)] = removeConnection(q, connections[id(p)]);
  connections[id(q)] = removeConnection(p, connections[id(q)]);
  return connections;
};

const mergeConnections = function(c: Connections, d: Connections): Connections {
  return Object.assign({}, c, d);
};

const dual = function(connections: Connections): Connections {
  return _dual(connections, randomTriangle(connections), {});
}

const randomTriangle = function(connections: Connections): Point[] {
  const ring = Object.values(connections)[0];
  const p = ring.center;
  const q = ring.links[0].point;
  let T = rightTriangle(connections, p, q)
  if (!T) {
    T = rightTriangle(connections, q, p);
    if (!T) {
      throw new Error(`Couldn't find triangle for edge ${p} - ${q}`);
    }
    return T;
  }
  return T;
}

const rightTriangle = function(connections: Connections, p: Point, q: Point): Point[] | null {
  const r = nextConnection(p, connections[id(q)], { direction: 1 });
  if (r !== nextConnection(q, connections[id(p)], { direction: -1 })) {
    return null;
  }
  return [q, p ,r];
}

const _dual = function(connections: Connections, [a, b, c]: Point[], faces: Connections): Connections {
  const center = centerOf(a, b, c);
    if (id(center) in faces) {
    return faces;
  }
  faces = addPoint(center, faces);

  const neighbors = [[a, b], [b, c], [c, a]]
    .map(pair => rightTriangle(connections, pair[0], pair[1]))
    .filter(<Point>(T: Point | null): T is Point => { return T !== null });
  for (const T of neighbors) {
    const c = centerOf(T[0], T[1], T[2]);
    faces = _dual(connections, T, faces);
    faces = connect(center, c, faces);
  }
  return faces;
}


/*
 * The main event
 * Note that we assume points are in a generic position (x's and y's distinct, no points colinear)
 */

const delaunay = function(pts: Point[]): Connections {
  if (pts.length < 2) {
    throw new Error("Not enough points to compute delaunay triangulation");
  }

  pts.sort((p, q) => p.x - q.x);

  if (pts.length === 2) {
    const [p, q] = pts;
    let connections = emptyConnections(pts);
    connections = connect(p, q, connections);
    return connections;
  }

  if (pts.length === 3) {
    const [p, q, r] = pts;
    let connections = emptyConnections(pts);
    connections = connect(p, q, connections);
    connections = connect(q, r, connections);
    connections = connect(r, p, connections);
    return connections;
  }

  // Points are sorted by x already.  Compute triangulations for left and right
  // halves, then combine them
  const mid = Math.floor(pts.length / 2);
  const leftPts = pts.slice(0, mid);
  const rightPts = pts.slice(mid);
  const leftConnections = delaunay(leftPts);
  const rightConnections = delaunay(rightPts);

  let connections = mergeConnections(leftConnections, rightConnections);

  // Find the lower tangent to the left and right hulls
  let left = leftPts[leftPts.length - 1];
  let right = rightPts[0];
  let nextLeft = nextConnection(0, connections[id(left)], { direction: -1 });
  let nextRight = nextConnection(-Math.PI, connections[id(right)], { direction: 1 });
  while (belowLine(nextLeft, [left, right]) || belowLine(nextRight, [left, right])) {
    if (belowLine(nextLeft, [left, right])) {
      [left, nextLeft] = [nextLeft, nextConnection(left, connections[id(nextLeft)], { direction: -1 })];
      continue;
    }
    [right, nextRight] = [nextRight, nextConnection(right, connections[id(nextRight)], { direction: 1 })];
  }
  connections = connect(left, right, connections);

  // Fill in the rest of the edges between leftPts and rightPts and delete edges that are no
  // longer Delaunay
  while (left && right) {
    let leftCandidate = nextConnectionAbove(right, connections[id(left)], { direction: 1 }, [left, right]);
    if (leftCandidate) {
      let nextCandidate = nextConnectionAbove(leftCandidate, connections[id(left)], { direction: 1 }, [left, right]);
      while (nextCandidate && inCircle(nextCandidate, [left, right, leftCandidate])) {
        connections = disconnect(left, leftCandidate, connections);
        leftCandidate = nextCandidate;
        nextCandidate = nextConnectionAbove(leftCandidate, connections[id(left)], { direction: 1 }, [left, right]);
      }
    }
    let rightCandidate = nextConnectionAbove(left, connections[id(right)], { direction: -1 }, [left, right]);
    if (rightCandidate) {
      let nextCandidate = nextConnectionAbove(rightCandidate, connections[id(right)], { direction: -1 }, [left, right]);
      while (nextCandidate && inCircle(nextCandidate, [left, right, rightCandidate])) {
        connections = disconnect(right, rightCandidate, connections);
        rightCandidate = nextCandidate;
        nextCandidate = nextConnectionAbove(rightCandidate, connections[id(right)], { direction: -1 }, [left, right]);
      }
    }
    if (!leftCandidate && !rightCandidate) {
      break;
    }
    if (leftCandidate && rightCandidate) {
      if (inCircle(rightCandidate, [leftCandidate, left, right])) {
        leftCandidate = null;
      } else {
        rightCandidate = null;
      }
    }
    left = leftCandidate ? leftCandidate : left;
    right = rightCandidate ? rightCandidate : right;
    connections = connect(left, right, connections);
  }
  return connections;
};

/*
 * Rendering stuff
 */

interface Particle extends Point {
  d: Point;
}

const generatePoints = function(n: number): Particle[] {
  const pts: Particle[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      x: Math.random(),
      y: Math.random(),
      d: {
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
      },
    });
  }
  return pts;
};

const drawEdge = function(ctx: CanvasRenderingContext2D, p: Point, q: Point): void {
  ctx.beginPath();
  ctx.moveTo(p.x * WIDTH, (1 - p.y) * HEIGHT);
  ctx.lineTo(q.x * WIDTH, (1 - q.y) * HEIGHT);
  ctx.stroke();
};

const render = function(ctx: CanvasRenderingContext2D, connections: Connections, color = 'green', colors = {}): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const pts = getPoints(connections);
  for (const p of pts) {
    if (colors[id(p)]) {
      ctx.fillStyle = colors[id(p)];
    }
    // ctx.fillRect(p.x * WIDTH, (1 - p.y * HEIGHT, 2, 2);
    ctx.fillStyle = color;
    for (const link of connections[id(p)].links) {
      if (lt(link.point, p)) {
        drawEdge(ctx, link.point, p);
      }
    }
  }
};

const modOne = function(x: number): number {
  return x - Math.floor(x);
};

const shifted = function(points: Point[], d: Point): Point[] {
  const jitter = { x: ((Math.random() - 0.5) / 1000), y: ((Math.random() - 0.5) / 1000) };
  return points.map(p => plus(plus(p, d), jitter));
};

const update = function(ctx: CanvasRenderingContext2D, points: Particle[], lastUpdate: number): void {
  const thisUpdate = performance.now();
  const delta = (thisUpdate - lastUpdate) / 1000;
  for (const p of points) {
    p.x = modOne(p.x + (delta * p.d.x));
    p.y = modOne(p.y + (delta * p.d.y));
  }

  const torus = shifted((<Point[]> points).concat(
    shifted(points, {x:  1, y:  0}),
    shifted(points, {x: -1, y:  0}),
    shifted(points, {x:  0, y:  1}),
    shifted(points, {x:  0, y: -1}),
    shifted(points, {x:  1, y:  1}),
    shifted(points, {x: -1, y:  1}),
    shifted(points, {x:  1, y: -1}),
    shifted(points, {x: -1, y: -1})
  ), {x: 0, y: 0});
  
  const delaun = delaunay(torus);
  const vornoi  = dual(delaun);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  render(ctx, delaun, 'red');
  render(ctx, vornoi, 'blue');
    debugger;

  lastUpdate = thisUpdate;
  window.setTimeout(() => update(ctx, points, lastUpdate), Math.max((1 / 60) - delta, 0) * 1000);
};


const canvas = <HTMLCanvasElement>document.getElementById('stuff');
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error("failed to get 2d context");
}
ctx.strokeStyle = 'blue';

const N = 40;
let WIDTH = 300;
let HEIGHT = 300;

const resizer = function() {
  WIDTH = canvas.scrollWidth;
  HEIGHT = canvas.scrollHeight;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
};
resizer();
window.addEventListener("resize", resizer);

let points = generatePoints(N);
update(ctx, points, performance.now());
