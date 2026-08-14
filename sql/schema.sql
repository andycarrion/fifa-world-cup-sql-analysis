-- FIFA World Cup 2026 — esquema lógico documentado
-- Motor: SQLite
-- Las relaciones de partido apuntan a partidos(id).
-- Las relaciones de jugador utilizan jugadores(id_jugador).

PRAGMA foreign_keys = ON;

CREATE TABLE equipos (
    id_equipo       TEXT PRIMARY KEY CHECK (length(id_equipo) = 3),
    seleccion       TEXT NOT NULL UNIQUE,
    grupo           TEXT CHECK (grupo IN ('A','B','C','D','E','F','G','H','I','J','K','L')),
    confederacion   TEXT NOT NULL
                    CHECK (confederacion IN ('UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC')),
    dt_nombre       TEXT,
    dt_nacionalidad TEXT
);

CREATE TABLE estadios (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT NOT NULL,
    ciudad    TEXT NOT NULL,
    pais      TEXT NOT NULL,
    capacidad INTEGER CHECK (capacidad > 0)
);

CREATE TABLE jugadores (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    id_jugador         TEXT GENERATED ALWAYS AS (id_equipo || dorsal) STORED UNIQUE,
    id_equipo          TEXT NOT NULL REFERENCES equipos(id_equipo),
    dorsal             INTEGER CHECK (dorsal BETWEEN 1 AND 26),
    posicion           TEXT NOT NULL CHECK (posicion IN ('GK','DF','MF','FW')),
    nombre_planilla    TEXT NOT NULL,
    primer_nombre      TEXT NOT NULL,
    apellido           TEXT NOT NULL,
    nombre_camiseta    TEXT NOT NULL,
    fecha_nacimiento   DATE,
    club               TEXT,
    altura_cm          REAL CHECK (altura_cm BETWEEN 140 AND 220),
    partidos_seleccion INTEGER DEFAULT 0 CHECK (partidos_seleccion >= 0),
    goles_seleccion    INTEGER DEFAULT 0 CHECK (goles_seleccion >= 0)
);

CREATE TABLE partidos (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    id_equipo_local      TEXT NOT NULL REFERENCES equipos(id_equipo),
    goles_local          INTEGER DEFAULT 0,
    xg_local             REAL,
    xgot_local           REAL,
    id_equipo_visitante  TEXT NOT NULL REFERENCES equipos(id_equipo),
    goles_visitante      INTEGER DEFAULT 0,
    xg_visitante         REAL,
    xgot_visitante       REAL,
    formacion_local      TEXT,
    formacion_visitante  TEXT,
    id_estadio           INTEGER NOT NULL REFERENCES estadios(id),
    fecha                DATE NOT NULL,
    fase                 TEXT NOT NULL,
    arbitro              TEXT,
    espectadores         INTEGER,
    hubo_penales         INTEGER DEFAULT 0 CHECK (hubo_penales IN (0,1)),
    penales_local        INTEGER,
    penales_visitante    INTEGER,
    CHECK (id_equipo_local <> id_equipo_visitante)
);

CREATE TABLE alineaciones_partido (
    id_partido                 INTEGER NOT NULL REFERENCES partidos(id),
    id_equipo                  TEXT NOT NULL REFERENCES equipos(id_equipo),
    id_jugador                 TEXT NOT NULL REFERENCES jugadores(id_jugador),
    id_rival                   TEXT NOT NULL REFERENCES equipos(id_equipo),
    condicion                  TEXT NOT NULL CHECK (condicion IN ('titular','suplente')),
    jugo                       INTEGER NOT NULL DEFAULT 0 CHECK (jugo IN (0,1)),
    minuto_ingreso             INTEGER,
    minuto_salida              INTEGER,
    id_jugador_reemplaza_a     TEXT REFERENCES jugadores(id_jugador),
    id_jugador_reemplazado_por TEXT REFERENCES jugadores(id_jugador),
    posicion_general           TEXT CHECK (posicion_general IN ('GK','DF','MF','FW')),
    posicion_detalle           TEXT,
    PRIMARY KEY (id_partido, id_equipo, id_jugador)
);

CREATE TABLE tiros (
    id_tiro         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partido      INTEGER NOT NULL REFERENCES partidos(id),
    id_equipo       TEXT NOT NULL REFERENCES equipos(id_equipo),
    id_jugador      TEXT NOT NULL REFERENCES jugadores(id_jugador),
    id_arquero      TEXT REFERENCES jugadores(id_jugador),
    minuto          INTEGER,
    minuto_adicional INTEGER,
    resultado       TEXT NOT NULL,
    xg              REAL,
    xgot            REAL,
    coordenada_x    REAL,
    coordenada_y    REAL,
    goal_crossed_y  REAL,
    goal_crossed_z  REAL,
    on_goal_shot_x  REAL,
    on_goal_shot_y  REAL,
    tipo_tiro       TEXT,
    situacion       TEXT,
    periodo         TEXT,
    es_al_arco      INTEGER CHECK (es_al_arco IN (0,1)),
    es_dentro_area  INTEGER CHECK (es_dentro_area IN (0,1)),
    id_equipo_gol   TEXT REFERENCES equipos(id_equipo)
);

CREATE TABLE estadisticas_actuaciones (
    id_partido                     INTEGER NOT NULL REFERENCES partidos(id),
    id_equipo                      TEXT NOT NULL REFERENCES equipos(id_equipo),
    id_rival                       TEXT NOT NULL REFERENCES equipos(id_equipo),
    ranking_equipo                 INTEGER,
    ranking_rival                  INTEGER,
    goles_favor                    INTEGER DEFAULT 0,
    goles_contra                   INTEGER DEFAULT 0,
    xg_favor                       REAL DEFAULT 0,
    xg_contra                      REAL DEFAULT 0,
    tiros_favor                    INTEGER DEFAULT 0,
    tiros_contra                   INTEGER DEFAULT 0,
    tiros_arco_favor               INTEGER DEFAULT 0,
    tiros_arco_contra              INTEGER DEFAULT 0,
    big_chances_favor              INTEGER DEFAULT 0,
    big_chances_contra             INTEGER DEFAULT 0,
    big_chances_missed             INTEGER DEFAULT 0,
    toques_area_rival              INTEGER DEFAULT 0,
    toques_area_propia_concedidos  INTEGER DEFAULT 0,
    posesion                       REAL DEFAULT 0,
    pases_totales                  INTEGER DEFAULT 0,
    pases_acertados                INTEGER DEFAULT 0,
    precision_pases                REAL DEFAULT 0,
    recuperaciones                 INTEGER DEFAULT 0,
    intercepciones                 INTEGER DEFAULT 0,
    faltas                         INTEGER DEFAULT 0,
    tarjetas_amarillas             INTEGER DEFAULT 0,
    tarjetas_rojas                 INTEGER DEFAULT 0,
    PRIMARY KEY (id_partido, id_equipo)
);

CREATE TABLE goles (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partido          INTEGER NOT NULL REFERENCES partidos(id),
    id_goleador         TEXT NOT NULL REFERENCES jugadores(id_jugador),
    id_asistidor        TEXT REFERENCES jugadores(id_jugador),
    id_arquero_rival    TEXT REFERENCES jugadores(id_jugador),
    id_equipo           TEXT NOT NULL REFERENCES equipos(id_equipo),
    id_equipo_rival     TEXT NOT NULL REFERENCES equipos(id_equipo),
    minuto              INTEGER NOT NULL CHECK (minuto BETWEEN 1 AND 120),
    minuto_adicional    INTEGER DEFAULT 0 CHECK (minuto_adicional >= 0),
    tipo_gol            TEXT NOT NULL,
    comienzo_jugada     TEXT NOT NULL,
    lugar_disparo       TEXT NOT NULL,
    pases_previos       INTEGER DEFAULT 0 CHECK (pases_previos >= 0),
    goles_equipo_antes  INTEGER NOT NULL DEFAULT 0 CHECK (goles_equipo_antes >= 0),
    goles_rival_antes   INTEGER NOT NULL DEFAULT 0 CHECK (goles_rival_antes >= 0),
    var_resultado       TEXT NOT NULL DEFAULT 'sin_revision',
    es_autogol          INTEGER NOT NULL DEFAULT 0 CHECK (es_autogol IN (0,1)),
    CHECK (id_equipo <> id_equipo_rival)
);
