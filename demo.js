(() => {
  function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const R = rng(7), norm = d3.randomNormal.source(R)(0, 1);
  const origins = [['USA', 1.2, .8], ['Europe', 0, .1], ['Japan', -.9, -.2]];
  const cars = d3.range(140).map(i => {
    const [origin, w0, p0] = origins[Math.floor(R() * 3)], s = norm() * .8 + w0;
    return { model: 'M' + (i + 1), origin, weight: Math.round(2800 + s * 600), horsepower: Math.round(110 + s * 38 + norm() * 14),
      mpg: +(26 - s * 5 + norm() * 2).toFixed(1), price: Math.round(24000 + s * 4500 + p0 * 6000 + norm() * 2500), year: 1990 + Math.floor(R() * 30) };
  });
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const base = { North: 40, South: 65, East: 50, West: 30, Central: 55 };
  const sales = months.map((m, i) => { const r = { month: m }; Object.keys(base).forEach((k, j) => r[k] = Math.round(base[k] * (1 + .45 * Math.sin((i + j * 2) / 12 * 2 * Math.PI)) + norm() * 4)); return r; });
  const sets = { cars: { data: cars, mode: 'axes', x: 'horsepower', y: 'weight', z: 'mpg', color: 'origin', size: 'price' }, sales: { data: sales, mode: 'grid' } };

  const $ = id => document.getElementById(id);
  let scene;
  function fill(sel, names, withNone) {
    sel.innerHTML = (withNone ? '<option value="">(none)</option>' : '') + names.map(n => `<option>${n}</option>`).join('');
  }
  function load(key) {
    const s = sets[key], cols = Lift3D.columns(s.data);
    const nums = cols.filter(c => c.type === 'number').map(c => c.name);
    const cats = cols.filter(c => c.type === 'category' && c.unique <= 20).map(c => c.name);
    ['x', 'y', 'z'].forEach(id => { fill($(id), nums); $(id).value = s[id] || nums[0]; });
    fill($('color'), [...cats, ...nums], true); $('color').value = s.color || '';
    fill($('size'), nums, true); $('size').value = s.size || '';
    $('mode').value = s.mode; $('xyz').style.display = s.mode === 'axes' ? 'contents' : 'none';
    const o = { mode: s.mode, x: $('x').value, y: $('y').value, z: $('z').value, color: $('color').value, size: $('size').value };
    scene ? scene.setData(s.data, o) : scene = Lift3D.create($('v'), s.data, o);
  }
  $('ds').onchange = e => load(e.target.value);
  ['x', 'y', 'z', 'color', 'size'].forEach(id => $(id).onchange = e => scene.update({ [id]: e.target.value }));
  $('mode').onchange = e => { $('xyz').style.display = e.target.value === 'axes' ? 'contents' : 'none'; scene.update({ mode: e.target.value }); };
  $('proj').onchange = e => scene.update({ projection: e.target.value });
  $('drop').onchange = e => scene.update({ drop: e.target.checked });
  $('spin').onchange = e => scene.update({ spin: e.target.checked });
  load('cars');
})();
