-- Actualiza únicamente las etiquetas visibles de los tres cuerpos solicitados.
UPDATE public.bodies
SET description = 'Real Arco, Crípticos y Comandancias'
WHERE id = 'york';

UPDATE public.bodies
SET description = 'Órgano rector del rito Escocés Antiguo y Aceptado'
WHERE id = 'supremo_consejo';

UPDATE public.bodies
SET short_name = 'Abou Saad',
    description = 'Shriners International'
WHERE id = 'shriners';
