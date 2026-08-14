-- Consultas analíticas de ejemplo
-- Ejecutar sobre data/mundial_fifa_2026.sqlite

-- 1. Eficacia ofensiva acumulada por selección
SELECT
    id_equipo,
    SUM(goles_favor) AS goles,
    ROUND(SUM(xg_favor), 2) AS xg,
    ROUND(SUM(goles_favor) - SUM(xg_favor), 2) AS diferencia_goles_xg
FROM estadisticas_actuaciones
GROUP BY id_equipo
ORDER BY diferencia_goles_xg DESC;

-- 2. Producción ofensiva promedio por partido
SELECT
    id_equipo,
    COUNT(*) AS partidos,
    ROUND(AVG(xg_favor), 2) AS xg_promedio,
    ROUND(AVG(tiros_favor), 2) AS tiros_promedio,
    ROUND(AVG(tiros_arco_favor), 2) AS tiros_arco_promedio,
    ROUND(AVG(big_chances_favor), 2) AS grandes_ocasiones_promedio
FROM estadisticas_actuaciones
GROUP BY id_equipo
ORDER BY xg_promedio DESC;

-- 3. Rendimiento ante rivales mejor posicionados en el ranking FIFA
SELECT
    id_equipo,
    COUNT(*) AS partidos,
    ROUND(AVG(goles_favor), 2) AS goles_promedio,
    ROUND(AVG(xg_favor), 2) AS xg_promedio,
    ROUND(AVG(goles_contra), 2) AS goles_contra_promedio
FROM estadisticas_actuaciones
WHERE ranking_rival < ranking_equipo
GROUP BY id_equipo
ORDER BY xg_promedio DESC;

-- 4. Distribución de tiros por situación
SELECT
    situacion,
    COUNT(*) AS tiros,
    SUM(CASE WHEN resultado = 'Goal' THEN 1 ELSE 0 END) AS goles,
    ROUND(AVG(xg), 3) AS xg_promedio,
    ROUND(
        100.0 * SUM(CASE WHEN resultado = 'Goal' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS conversion_pct
FROM tiros
GROUP BY situacion
ORDER BY tiros DESC;

-- 5. Calidad de remates según parte del cuerpo
SELECT
    tipo_tiro,
    COUNT(*) AS tiros,
    ROUND(AVG(xg), 3) AS xg_promedio,
    SUM(CASE WHEN es_al_arco = 1 THEN 1 ELSE 0 END) AS tiros_al_arco,
    SUM(CASE WHEN resultado = 'Goal' THEN 1 ELSE 0 END) AS goles
FROM tiros
GROUP BY tipo_tiro
ORDER BY tiros DESC;

-- 6. Jugadores con mayor volumen de tiro
SELECT
    t.id_jugador,
    j.nombre_planilla,
    t.id_equipo,
    COUNT(*) AS tiros,
    ROUND(SUM(COALESCE(t.xg, 0)), 2) AS xg_total,
    SUM(CASE WHEN t.resultado = 'Goal' THEN 1 ELSE 0 END) AS goles
FROM tiros AS t
JOIN jugadores AS j
    ON j.id_jugador = t.id_jugador
GROUP BY t.id_jugador, j.nombre_planilla, t.id_equipo
ORDER BY tiros DESC, xg_total DESC;

-- 7. Suplentes utilizados y minuto medio de ingreso
SELECT
    a.id_jugador,
    j.nombre_planilla,
    a.id_equipo,
    COUNT(*) AS partidos_ingresando,
    ROUND(AVG(a.minuto_ingreso), 1) AS minuto_ingreso_promedio
FROM alineaciones_partido AS a
JOIN jugadores AS j
    ON j.id_jugador = a.id_jugador
WHERE a.condicion = 'suplente'
  AND a.jugo = 1
GROUP BY a.id_jugador, j.nombre_planilla, a.id_equipo
ORDER BY partidos_ingresando DESC, minuto_ingreso_promedio;

-- 8. Efectividad de los equipos dentro y fuera del área
SELECT
    id_equipo,
    es_dentro_area,
    COUNT(*) AS tiros,
    SUM(CASE WHEN resultado = 'Goal' THEN 1 ELSE 0 END) AS goles,
    ROUND(AVG(xg), 3) AS xg_promedio
FROM tiros
GROUP BY id_equipo, es_dentro_area
ORDER BY id_equipo, es_dentro_area DESC;

-- 9. Construcción de los goles enriquecidos manualmente
SELECT
    comienzo_jugada,
    COUNT(*) AS goles_analizados,
    ROUND(AVG(pases_previos), 1) AS pases_previos_promedio
FROM goles
GROUP BY comienzo_jugada
ORDER BY goles_analizados DESC;

-- 10. Estadios con mayor asistencia promedio
SELECT
    e.nombre AS estadio,
    e.ciudad,
    e.pais,
    COUNT(*) AS partidos,
    ROUND(AVG(p.espectadores), 0) AS asistencia_promedio
FROM partidos AS p
JOIN estadios AS e
    ON e.id = p.id_estadio
GROUP BY e.id, e.nombre, e.ciudad, e.pais
ORDER BY asistencia_promedio DESC;
