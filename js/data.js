// Acceso a datos compartido entre el sitio público y el panel de administración.
(function () {
  const cfg = window.PVS_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = configured
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;

  const CATEGORIES = [
    { id: 'hogar', label: 'Hogar' },
    { id: 'carros', label: 'Carros de arrastre' },
    { id: 'carpinteria', label: 'Carpintería' },
    { id: 'otros', label: 'Otros trabajos' },
  ];

  function normalize(project) {
    const images = (project.project_images || [])
      .slice()
      .sort((a, b) => a.position - b.position);
    return { ...project, images };
  }

  // Trabajos ordenados del más nuevo al más antiguo. El sitio público solo
  // recibe los publicados (lo garantiza la base de datos, no este filtro).
  async function fetchProjects({ onlyPublished = true } = {}) {
    if (client) {
      let query = client
        .from('projects')
        .select('*, project_images(*)')
        .order('created_at', { ascending: false });
      if (onlyPublished) query = query.eq('published', true);
      const { data, error } = await query;
      if (!error) return data.map(normalize);
      if (!onlyPublished) throw error;
      console.warn('No se pudo leer Supabase; se muestran los trabajos de respaldo.', error);
    }
    const res = await fetch('data/proyectos.json');
    if (!res.ok) throw new Error('No se pudieron cargar los trabajos');
    return (await res.json()).map(normalize);
  }

  function categoryLabel(id) {
    const cat = CATEGORIES.find((c) => c.id === id);
    return cat ? cat.label : id;
  }

  // Pequeño ayudante para crear elementos sin usar innerHTML (evita inyección de HTML).
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key in el && key !== 'list' && key !== 'form') el[key] = value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  window.PVS = { cfg, client, configured, CATEGORIES, fetchProjects, categoryLabel, h };
})();
