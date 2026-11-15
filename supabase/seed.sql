-- PV Servicios · trabajos iniciales (los mismos de la página anterior).
-- Ejecutar UNA vez, después de schema.sql. Las fotos son las que ya vienen en
-- la carpeta images/ del sitio, por eso no tienen storage_path.

with nuevos as (
  insert into public.projects (title, description, category, created_at)
  values
    ('Construcción Duplex',
     'Creación de departamento de interior con dos pisos, 3 habitaciones, cocina, living-comedor y baño',
     'hogar', now() - interval '2 minutes'),
    ('Reparación de Baño',
     'Renovación de ventilación en baño principal',
     'hogar', now() - interval '1 minute'),
    ('Construcción carro',
     'Carro para venta de pescadería en ferias libres',
     'carros', now())
  returning id, title
),
fotos (title, url, position) as (
  values
    ('Construcción Duplex', 'images/casa6.jpg', 0),
    ('Construcción Duplex', 'images/casa5.jpg', 1),
    ('Construcción Duplex', 'images/casa1.jpg', 2),
    ('Construcción Duplex', 'images/casa2.jpg', 3),
    ('Construcción Duplex', 'images/casa3.jpg', 4),
    ('Construcción Duplex', 'images/casa4.jpg', 5),
    ('Construcción Duplex', 'images/casa7.jpg', 6),
    ('Reparación de Baño', 'images/bano.jpg', 0),
    ('Reparación de Baño', 'images/ventilacion.jpg', 1),
    ('Reparación de Baño', 'images/ventilacion2.jpg', 2),
    ('Reparación de Baño', 'images/ventilacion3.jpg', 3),
    ('Construcción carro', 'images/carro6.jpg', 0),
    ('Construcción carro', 'images/carro2.jpg', 1),
    ('Construcción carro', 'images/carro3.jpg', 2),
    ('Construcción carro', 'images/carro4.jpg', 3),
    ('Construcción carro', 'images/carro5.jpg', 4),
    ('Construcción carro', 'images/carro7.jpg', 5),
    ('Construcción carro', 'images/carro1.jpg', 6)
)
insert into public.project_images (project_id, url, position)
select n.id, f.url, f.position
from fotos f
join nuevos n on n.title = f.title;
