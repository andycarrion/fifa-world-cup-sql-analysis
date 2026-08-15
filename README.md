# FIFA World Cup 2026 — SQL Analytics Database

Proyecto de portfolio orientado al análisis de datos de la Copa Mundial de la FIFA 2026 mediante una base relacional en SQLite.

El modelo integra información de selecciones, estadios, jugadores, partidos, alineaciones, tiros, actuaciones colectivas y goles enriquecidos manualmente. El objetivo es permitir análisis deportivos desde distintos niveles de granularidad: torneo, partido, equipo, jugador y evento.

## Resumen del proyecto

| Indicador | Cobertura |
|---|---:|
| Selecciones | 48 |
| Estadios | 16 |
| Jugadores | 1.248 |
| Partidos | 104 |
| Alineaciones | 5.323 |
| Tiros | 2.630 |
| Actuaciones por equipo | 208 |
| Goles enriquecidos manualmente | 51 |

## Preguntas que permite analizar

- ¿Qué selecciones generaron más peligro en relación con su cantidad de tiros?
- ¿Qué equipos convirtieron más o menos goles que los esperados por su xG?
- ¿Cómo cambia el rendimiento según el ranking FIFA del rival?
- ¿Desde qué zonas, situaciones y partes del cuerpo se originaron los remates?
- ¿Qué jugadores participaron con mayor frecuencia como titulares o suplentes?
- ¿Qué impacto tuvieron las sustituciones y las formaciones iniciales?
- ¿Cómo se construyeron los goles analizados: recuperación, pelota parada, cantidad de pases y estado del marcador?

## Modelo de datos

| Tabla | Tipo | Granularidad | Fuente principal |
|---|---|---|---|
| `equipos` | Dimensión | Una fila por selección | FIFA |
| `estadios` | Dimensión | Una fila por estadio | FIFA |
| `jugadores` | Dimensión | Una fila por jugador convocado | FIFA |
| `partidos` | Hecho cabecera | Una fila por partido | FotMob |
| `alineaciones_partido` | Tabla puente | Un jugador por equipo y partido | FotMob |
| `tiros` | Hecho de evento | Un remate por jugador y partido | FotMob |
| `estadisticas_actuaciones` | Hecho agregado | Un equipo por partido | FotMob |
| `goles` | Hecho enriquecido | Un gol analizado manualmente | Análisis manual |

El identificador de los equipos utiliza el código FIFA de tres letras, como `ARG` o `FRA`. Los jugadores cuentan además con un identificador deportivo legible formado por selección y dorsal, por ejemplo `FRA6`.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `data/mundial_fifa_2026.sqlite` | Base SQLite completa |
| `docs/documentacion_tecnica.docx` | Decisiones de diseño y diccionario de datos |
| `sql/schema.sql` | Estructura lógica documentada de las ocho tablas |
| `sql/analisis.sql` | Consultas SQL para explorar rendimiento y eventos |
| `sql/controles_calidad.sql` | Controles reproducibles de cobertura y consistencia |
| `scripts/tampermonkey/` | Userscripts de extracción desde FotMob y su documentación |

## Cómo utilizar la base

### Opción 1: DBeaver

1. Descargar o clonar el repositorio.
2. Crear una conexión SQLite en DBeaver.
3. Seleccionar `data/mundial_fifa_2026.sqlite` como archivo de base de datos.
4. Abrir un editor SQL y ejecutar las consultas de la carpeta `sql`.

### Opción 2: línea de comandos

```bash
git clone https://github.com/andycarrion/fifa-world-cup-sql-analysis.git
cd fifa-world-cup-sql-analysis
sqlite3 data/mundial_fifa_2026.sqlite
```

Dentro de SQLite:

```sql
.tables

SELECT id_equipo, seleccion, grupo, confederacion
FROM equipos
ORDER BY grupo, seleccion;
```

## Scripts de extracción

La carpeta [`scripts/tampermonkey`](scripts/tampermonkey) contiene las dos versiones finales y complementarias usadas para asistir la extracción desde FotMob:

- Partido, estadísticas de actuación y alineaciones.
- Tiros individuales, con salida SQL y CSV.

Los scripts generan sentencias para revisión; no se conectan directamente con SQLite. La [documentación de instalación, uso y decisiones técnicas](scripts/tampermonkey/README.md) detalla el flujo completo.

## Visualizaciones en Power BI

El proyecto incluye un análisis visual sobre posesión, generación de peligro y porcentaje de victorias.

[Ver visualizaciones y dashboard de Power BI](visualizations/power-bi/README.md)

## Ejemplo de análisis

```sql
SELECT
    id_equipo,
    SUM(goles_favor) AS goles,
    ROUND(SUM(xg_favor), 2) AS xg,
    ROUND(SUM(goles_favor) - SUM(xg_favor), 2) AS diferencia
FROM estadisticas_actuaciones
GROUP BY id_equipo
ORDER BY diferencia DESC;
```

Esta consulta compara los goles convertidos con los goles esperados acumulados para identificar selecciones que finalizaron por encima o por debajo de su xG.

## Fuentes y proceso de construcción

- **FIFA:** equipos, jugadores y estadios.
- **FotMob:** partidos, tiros, alineaciones y estadísticas colectivas.
- **Análisis manual:** construcción de jugadas de gol, pases previos, origen, zona del remate, estado del marcador y revisión VAR.

Parte de la extracción desde FotMob fue asistida mediante una extensión de Tampermonkey que generaba sentencias `INSERT` para SQLite. Posteriormente, los resultados se comparaban con la fuente y los registros incongruentes se descartaban manualmente.

## Criterios de calidad y limitaciones

- El valor `0` representa una cantidad observada sin ocurrencias.
- `NULL` indica que el dato no existe, no sucedió o no estuvo disponible.
- Las coordenadas de los tiros conservan la escala nativa de FotMob.
- La tabla `goles` contiene 51 eventos enriquecidos y constituye una muestra incompleta debido al trabajo manual requerido.
- Para medir la conversión total del torneo se recomienda utilizar `tiros` filtrando `resultado = 'Goal'`.
- `sql/schema.sql` representa la estructura lógica documentada y corregida del proyecto.

## Próximas mejoras

- Incorporar el diagrama entidad–relación.
- Agregar notebooks de análisis exploratorio.
- Publicar visualizaciones o un dashboard interactivo.
- Ampliar el enriquecimiento manual de la tabla `goles`.

## Autor

**Andrés Carrión** — Estudiante de Licenciatura en Ciencia de Datos. https://www.linkedin.com/in/andr%C3%A9s-j-n-carri%C3%B3n/

Proyecto desarrollado con fines educativos y de portfolio. FIFA y FotMob conservan los derechos sobre sus marcas y contenidos originales; este repositorio no está afiliado oficialmente con dichas organizaciones.
