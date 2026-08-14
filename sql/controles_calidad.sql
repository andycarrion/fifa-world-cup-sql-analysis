-- Controles de calidad y cobertura
-- Cada consulta debería devolver el resultado indicado en su comentario.

-- 1. Cobertura de las tablas principales
SELECT 'equipos' AS tabla, COUNT(*) AS registros FROM equipos
UNION ALL SELECT 'estadios', COUNT(*) FROM estadios
UNION ALL SELECT 'jugadores', COUNT(*) FROM jugadores
UNION ALL SELECT 'partidos', COUNT(*) FROM partidos
UNION ALL SELECT 'alineaciones_partido', COUNT(*) FROM alineaciones_partido
UNION ALL SELECT 'tiros', COUNT(*) FROM tiros
UNION ALL SELECT 'estadisticas_actuaciones', COUNT(*) FROM estadisticas_actuaciones
UNION ALL SELECT 'goles', COUNT(*) FROM goles;

-- 2. Equipos con códigos distintos de tres caracteres — esperado: 0 filas
SELECT id_equipo, seleccion
FROM equipos
WHERE length(id_equipo) <> 3;

-- 3. Jugadores duplicados por selección y dorsal — esperado: 0 filas
SELECT id_equipo, dorsal, COUNT(*) AS cantidad
FROM jugadores
GROUP BY id_equipo, dorsal
HAVING COUNT(*) > 1;

-- 4. Partidos con el mismo equipo como local y visitante — esperado: 0 filas
SELECT id, id_equipo_local, id_equipo_visitante
FROM partidos
WHERE id_equipo_local = id_equipo_visitante;

-- 5. Partidos sin dos actuaciones colectivas — esperado: 0 filas
SELECT p.id, COUNT(ea.id_equipo) AS actuaciones
FROM partidos AS p
LEFT JOIN estadisticas_actuaciones AS ea
    ON ea.id_partido = p.id
GROUP BY p.id
HAVING COUNT(ea.id_equipo) <> 2;

-- 6. Tiros cuyo equipo no participó en el partido — esperado: 0 filas
SELECT t.id_tiro, t.id_partido, t.id_equipo
FROM tiros AS t
JOIN partidos AS p
    ON p.id = t.id_partido
WHERE t.id_equipo NOT IN (p.id_equipo_local, p.id_equipo_visitante);

-- 7. Tiros con jugador inexistente — esperado: 0 filas
SELECT t.id_tiro, t.id_jugador
FROM tiros AS t
LEFT JOIN jugadores AS j
    ON j.id_jugador = t.id_jugador
WHERE j.id_jugador IS NULL;

-- 8. Alineaciones con jugador de otra selección — esperado: 0 filas
SELECT a.id_partido, a.id_equipo, a.id_jugador
FROM alineaciones_partido AS a
JOIN jugadores AS j
    ON j.id_jugador = a.id_jugador
WHERE j.id_equipo <> a.id_equipo;

-- 9. Valores fuera de rango para probabilidades xG — esperado: 0 filas
SELECT id_tiro, xg, xgot
FROM tiros
WHERE (xg IS NOT NULL AND (xg < 0 OR xg > 1))
   OR (xgot IS NOT NULL AND xgot < 0);

-- 10. Distribución de goles: tabla completa de tiros vs. muestra manual
SELECT
    (SELECT COUNT(*) FROM tiros WHERE resultado = 'Goal') AS goles_en_tiros,
    (SELECT COUNT(*) FROM goles) AS goles_enriquecidos_manualmente;
