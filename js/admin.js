// Panel de administración: ingreso, lista de trabajos y editor con subida de fotos.
// Los permisos reales los aplica la base de datos (RLS); esto es solo la interfaz.
(function () {
  const { cfg, client, configured, CATEGORIES, fetchProjects, categoryLabel, h } = window.PVS;
  const $ = (id) => document.getElementById(id);

  const VIEWS = ['cargando', 'config', 'login', 'clave', 'denegado', 'lista', 'editor'];
  const MAX_PHOTOS = 24;
  const MAX_SIDE = 1600; // las fotos del celular se achican antes de subirlas

  let session = null;
  let recovering = false; // llegó desde el enlace de "olvidé mi contraseña"
  let projects = [];
  let editing = null; // { id, images: [...], removed: [...], dirty }

  function show(view) {
    VIEWS.forEach((v) => { $('v-' + v).hidden = v !== view; });
    window.scrollTo(0, 0);
  }

  function setMsg(el, text, kind) {
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' msg--' + kind : '');
  }

  function friendly(error) {
    const text = (error && error.message) || String(error);
    if (/invalid login credentials/i.test(text)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(text)) return 'Falta confirmar el correo de esta cuenta.';
    if (/row-level security|permission denied|not authorized|unauthorized/i.test(text)) {
      return 'Tu cuenta no tiene permiso para hacer este cambio.';
    }
    if (/failed to fetch|networkerror|load failed/i.test(text)) {
      return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    }
    if (/jwt expired/i.test(text)) return 'Tu sesión venció. Sal y vuelve a ingresar.';
    return text;
  }

  // ───────────── Sesión y rol ─────────────
  async function route() {
    if (recovering) return show('clave');
    $('cuenta').hidden = !session;
    if (!session) return show('login');
    $('cuenta-email').textContent = session.user.email;

    const { data, error } = await client
      .from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (error) {
      setMsg($('login-msg'), friendly(error));
      return show('login');
    }
    if (!data || data.role !== 'admin') return show('denegado');
    await loadList();
  }

  async function signOut() {
    await client.auth.signOut();
    session = null;
    recovering = false;
    $('form-login').reset();
    setMsg($('login-msg'), '');
    route();
  }

  $('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type=submit]');
    setMsg($('login-msg'), '');
    btn.disabled = true;
    const { data, error } = await client.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value,
    });
    btn.disabled = false;
    if (error) return setMsg($('login-msg'), friendly(error));
    session = data.session;
    form.reset();
    route();
  });

  $('btn-olvide').addEventListener('click', async () => {
    const email = $('form-login').email.value.trim();
    if (!email) return setMsg($('login-msg'), 'Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".');
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    if (error) return setMsg($('login-msg'), friendly(error));
    setMsg($('login-msg'), 'Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.', 'info');
  });

  $('btn-clave').addEventListener('click', () => {
    if (editing && editing.dirty && !confirm('Tienes cambios sin guardar. ¿Salir del editor igual?')) return;
    editing = null;
    $('form-clave').reset();
    setMsg($('clave-msg'), '');
    show('clave');
  });
  $('btn-clave-cancelar').addEventListener('click', () => { recovering = false; route(); });

  $('form-clave').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const pass = form.password.value;
    if (pass.length < 8) return setMsg($('clave-msg'), 'La contraseña debe tener al menos 8 caracteres.');
    if (pass !== form.password2.value) return setMsg($('clave-msg'), 'Las contraseñas no coinciden.');
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const { error } = await client.auth.updateUser({ password: pass });
    btn.disabled = false;
    if (error) return setMsg($('clave-msg'), friendly(error));
    recovering = false;
    form.reset();
    await route();
    if (!$('v-lista').hidden) setMsg($('lista-msg'), 'Contraseña actualizada.', 'ok');
  });

  $('btn-salir').addEventListener('click', () => {
    if (editing && editing.dirty && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
    editing = null;
    signOut();
  });
  $('btn-salir-2').addEventListener('click', signOut);

  // ───────────── Lista de trabajos ─────────────
  async function loadList(message) {
    show('lista');
    setMsg($('lista-msg'), message || '', 'ok');
    try {
      projects = await fetchProjects({ onlyPublished: false });
    } catch (error) {
      projects = [];
      setMsg($('lista-msg'), 'No se pudieron cargar los trabajos: ' + friendly(error));
    }
    const drafts = projects.filter((p) => !p.published).length;
    $('lista-resumen').textContent = projects.length
      ? `${projects.length} en total` + (drafts ? ` · ${drafts} en borrador` : '')
      : 'Todavía no hay trabajos. Crea el primero con el botón.';
    $('lista').replaceChildren(...projects.map((p) =>
      h('li', { class: 'rowitem' },
        p.images[0]
          ? h('img', { class: 'rowitem__img', src: p.images[0].url, alt: '', loading: 'lazy' })
          : h('div', { class: 'rowitem__img' }),
        h('div', {},
          h('h2', {}, p.title),
          h('p', { class: 'rowitem__meta' },
            h('span', { class: 'badge' + (p.published ? '' : ' badge--draft') }, p.published ? 'Publicado' : 'Borrador'),
            `${categoryLabel(p.category)} · ${p.images.length} ${p.images.length === 1 ? 'foto' : 'fotos'}`)),
        h('button', { class: 'btn btn--plain btn--sm', type: 'button', onclick: () => openEditor(p) }, 'Editar'))));
  }

  $('btn-nuevo').addEventListener('click', () => openEditor(null));

  // ───────────── Editor ─────────────
  const form = $('form-trabajo');
  $('sel-categoria').replaceChildren(
    ...CATEGORIES.map((c) => h('option', { value: c.id }, c.label)));

  function openEditor(project) {
    editing = {
      id: project ? project.id : null,
      images: project ? project.images.map((img) => ({ ...img })) : [],
      removed: [],
      dirty: false,
    };
    form.reset();
    form.title.value = project ? project.title : '';
    form.description.value = project ? project.description : '';
    form.category.value = project ? project.category : CATEGORIES[0].id;
    form.published.checked = project ? project.published : true;
    $('editor-titulo').textContent = project ? 'Editar trabajo' : 'Nuevo trabajo';
    $('btn-eliminar').hidden = !project;
    setMsg($('editor-msg'), '');
    renderPhotos();
    show('editor');
  }

  function renderPhotos() {
    const imgs = editing.images;
    $('fotos').replaceChildren(...imgs.map((img, i) =>
      h('li', { class: 'photo' },
        h('div', { class: 'photo__img' },
          h('img', { src: img.preview || img.url, alt: `Foto ${i + 1}` }),
          i === 0 && h('span', { class: 'photo__tag' }, 'Portada'),
          img.file && h('span', { class: 'photo__tag photo__tag--new' }, 'Nueva')),
        h('div', { class: 'photo__actions' },
          h('button', { type: 'button', disabled: i === 0, 'aria-label': `Mover foto ${i + 1} antes`, onclick: () => movePhoto(i, -1) }, '←'),
          h('button', { type: 'button', disabled: i === imgs.length - 1, 'aria-label': `Mover foto ${i + 1} después`, onclick: () => movePhoto(i, 1) }, '→'),
          h('button', { type: 'button', class: 'del', 'aria-label': `Quitar foto ${i + 1}`, onclick: () => removePhoto(i) }, '✕')))));
  }

  function movePhoto(i, delta) {
    const imgs = editing.images;
    [imgs[i], imgs[i + delta]] = [imgs[i + delta], imgs[i]];
    editing.dirty = true;
    renderPhotos();
  }

  function removePhoto(i) {
    const [img] = editing.images.splice(i, 1);
    if (img.preview) URL.revokeObjectURL(img.preview);
    if (img.id) editing.removed.push(img);
    editing.dirty = true;
    renderPhotos();
  }

  $('input-fotos').addEventListener('change', (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const room = MAX_PHOTOS - editing.images.length;
    if (files.length > room) {
      setMsg($('editor-msg'), `Cada trabajo admite hasta ${MAX_PHOTOS} fotos. Se agregaron solo las primeras ${Math.max(room, 0)}.`, 'info');
    }
    files.slice(0, Math.max(room, 0)).forEach((file) => {
      editing.images.push({ file, preview: URL.createObjectURL(file) });
    });
    if (files.length) editing.dirty = true;
    renderPhotos();
  });

  form.addEventListener('input', () => { if (editing) editing.dirty = true; });

  async function compress(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      throw new Error(`No se pudo leer la foto "${file.name}". Prueba con una foto JPG o PNG.`);
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error(`No se pudo procesar la foto "${file.name}".`);
    return blob;
  }

  function check({ error }) {
    if (error) throw error;
  }

  function setBusy(busy, text) {
    form.querySelectorAll('button, input, textarea, select').forEach((el) => { el.disabled = busy; });
    $('btn-guardar').textContent = busy ? 'Guardando…' : 'Guardar';
    if (text) setMsg($('editor-msg'), text, 'info');
  }

  // Guardar es reintentable: cada paso que termina bien queda anotado en `editing`,
  // así un segundo intento (p. ej. si se cortó internet) no duplica nada.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      category: form.category.value,
      published: form.published.checked,
    };
    if (!fields.title) {
      setMsg($('editor-msg'), 'Escribe un título para el trabajo.');
      return form.title.focus();
    }
    setBusy(true, 'Guardando…');
    try {
      if (editing.id) {
        check(await client.from('projects').update(fields).eq('id', editing.id));
      } else {
        const res = await client.from('projects').insert(fields).select('id').single();
        check(res);
        editing.id = res.data.id;
      }

      if (editing.removed.length) {
        check(await client.from('project_images').delete().in('id', editing.removed.map((img) => img.id)));
        const paths = editing.removed.map((img) => img.storage_path).filter(Boolean);
        editing.removed = [];
        if (paths.length) {
          const { error } = await client.storage.from(cfg.bucket).remove(paths);
          if (error) console.warn('No se pudieron borrar archivos del almacenamiento', error);
        }
      }

      const pending = editing.images.filter((img) => img.file);
      for (let n = 0; n < pending.length; n++) {
        const img = pending[n];
        setMsg($('editor-msg'), `Subiendo foto ${n + 1} de ${pending.length}…`, 'info');
        const blob = await compress(img.file);
        const path = `${editing.id}/${crypto.randomUUID()}.jpg`;
        check(await client.storage.from(cfg.bucket).upload(path, blob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        }));
        const url = client.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
        const res = await client.from('project_images')
          .insert({ project_id: editing.id, url, storage_path: path, position: editing.images.indexOf(img) })
          .select('id').single();
        check(res);
        URL.revokeObjectURL(img.preview);
        Object.assign(img, { id: res.data.id, url, storage_path: path, file: null, preview: null });
      }

      if (editing.images.length) {
        check(await client.from('project_images').upsert(
          editing.images.map((img, position) => ({
            id: img.id,
            project_id: editing.id,
            url: img.url,
            storage_path: img.storage_path || null,
            position,
          }))));
      }

      editing = null;
      setBusy(false);
      await loadList('Trabajo guardado.');
    } catch (error) {
      setBusy(false);
      renderPhotos();
      setMsg($('editor-msg'), 'No se pudo guardar: ' + friendly(error) + ' Puedes intentar de nuevo.');
    }
  });

  function leaveEditor() {
    if (editing.dirty && !confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return;
    editing.images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    editing = null;
    loadList();
  }
  $('btn-cancelar').addEventListener('click', leaveEditor);
  $('btn-volver').addEventListener('click', leaveEditor);

  $('btn-eliminar').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar "${form.title.value}" y todas sus fotos? No se puede deshacer.`)) return;
    setBusy(true, 'Eliminando…');
    try {
      const paths = [...editing.images, ...editing.removed].map((img) => img.storage_path).filter(Boolean);
      check(await client.from('projects').delete().eq('id', editing.id));
      if (paths.length) {
        const { error } = await client.storage.from(cfg.bucket).remove(paths);
        if (error) console.warn('No se pudieron borrar archivos del almacenamiento', error);
      }
      editing = null;
      setBusy(false);
      await loadList('Trabajo eliminado.');
    } catch (error) {
      setBusy(false);
      renderPhotos();
      setMsg($('editor-msg'), 'No se pudo eliminar: ' + friendly(error));
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (editing && editing.dirty) e.preventDefault();
  });

  // ───────────── Inicio ─────────────
  if (!configured) {
    show('config');
    return;
  }

  // Dentro de este callback no se deben esperar llamadas a Supabase; por eso el setTimeout.
  client.auth.onAuthStateChange((event, newSession) => {
    session = newSession;
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      setTimeout(() => show('clave'), 0);
    } else if (event === 'SIGNED_OUT') {
      setTimeout(() => { if (!editing) route(); }, 0);
    }
  });

  client.auth.getSession().then(({ data }) => {
    session = data.session;
    route();
  });
})();
