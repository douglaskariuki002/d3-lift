const Lift3D = (() => {
  const L = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isNum = v => v !== null && v !== undefined && v !== '' && typeof v !== 'boolean' && !(v instanceof Date) && isFinite(+v);

  function columns(data) {
    return Object.keys(data[0] || {}).map(name => {
      const vals = data.map(r => r[name]);
      const type = vals.every(v => v instanceof Date) ? 'date' : vals.every(isNum) ? 'number' : 'category';
      return { name, type, unique: new Set(vals.map(String)).size };
    });
  }
  L.columns = columns;

  function axisFor(data, name, info) {
    const cat = info.type === 'category';
    const vals = data.map(r => info.type === 'number' ? +r[name] : r[name]);
    let sc, ticks, fmt;
    if (cat) {
      const dom = [...new Set(vals.map(String))];
      sc = d3.scalePoint(dom, [-1, 1]).padding(.5);
      const step = Math.ceil(dom.length / 8);
      ticks = dom.filter((_, i) => i % step === 0); fmt = s => s;
    } else {
      sc = (info.type === 'date' ? d3.scaleTime() : d3.scaleLinear()).domain(d3.extent(vals)).range([-1, 1]).nice();
      ticks = sc.ticks(5); fmt = sc.tickFormat(5);
    }
    return {
      label: name,
      scale: v => sc(cat ? String(v) : info.type === 'number' ? +v : v),
      ticks: ticks.map(t => ({ pos: sc(t), text: fmt(t) }))
    };
  }

  function pca(Z, k = 3) {
    const n = Z.length, p = Z[0].length;
    const C = d3.range(p).map(i => d3.range(p).map(j => d3.sum(Z, r => r[i] * r[j]) / Math.max(1, n - 1)));
    const comps = [], total = d3.sum(C.map((r, i) => r[i])) || 1;
    for (let c = 0; c < Math.min(k, p); c++) {
      let v = d3.range(p).map((_, i) => Math.sin(i + 1 + 2 * c));
      for (let it = 0; it < 300; it++) {
        const w = C.map(row => d3.sum(row, (x, i) => x * v[i]));
        const nr = Math.hypot(...w) || 1; v = w.map(x => x / nr);
      }
      const lam = d3.sum(C.map((row, i) => d3.sum(row, (x, j) => x * v[j]) * v[i]));
      comps.push({ v, lam });
      for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) C[i][j] -= lam * v[i] * v[j];
    }
    while (comps.length < k) comps.push({ v: new Array(p).fill(0), lam: 0 });
    return { scores: Z.map(r => comps.map(c => d3.sum(c.v, (x, i) => x * r[i]))), explained: comps.map(c => c.lam / total) };
  }

  L.lift = function (data, o = {}) {
    const cols = columns(data), info = Object.fromEntries(cols.map(c => [c.name, c]));
    const nums = cols.filter(c => c.type === 'number').map(c => c.name);
    const mode = o.mode || 'axes';
    let points, axes, meta = { mode };

    if (mode === 'axes') {
      const n = [o.x || nums[0], o.y || nums[1] || nums[0], o.z || nums[2] || nums[0]];
      axes = n.map(c => axisFor(data, c, info[c]));
      points = data.map((row, i) => ({ i, row, pos: axes.map((a, k) => a.scale(row[n[k]])) }));
    } else if (mode === 'pca') {
      const M = data.map(r => nums.map(c => +r[c]));
      const mu = nums.map((_, j) => d3.mean(M, r => r[j])), sd = nums.map((_, j) => d3.deviation(M, r => r[j]) || 1);
      const { scores, explained } = pca(M.map(r => r.map((v, j) => (v - mu[j]) / sd[j])));
      meta.explained = explained;
      axes = [0, 1, 2].map(k => {
        const sc = d3.scaleLinear().domain(d3.extent(scores, s => s[k])).range([-1, 1]).nice();
        return { label: `PC${k + 1} (${Math.round(explained[k] * 100)}%)`, sc, ticks: sc.ticks(5).map(t => ({ pos: sc(t), text: sc.tickFormat(5)(t) })) };
      });
      points = data.map((row, i) => ({ i, row, pos: axes.map((a, k) => a.sc(scores[i][k])) }));
    } else {
      const rowCol = cols.find(c => c.type !== 'number')?.name;
      const vc = o.columns || nums, n = data.length;
      const all = data.flatMap(r => vc.map(c => +r[c]));
      const mk = v => d3.scaleLinear().domain([Math.min(0, d3.min(v)), d3.max(v)]).range([-1, 1]);
      const gs = mk(all).nice(), per = vc.map(c => mk(data.map(r => +r[c])));
      const xs = d3.scalePoint(vc, [-1, 1]).padding(.3), ys = d3.scalePoint(d3.range(n), [-1, 1]).padding(.3);
      const step = Math.ceil(n / 12);
      points = []; meta.grid = data.map(() => []);
      data.forEach((row, i) => vc.forEach((c, j) => {
        const value = +row[c];
        const p = { i, j, row, value, col: c, pos: [xs(c), ys(i), (o.normalize === 'column' ? per[j] : gs)(value)] };
        points.push(p); meta.grid[i][j] = p;
      }));
      axes = [
        { label: 'columns', ticks: vc.map(c => ({ pos: xs(c), text: c })) },
        { label: rowCol || 'row', ticks: d3.range(n).filter(i => i % step === 0).map(i => ({ pos: ys(i), text: rowCol ? String(data[i][rowCol]) : String(i + 1) })) },
        { label: 'value', ticks: o.normalize === 'column' ? [] : gs.ticks(5).map(t => ({ pos: gs(t), text: gs.tickFormat(5)(t) })) }
      ];
    }
    return { points, axes, meta, columns: cols };
  };

  L.project = function (p, cam) {
    const [x, y, z] = p, ca = Math.cos(cam.yaw), sa = Math.sin(cam.yaw), cb = Math.cos(cam.pitch), sb = Math.sin(cam.pitch);
    const x1 = x * ca - y * sa, y1 = x * sa + y * ca;
    const depth = y1 * cb - z * sb, up = y1 * sb + z * cb;
    const D = cam.distance || 4.5, f = cam.projection === 'orthographic' ? 1 : D / (D + depth);
    return { sx: (cam.cx || 0) + x1 * f * cam.scale, sy: (cam.cy || 0) - up * f * cam.scale, depth, f };
  };

  L.create = function (svgEl, data, opts) {
    const W = 800, H = 560, svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
    const st = Object.assign({ mode: 'axes', yaw: -0.7, pitch: 0.55, zoom: 1, projection: 'perspective', drop: true, spin: false }, opts);
    let lift, cols;
    const fmt = d3.format('~s');
    const cubeLayer = svg.append('g').attr('class', 'cube');
    const dropLayer = svg.append('g').attr('class', 'drop-lines');
    const gridLayer = svg.append('g').attr('class', 'grid');
    const pointLayer = svg.append('g').attr('class', 'points');
    const labelLayer = svg.append('g').attr('class', 'labels');
    const legendLayer = svg.append('g').attr('class', 'legend');

    function colorer() {
      const seq = dom => d3.scaleSequential(d3.interpolateViridis).domain(dom);
      if (st.mode === 'grid') { const sc = seq(d3.extent(lift.points, p => p.value)); return { f: p => sc(p.value), val: v => sc(v), label: 'value' }; }
      const info = cols.find(c => c.name === st.color);
      if (info && info.type === 'category') {
        const dom = [...new Set(data.map(r => String(r[st.color])))];
        const sc = d3.scaleOrdinal(d3.schemeTableau10).domain(dom);
        return { f: p => sc(String(p.row[st.color])), cat: dom.slice(0, 10).map(d => [d, sc(d)]), label: st.color };
      }
      if (info && info.type === 'number') {
        const e = d3.extent(data, r => +r[st.color]), sc = seq(e);
        return { f: p => sc(+p.row[st.color]), label: `${st.color}: ${fmt(e[0])} → ${fmt(e[1])}` };
      }
      const sc = seq([-1, 1]); return { f: p => sc(p.pos[2]), label: 'color = height' };
    }

    function draw() {
      const cam = { yaw: st.yaw, pitch: st.pitch, projection: st.projection, cx: W / 2, cy: H / 2 + 12, scale: 190 * st.zoom };
      const P = p => L.project(p, cam), col = colorer();
      const sc = st.size && cols.find(c => c.name === st.size && c.type === 'number') && st.mode !== 'grid'
        ? d3.scaleLinear().domain(d3.extent(data, r => +r[st.size])).range([2.5, 9]) : null;

      const cs = d3.range(8).map(i => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
      const cubeEdges = [];
      d3.range(8).forEach(i => [1, 2, 4].forEach(b => {
        if (!(i & b)) cubeEdges.push([cs[i], cs[i | b]]);
      }));
      cubeLayer.selectAll('line').data(cubeEdges).join('line')
        .attr('x1', d => P(d[0]).sx)
        .attr('y1', d => P(d[0]).sy)
        .attr('x2', d => P(d[1]).sx)
        .attr('y2', d => P(d[1]).sy)
        .attr('stroke', 'var(--line)')
        .attr('stroke-width', 1);

      const nearest = fn => [-1, 1].map(s => [s, P(fn(s)).depth]).sort((a, b) => a[1] - b[1])[0][0];
      const sy = nearest(s => [0, s, -1]), sx = nearest(s => [s, 0, -1]);
      const corner = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(c => [c, P([c[0], c[1], 0]).sx]).sort((a, b) => a[1] - b[1])[0][0];
      const [ax, ay, az] = lift.axes;
      const labels = [];
      const addLabel = (pt, text, cls = 'm', anchor = 'middle') => {
        const q = P(pt);
        labels.push({ x: q.sx, y: q.sy, text: String(text), cls, anchor });
      };
      ax.ticks.forEach(t => addLabel([t.pos, sy * 1.14, -1.08], t.text));
      ay.ticks.forEach(t => addLabel([sx * 1.14, t.pos, -1.08], t.text));
      az.ticks.forEach(t => addLabel([corner[0] * 1.1, corner[1] * 1.1, t.pos], t.text, 'm', 'end'));
      addLabel([0, sy * 1.45, -1.2], ax.label, 'ax');
      addLabel([sx * 1.5, 0, -1.2], ay.label, 'ax');
      addLabel([corner[0] * 1.2, corner[1] * 1.2, 1.12], az.label, 'ax');
      labelLayer.selectAll('text').data(labels).join('text')
        .attr('class', d => d.cls)
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('text-anchor', d => d.anchor)
        .attr('dominant-baseline', 'middle')
        .text(d => d.text);

      const grid = [];
      if (st.mode === 'grid') {
        const G = lift.meta.grid;
        for (let i = 0; i < G.length - 1; i++) for (let j = 0; j < G[0].length - 1; j++) {
          const q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]], pr = q.map(p => P(p.pos));
          grid.push({
            depth: d3.mean(pr, p => p.depth),
            points: pr.map(p => [p.sx.toFixed(1), p.sy.toFixed(1)].join(',')).join(' '),
            value: d3.mean(q, p => p.value)
          });
        }
      }
      grid.sort((a, b) => b.depth - a.depth);
      gridLayer.selectAll('polygon').data(grid).join('polygon')
        .attr('points', d => d.points)
        .attr('fill', d => col.val(d.value))
        .attr('fill-opacity', .88)
        .attr('stroke', 'var(--bg)')
        .attr('stroke-width', .6);

      const pointItems = lift.points.map(p => ({
        key: st.mode === 'grid' ? `${p.i}:${p.j}` : String(p.i),
        point: p,
        projected: P(p.pos),
        radius: (st.mode === 'grid' ? 2.2 : sc ? sc(+p.row[st.size]) : 4.5) * P(p.pos).f,
        tip: Object.entries(p.row).map(([k, v]) => `${k}: ${v}`).join('\n')
      })).sort((a, b) => b.projected.depth - a.projected.depth);

      const dropItems = st.drop && st.mode !== 'grid' ? pointItems.map(d => {
        const b = P([d.point.pos[0], d.point.pos[1], -1]);
        return { key: d.key, point: d.point, projected: d.projected, base: b };
      }) : [];
      dropLayer.selectAll('line').data(dropItems, d => d.key).join('line')
        .attr('x1', d => d.projected.sx)
        .attr('y1', d => d.projected.sy)
        .attr('x2', d => d.base.sx)
        .attr('y2', d => d.base.sy)
        .attr('stroke', d => col.f(d.point))
        .attr('stroke-opacity', .3);

      const points = pointLayer.selectAll('circle.point')
        .data(pointItems, d => d.key);
      const entered = points.enter().append('circle').attr('class', 'point');
      entered.append('title');
      entered.merge(points)
        .attr('cx', d => d.projected.sx.toFixed(1))
        .attr('cy', d => d.projected.sy.toFixed(1))
        .attr('r', d => d.radius.toFixed(2))
        .attr('fill', d => col.f(d.point))
        .attr('fill-opacity', .9)
        .attr('stroke', 'var(--bg)')
        .attr('stroke-width', .7);
      entered.merge(points).select('title').text(d => d.tip);
      points.exit().remove();

      const legendItems = col.cat || [];
      legendLayer.selectAll('g.legend-item').data(legendItems).join(
        enter => {
          const item = enter.append('g').attr('class', 'legend-item');
          item.append('circle').attr('r', 5);
          item.append('text').attr('class', 't').attr('x', 10).attr('dominant-baseline', 'middle');
          return item;
        }
      )
        .attr('transform', (d, i) => `translate(18,${24 + i * 16})`);
      legendLayer.selectAll('g.legend-item circle').data(legendItems)
        .attr('fill', d => d[1]);
      legendLayer.selectAll('g.legend-item text').data(legendItems)
        .text(d => d[0]);

      legendLayer.selectAll('text.legend-label').data([col.cat ? '' : col.label]).join('text')
        .attr('class', 'm legend-label')
        .attr('x', 14)
        .attr('y', col.cat ? 24 + col.cat.length * 16 + 6 : 18)
        .text(d => d);

      legendLayer.selectAll('text.pca-label').data(st.mode === 'pca' ? [lift.meta.explained] : []).join('text')
        .attr('class', 'm pca-label')
        .attr('x', W - 14)
        .attr('y', 18)
        .attr('text-anchor', 'end')
        .text(d => `top 3 components keep ${Math.round(d3.sum(d) * 100)}% of variance`);
    }

    function relift() { cols = L.columns(data); lift = L.lift(data, st); draw(); }

    svg.call(d3.drag().on('drag', e => { st.yaw += e.dx * 0.008; st.pitch = clamp(st.pitch + e.dy * 0.008, -1.5, 1.5); draw(); }));
    svg.on('wheel.zoom', e => { e.preventDefault(); st.zoom = clamp(st.zoom * Math.exp(-e.deltaY * 0.001), 0.4, 3); draw(); }, { passive: false });
    d3.timer(() => { if (st.spin) { st.yaw += 0.006; draw(); } });
    relift();

    return {
      state: st,
      get lift() { return lift; },
      update(o) { const heavy = ['mode', 'x', 'y', 'z', 'normalize', 'columns'].some(k => k in o); Object.assign(st, o); heavy ? relift() : draw(); },
      setData(d, o) { data = d; Object.assign(st, o); relift(); }
    };
  };

  return L;
})();
window.Lift3D = Lift3D;
