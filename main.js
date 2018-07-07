const canvas = document.getElementById('stuff');
const ctx = canvas.getContext('2d');

const N = 40;
let WIDTH = 300;
let HEIGHT = 300;

const resizer = function () {
  WIDTH = canvas.scrollWidth;
  HEIGHT = canvas.scrollHeight;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
};
resizer();
window.addEventListener("resize", resizer);

const generatePoints = function(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      x: Math.random(),
      y: Math.random(),
      d: {
        x: Math.random() * 0.1,
        y: Math.random() * 0.1,
      },
    });
  }
  return pts;
};

const minus = function(p, q) {
  return {x: p.x - q.x, y: p.y - q.y};
};

const det = function(M) {
  if (M.length === 0) {
    return 1;
  }

  let d = 0;
  for (let i = 0; i < M.length; i++) {
    const sign = 1 - (2 * (i % 2));
    d += sign * M[0][i] * det(M.slice(1).map(
      row => [].concat(row.slice(0,i), row.slice(i+1))
    ));
  }
  return d;
};  

const id = function(p) {
  return `(${p.x},${p.y})`;
};

const emptyConnections = function(pts) {
  const connections = {};
  for (const pt of pts) {
    connections[id(pt)] = {center: pt, links: []};
  }
  return connections;
};

const addConnection = function(p, ring) {
  const D = minus(p, ring.center);
  ring.links.push({
    point: p,
    angle: Math.atan2(D.y, D.x),
  });
  ring.links.sort((c,d) => c.angle - d.angle);
  return ring;
};

const removeConnection = function(p, ring) {
  ring.links = ring.links.filter(c => c.point !== p);
  return ring;
};
  
const connect = function(p, q, connections) {
  connections[id(p)] = addConnection(q, connections[id(p)]);
  connections[id(q)] = addConnection(p, connections[id(q)]);
  return connections;
};

const disconnect = function(p, q, connections) {
  connections[id(p)] = removeConnection(q, connections[id(p)]);
  connections[id(q)] = removeConnection(p, connections[id(q)]);
  return connections;
};

const mergeConnections = function(c, d) {
  return Object.assign({}, c, d);
};

const nextConnectionFromAngle = function(angle, ring, {direction}) {
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

const nextConnection = function(p, ring, {direction}) {
  if (typeof p === 'number') {
    return nextConnectionFromAngle(p, ring, {direction});
  }
  const D = minus(p, ring.center);
  const angle = Math.atan2(D.y, D.x);
  return nextConnectionFromAngle(angle, ring, {direction});
};

const belowLine = function(p, [a, b]) {
  if ([a, b].includes(p)) {
    return false;
  }

  [a, b] = [a,b].sort((l, r) => l.x - r.x);
  return det([
    [a.x, a.y, 1],
    [b.x, b.y, 1],
    [p.x, p.y, 1],
  ]) < 0;
};

const aboveLine = function(p, [a, b]) {
  if ([a, b].includes(p)) {
    return false;
  }

  [a, b] = [a,b].sort((l, r) => l.x - r.x);
  return det([
    [a.x, a.y, 1],
    [b.x, b.y, 1],
    [p.x, p.y, 1],
  ]) > 0;
};

const inCircle = function(p, [a, b, c]) {
  if ([a, b, c].includes(p)) {
    return false;
  }

  return det([
    [a.x, a.y, (a.x)**2 + (a.y)**2, 1],
    [b.x, b.y, (b.x)**2 + (b.y)**2, 1],
    [c.x, c.y, (c.x)**2 + (c.y)**2, 1],
    [p.x, p.y, (p.x)**2 + (p.y)**2, 1],
  ]) > 0;
};

const nextConnectionAbove = function(p, ring, opts, line) {
  const q = nextConnection(p, ring, opts);
  return aboveLine(q, line) && q;
};

const delaunay = function(pts) {
  if (pts.length < 2) {
    throw new Error("Not enough points to compute delaunay triangulation");
  }
  
  pts.sort((p,q) => p.x - q.x);

  if (pts.length === 2) {
    const [p, q] = pts;
    let connections = emptyConnections(pts);
    connections = connect(p, q, connections);
    return connections;
  }

  if (pts.length === 3) {
    const [p,q,r] = pts;
    let connections = emptyConnections(pts);
    connections = connect(p, q, connections);
    connections = connect(q, r, connections);
    connections = connect(r, p, connections);
    return connections;
  }

  // Points are sorted by x already.  Compute triangulations for left and right
  // halves, then combine them
  const mid = Math.floor(pts.length / 2);
  const leftPts = pts.slice(0,mid);
  const rightPts = pts.slice(mid);
  const leftConnections = delaunay(leftPts);
  const rightConnections = delaunay(rightPts);

  let connections = mergeConnections(leftConnections, rightConnections);

  // Find the lower tangent to the left and right hulls
  let left = leftPts[leftPts.length - 1];
  let right = rightPts[0];
  let nextLeft = nextConnection(0, connections[id(left)], {direction: -1});
  let nextRight = nextConnection(-Math.PI, connections[id(right)], {direction: 1});
  while (belowLine(nextLeft, [left, right]) || belowLine(nextRight, [left, right])) {
    if (belowLine(nextLeft, [left, right])) {
      [left, nextLeft] = [nextLeft, nextConnection(left, connections[id(nextLeft)], {direction: -1})];
      continue;
    }
    [right, nextRight] = [nextRight, nextConnection(right, connections[id(nextRight)], {direction: 1})];
  }
  connections = connect(left, right, connections);

  // Fill in the rest of the edges between leftPts and rightPts and delete edges that are no
  // longer Delaunay
  while(left && right) {
    let leftCandidate = nextConnectionAbove(right, connections[id(left)], {direction: 1}, [left, right]);
    let nextCandidate = nextConnectionAbove(leftCandidate, connections[id(left)], {direction: 1}, [left, right]);
    while (inCircle(nextCandidate, [left, right, leftCandidate])) {
      connections = disconnect(left, leftCandidate, connections);
      leftCandidate = nextCandidate;
      nextCandidate = nextConnectionAbove(leftCandidate, connections[id(left)], {direction: 1}, [left, right]);
    }
    let rightCandidate = nextConnectionAbove(left, connections[id(right)], {direction: -1}, [left, right]);
    nextCandidate = nextConnectionAbove(rightCandidate, connections[id(right)], {direction: -1}, [left, right]);
    while (inCircle(nextCandidate, [left, right, rightCandidate])) {
      connections = disconnect(right, rightCandidate, connections);
      rightCandidate = nextCandidate;
      nextCandidate = nextConnectionAbove(rightCandidate, connections[id(right)], {direction: -1}, [left, right]);
    }
    leftCandidate = aboveLine(leftCandidate, [left, right]) && leftCandidate;
    rightCandidate = aboveLine(rightCandidate, [left, right]) && rightCandidate;
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

const lt = function(p, q) {
  return p.x < q.x;
};

ctx.strokeStyle = 'blue';

const drawEdge = function(p, q, ctx) {
  ctx.beginPath();
  ctx.moveTo(p.x * WIDTH, (1 - p.y) * HEIGHT);
  ctx.lineTo(q.x * WIDTH, (1 - q.y) * HEIGHT);
  ctx.stroke();
};
  
const render = function(pts, connections, colors = {})  {
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle = 'green';
  for (const p of pts) {
    if (colors[id(p)]) {
      ctx.fillStyle = colors[id(p)];
    }
    ctx.fillRect(p.x * WIDTH, (1 - p.y) * HEIGHT, 2, 2);
    ctx.fillStyle = 'green';
    for (const link of connections[id(p)].links) {
      if (lt(link.point, p)) {
        drawEdge(link.point, p, ctx);
      }
    }
  }
};

const update = function() {
  const thisUpdate = performance.now();
  const delta = (thisUpdate  - lastUpdate) / 1000;
  for (const p of points) {
    p.x = (p.x + (delta * p.d.x)) % 1;
    p.y = (p.y + (delta * p.d.y)) % 1;
  }
  const connections = delaunay(points);
  render(points, connections);
  lastUpdate = thisUpdate;
  window.setTimeout(update, Math.max((1/60) - delta, 0) * 1000);
};

let lastUpdate = 0;
let points = generatePoints(N);
let connections = delaunay(points);
lastUpdate = performance.now();
update();