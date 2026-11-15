// Sitio público: lista de trabajos, filtros y visor de fotos.
(function () {
  const { cfg, CATEGORIES, fetchProjects, categoryLabel, h } = window.PVS;

  const filtersEl = document.getElementById('filtros');
  const listEl = document.getElementById('proyectos');
  let projects = [];
  let activeCategory = 'todos';

  // WhatsApp y año desde la configuración, para no repetir el número en el HTML.
  if (cfg.whatsapp) {
    const msg = encodeURIComponent('Hola Don Pedro, vi su página y quiero pedir un presupuesto.');
    document.querySelectorAll('[data-wa]').forEach((a) => {
      a.href = `https://wa.me/${cfg.whatsapp}?text=${msg}`;
    });
  }
  document.getElementById('anio').textContent = new Date().getFullYear();

  function renderFilters() {
    const used = CATEGORIES.filter((c) => projects.some((p) => p.category === c.id));
    const options = [{ id: 'todos', label: 'Todos' }, ...used];
    filtersEl.replaceChildren(
      ...options.map((opt) => {
        const count = opt.id === 'todos'
          ? projects.length
          : projects.filter((p) => p.category === opt.id).length;
        return h('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(opt.id === activeCategory),
          onclick: () => { activeCategory = opt.id; renderFilters(); renderProjects(); },
        }, opt.label, h('span', {}, count));
      })
    );
    filtersEl.hidden = used.length < 2;
  }

  function renderProjects() {
    const visible = projects.filter((p) => activeCategory === 'todos' || p.category === activeCategory);
    if (!visible.length) {
      listEl.replaceChildren(h('p', { class: 'empty' },
        'Pronto publicaremos nuevos trabajos. ¡Vuelve a visitarnos!'));
      return;
    }
    listEl.replaceChildren(...visible.map((p) => {
      const cover = p.images[0];
      return h('button', { class: 'project', type: 'button', onclick: () => openLightbox(p, 0) },
        h('div', { class: 'project__img' },
          cover && h('img', { src: cover.url, alt: '', loading: 'lazy' }),
          p.images.length > 1 && h('span', { class: 'project__count' }, `${p.images.length} fotos`)),
        h('div', { class: 'project__body' },
          h('span', { class: 'project__cat' }, categoryLabel(p.category)),
          h('h3', {}, p.title),
          h('p', {}, p.description)));
    }));
  }

  // ── Visor de fotos ──
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  let current = null;
  let index = 0;

  function showPhoto() {
    const total = current.images.length;
    const img = current.images[index];
    lbImg.src = img ? img.url : '';
    lbImg.alt = `${current.title}, foto ${index + 1} de ${total}`;
    document.getElementById('lb-count').textContent = total > 1 ? `${index + 1} / ${total}` : '';
    lbPrev.hidden = lbNext.hidden = total < 2;
  }

  function step(delta) {
    const total = current.images.length;
    index = (index + delta + total) % total;
    showPhoto();
  }

  function openLightbox(project, start) {
    if (!project.images.length) return;
    current = project;
    index = start;
    document.getElementById('lb-titulo').textContent = project.title;
    document.getElementById('lb-desc').textContent = project.description;
    showPhoto();
    lb.showModal();
  }

  lbPrev.addEventListener('click', () => step(-1));
  lbNext.addEventListener('click', () => step(1));
  document.getElementById('lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  let touchX = null;
  lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50 && current.images.length > 1) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  fetchProjects()
    .then((data) => { projects = data; renderFilters(); renderProjects(); })
    .catch(() => {
      listEl.replaceChildren(h('p', { class: 'empty' },
        'No pudimos cargar los trabajos. Recarga la página para intentar de nuevo.'));
    });
})();
