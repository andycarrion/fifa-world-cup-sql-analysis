// ==UserScript==
// @name         FotMob Tiros SQL desde NEXT_DATA
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Extrae tiros desde __NEXT_DATA__ de FotMob y genera INSERT INTO tiros en formato VALUES múltiple
// @match        https://www.fotmob.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const COUNTRY_BY_TEAM_NAME = {
        // Grupo A
        'Mexico': 'MEX',
        'South Africa': 'RSA',
        'South Korea': 'KOR',
        'Korea Republic': 'KOR',
        'Czechia': 'CZE',
        'Czech Republic': 'CZE',

        // Grupo B
        'Canada': 'CAN',
        'Bosnia and Herzegovina': 'BIH',
        'Qatar': 'QAT',
        'Switzerland': 'SUI',

        // Grupo C
        'Brazil': 'BRA',
        'Morocco': 'MAR',
        'Haiti': 'HAI',
        'Scotland': 'SCO',

        // Grupo D
        'United States': 'USA',
        'USA': 'USA',
        'Paraguay': 'PAR',
        'Australia': 'AUS',
        'Turkey': 'TUR',
        'Türkiye': 'TUR',

        // Grupo E
        'Germany': 'GER',
        'Curacao': 'CUW',
        'Curaçao': 'CUW',
        'Ivory Coast': 'CIV',
        'Côte d’Ivoire': 'CIV',
        'Cote dIvoire': 'CIV',
        'Ecuador': 'ECU',

        // Grupo F
        'Netherlands': 'NED',
        'Japan': 'JPN',
        'Sweden': 'SWE',
        'Tunisia': 'TUN',

        // Grupo G
        'Belgium': 'BEL',
        'Egypt': 'EGY',
        'Iran': 'IRN',
        'New Zealand': 'NZL',

        // Grupo H
        'Spain': 'ESP',
        'Cape Verde': 'CPV',
        'Saudi Arabia': 'KSA',
        'Uruguay': 'URU',

        // Grupo I
        'France': 'FRA',
        'Senegal': 'SEN',
        'Iraq': 'IRQ',
        'Norway': 'NOR',

        // Grupo J
        'Argentina': 'ARG',
        'Algeria': 'ALG',
        'Austria': 'AUT',
        'Jordan': 'JOR',

        // Grupo K
        'Portugal': 'POR',
        'DR Congo': 'COD',
        'Congo DR': 'COD',
        'Uzbekistan': 'UZB',
        'Colombia': 'COL',

        // Grupo L
        'England': 'ENG',
        'Croatia': 'CRO',
        'Ghana': 'GHA',
        'Panama': 'PAN'
    };

    function getNextData() {
        const script = document.querySelector('#__NEXT_DATA__');

        if (!script) {
            throw new Error('No encontré #__NEXT_DATA__ en la página.');
        }

        const nextData = JSON.parse(script.textContent);
        const pageProps = nextData?.props?.pageProps;

        if (!pageProps) {
            throw new Error('No encontré nextData.props.pageProps.');
        }

        return pageProps;
    }

    function sqlText(value) {
        if (value === undefined || value === null || value === '') return 'NULL';

        const clean = String(value)
            .replaceAll("'", "''")
            .trim();

        return `'${clean}'`;
    }

    function sqlNumber(value) {
        if (value === undefined || value === null || value === '') return 'NULL';

        const n = Number(value);

        return Number.isNaN(n) ? 'NULL' : String(n);
    }

    function boolToInt(value) {
        return value ? 1 : 0;
    }

    function normalizeShirtNumber(value) {
        if (value === undefined || value === null || value === '') return '';

        const number = Number(value);

        if (Number.isNaN(number)) {
            return String(value).replace(/^0+/, '');
        }

        return number;
    }

    function buildLocalPlayerId(countryCode, shirtNumberRaw) {
        const shirtNumber = normalizeShirtNumber(shirtNumberRaw);

        if (!countryCode || shirtNumber === '') return '';

        return `${countryCode}${shirtNumber}`;
    }

    function getTeamCodeMap(data) {
        const homeTeam = data?.general?.homeTeam || {};
        const awayTeam = data?.general?.awayTeam || {};

        const teamCodeMap = {};

        if (homeTeam.id) {
            teamCodeMap[homeTeam.id] = COUNTRY_BY_TEAM_NAME[homeTeam.name] || homeTeam.name;
        }

        if (awayTeam.id) {
            teamCodeMap[awayTeam.id] = COUNTRY_BY_TEAM_NAME[awayTeam.name] || awayTeam.name;
        }

        return teamCodeMap;
    }

    function isPlayerLike(obj) {
        if (!obj || typeof obj !== 'object') return false;

        const hasId = obj.id || obj.playerId;

        const hasShirt =
            obj.shirtNumber !== undefined ||
            obj.shirt !== undefined ||
            obj.number !== undefined;

        const hasName =
            obj.name ||
            obj.fullName ||
            obj.firstName ||
            obj.lastName ||
            obj.nameStr;

        return Boolean(hasId && hasShirt && hasName);
    }

    function getPlayerId(obj) {
        return obj.id || obj.playerId || null;
    }

    function getPlayerShirtNumber(obj) {
        return obj.shirtNumber ?? obj.shirt ?? obj.number ?? '';
    }

    function collectPlayersDeep(value, playerMap, context) {
        if (!value) return;

        if (Array.isArray(value)) {
            value.forEach(item => collectPlayersDeep(item, playerMap, context));
            return;
        }

        if (typeof value !== 'object') return;

        let nextContext = { ...context };

        if (value.teamId && context.teamCodeMap[value.teamId]) {
            nextContext.teamCode = context.teamCodeMap[value.teamId];
        }

        if (value.team?.id && context.teamCodeMap[value.team.id]) {
            nextContext.teamCode = context.teamCodeMap[value.team.id];
        }

        if (
            value.id &&
            context.teamCodeMap[value.id] &&
            value.name &&
            !getPlayerShirtNumber(value)
        ) {
            nextContext.teamCode = context.teamCodeMap[value.id];
        }

        if (isPlayerLike(value)) {
            const playerId = getPlayerId(value);
            const shirtNumber = getPlayerShirtNumber(value);

            const explicitCountryCode =
                value.countryCode ||
                value.ccode ||
                value.teamCode ||
                '';

            const countryCode = explicitCountryCode || nextContext.teamCode || '';
            const idJugador = buildLocalPlayerId(countryCode, shirtNumber);

            if (playerId && idJugador) {
                playerMap[playerId] = {
                    fotmob_player_id: playerId,
                    id_jugador: idJugador,
                    dorsal: normalizeShirtNumber(shirtNumber),
                    countryCode: countryCode,
                    raw: value
                };
            }
        }

        for (const [key, child] of Object.entries(value)) {
            let childContext = { ...nextContext };

            const keyLower = key.toLowerCase();

            if (keyLower.includes('hometeam')) {
                childContext.teamCode = context.homeCode;
            }

            if (keyLower.includes('awayteam')) {
                childContext.teamCode = context.awayCode;
            }

            collectPlayersDeep(child, playerMap, childContext);
        }
    }

    function buildPlayerMap(data, teamCodeMap) {
        const playerMap = {};

        const homeTeamId = data?.general?.homeTeam?.id;
        const awayTeamId = data?.general?.awayTeam?.id;

        const context = {
            teamCodeMap,
            homeCode: teamCodeMap[homeTeamId] || '',
            awayCode: teamCodeMap[awayTeamId] || '',
            teamCode: ''
        };

        collectPlayersDeep(data?.content?.lineup, playerMap, context);

        // Backup por si algún jugador aparece en otra parte del contenido.
        collectPlayersDeep(data?.content, playerMap, context);

        return playerMap;
    }

    function getShots(data) {
        const directPaths = [
            data?.content?.shotmap?.shots,
            data?.content?.shotmap?.Shots,
            data?.content?.shotmap?.Periods?.All,
            data?.content?.shotmap?.periods?.All,
            data?.content?.shotmap?.Periods?.all,
            data?.content?.shotmap?.periods?.all,
            data?.content?.shotmap?.Periods?.FirstHalf,
            data?.content?.shotmap?.Periods?.SecondHalf,
            data?.content?.shotmap?.periods?.FirstHalf,
            data?.content?.shotmap?.periods?.SecondHalf,
            data?.content?.matchFacts?.shotmap,
            data?.content?.matchFacts?.shotmap?.shots,
            data?.content?.stats?.shotmap,
            data?.content?.stats?.shotmap?.shots
        ];

        for (const path of directPaths) {
            if (Array.isArray(path) && path.length > 0) {
                console.log('Tiros encontrados en ruta directa:', path);
                return path;
            }
        }

        const shotmap = data?.content?.shotmap;

        if (shotmap && typeof shotmap === 'object') {
            const periodArrays = [];

            function collectShotmapArrays(value, path = 'content.shotmap') {
                if (!value) return;

                if (Array.isArray(value)) {
                    if (value.some(isShotLike)) {
                        periodArrays.push({
                            path,
                            value
                        });
                    }
                    return;
                }

                if (typeof value === 'object') {
                    Object.entries(value).forEach(([key, child]) => {
                        collectShotmapArrays(child, `${path}.${key}`);
                    });
                }
            }

            collectShotmapArrays(shotmap);

            if (periodArrays.length > 0) {
                console.log('Tiros encontrados dentro de shotmap:', periodArrays);

                const merged = periodArrays.flatMap(item => item.value);

                const uniqueById = [];
                const seen = new Set();

                merged.forEach(shot => {
                    const key = shot.id ?? `${shot.playerId}-${shot.teamId}-${shot.min}-${shot.x}-${shot.y}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueById.push(shot);
                    }
                });

                return uniqueById;
            }
        }

        const candidates = [];

        function isShotLike(item) {
            if (!item || typeof item !== 'object') return false;

            const hasPlayer =
                item.playerId !== undefined ||
                item.playerName !== undefined ||
                item.player?.id !== undefined;

            const hasTeam =
                item.teamId !== undefined ||
                item.team?.id !== undefined;

            const hasMinute =
                item.min !== undefined ||
                item.minute !== undefined ||
                item.time !== undefined;

            const hasXg =
                item.expectedGoals !== undefined ||
                item.expectedGoalsOnTarget !== undefined ||
                item.xg !== undefined ||
                item.xG !== undefined;

            const hasCoordinates =
                item.x !== undefined &&
                item.y !== undefined;

            const hasResult =
                item.eventType !== undefined ||
                item.result !== undefined ||
                item.outcome !== undefined;

            const hasShotType =
                item.shotType !== undefined ||
                item.situation !== undefined;

            return (
                hasPlayer &&
                hasTeam &&
                (
                    hasXg ||
                    hasCoordinates ||
                    hasResult ||
                    hasMinute ||
                    hasShotType
                )
            );
        }

        function walk(value, path = '') {
            if (!value) return;

            if (Array.isArray(value)) {
                const shotLikeCount = value.filter(isShotLike).length;

                if (
                    value.length > 0 &&
                    shotLikeCount >= Math.max(1, Math.floor(value.length * 0.5))
                ) {
                    candidates.push({
                        path,
                        value,
                        shotLikeCount,
                        length: value.length
                    });
                }

                value.forEach((item, index) => {
                    walk(item, `${path}[${index}]`);
                });

                return;
            }

            if (typeof value === 'object') {
                Object.entries(value).forEach(([key, child]) => {
                    walk(child, path ? `${path}.${key}` : key);
                });
            }
        }

        walk(data);

        console.log('Candidatos de tiros encontrados:', candidates);

        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (b.shotLikeCount !== a.shotLikeCount) {
                    return b.shotLikeCount - a.shotLikeCount;
                }

                return b.length - a.length;
            });

            console.log('Usando candidato:', candidates[0].path, candidates[0].value);
            return candidates[0].value;
        }

        console.log('No encontré tiros. Revisá estas claves principales:');
        console.log('data:', data);
        console.log('data.content:', data?.content);
        console.log('data.content.shotmap:', data?.content?.shotmap);
        console.log('data.content.matchFacts:', data?.content?.matchFacts);
        console.log('data.content.stats:', data?.content?.stats);
        console.log('Tiene expectedGoals:', JSON.stringify(data).includes('expectedGoals'));
        console.log('Tiene shotmap:', JSON.stringify(data).includes('shotmap'));

        return [];
    }

    function normalizeShot(shot, playerMap, teamCodeMap, manualMatchId) {
        const playerId = shot.playerId ?? shot.player?.id ?? null;
        const keeperId = shot.keeperId ?? shot.keeper?.id ?? null;
        const teamId = shot.teamId ?? shot.team?.id ?? null;

        const shooter = playerMap[playerId] || {};
        const keeper = playerMap[keeperId] || {};

        return {
            id_partido: manualMatchId,
            id_equipo: teamCodeMap[teamId] || '',

            id_jugador: shooter.id_jugador || '',
            id_arquero: keeper.id_jugador || '',

            minuto: shot.min ?? shot.minute ?? null,
            minuto_adicional: shot.minAdded ?? shot.addedTime ?? null,

            resultado: shot.eventType ?? shot.result ?? shot.outcome ?? '',
            xg: shot.expectedGoals ?? shot.xg ?? shot.xG ?? null,
            xgot: shot.expectedGoalsOnTarget ?? shot.xgot ?? shot.xGOT ?? null,

            coordenada_x: shot.x ?? null,
            coordenada_y: shot.y ?? null,

            goal_crossed_y: shot.goalCrossedY ?? null,
            goal_crossed_z: shot.goalCrossedZ ?? null,

            on_goal_shot_x: shot.onGoalShot?.x ?? null,
            on_goal_shot_y: shot.onGoalShot?.y ?? null,

            tipo_tiro: shot.shotType ?? '',
            situacion: shot.situation ?? '',
            periodo: shot.period ?? '',

            es_al_arco: boolToInt(shot.isOnTarget),
            es_dentro_area: boolToInt(shot.isFromInsideBox),

            // Solo para depuración en consola. No van al SQL.
            _jugador: shot.playerName ?? shot.player?.name ?? '',
            _playerIdFotMob: playerId,
            _keeperIdFotMob: keeperId,
            _shotIdFotMob: shot.id
        };
    }

    function toSqlValueTuple(row) {
        return `(
    ${sqlNumber(row.id_partido)},
    ${sqlText(row.id_equipo)},
    ${sqlText(row.id_jugador)},
    ${sqlText(row.id_arquero)},
    ${sqlNumber(row.minuto)},
    ${sqlNumber(row.minuto_adicional)},
    ${sqlText(row.resultado)},
    ${sqlNumber(row.xg)},
    ${sqlNumber(row.xgot)},
    ${sqlNumber(row.coordenada_x)},
    ${sqlNumber(row.coordenada_y)},
    ${sqlNumber(row.goal_crossed_y)},
    ${sqlNumber(row.goal_crossed_z)},
    ${sqlNumber(row.on_goal_shot_x)},
    ${sqlNumber(row.on_goal_shot_y)},
    ${sqlText(row.tipo_tiro)},
    ${sqlText(row.situacion)},
    ${sqlText(row.periodo)},
    ${sqlNumber(row.es_al_arco)},
    ${sqlNumber(row.es_dentro_area)}
)`;
    }

    function toSql(rows) {
        const columns = `INSERT INTO tiros (
    id_partido,
    id_equipo,
    id_jugador,
    id_arquero,
    minuto,
    minuto_adicional,
    resultado,
    xg,
    xgot,
    coordenada_x,
    coordenada_y,
    goal_crossed_y,
    goal_crossed_z,
    on_goal_shot_x,
    on_goal_shot_y,
    tipo_tiro,
    situacion,
    periodo,
    es_al_arco,
    es_dentro_area
)
VALUES`;

        const values = rows.map(toSqlValueTuple).join(',\n');

        return `${columns}\n${values};`;
    }

    function toCsv(rows) {
        if (!rows.length) return '';

        const cleanRows = rows.map(row => {
            const copy = { ...row };

            delete copy._jugador;
            delete copy._playerIdFotMob;
            delete copy._keeperIdFotMob;
            delete copy._shotIdFotMob;

            return copy;
        });

        const headers = Object.keys(cleanRows[0]);

        const escapeCsv = value => {
            const text = String(value ?? '');
            return `"${text.replaceAll('"', '""')}"`;
        };

        return [
            headers.join(','),
            ...cleanRows.map(row => headers.map(h => escapeCsv(row[h])).join(','))
        ].join('\n');
    }

    function downloadFile(filename, content, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    function askManualMatchId() {
        const value = prompt(
            'Ingresá el id_partido de tu base local.\n\nEste valor reemplaza al matchId de FotMob.',
            ''
        );

        if (value === null) return null;

        const clean = value.trim();

        if (!clean) return null;

        const n = Number(clean);

        if (Number.isNaN(n)) {
            alert('El id_partido debe ser numérico.');
            return null;
        }

        return n;
    }

    function createPanel(rows, csv, sql, warnings, manualMatchId) {
        const oldPanel = document.getElementById('fotmob-nextdata-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'fotmob-nextdata-panel';
        panel.style.position = 'fixed';
        panel.style.top = '70px';
        panel.style.right = '20px';
        panel.style.zIndex = '999999';
        panel.style.width = '640px';
        panel.style.maxHeight = '80vh';
        panel.style.overflow = 'auto';
        panel.style.background = '#111';
        panel.style.color = '#fff';
        panel.style.padding = '14px';
        panel.style.borderRadius = '10px';
        panel.style.boxShadow = '0 4px 20px rgba(0,0,0,.4)';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.fontSize = '13px';

        panel.innerHTML = `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:10px;
                gap:10px;
            ">
                <strong>FotMob - Tiros SQL desde NEXT_DATA</strong>

                <button id="close-nextdata-panel" style="
                    cursor:pointer;
                    background:#c0392b;
                    color:#fff;
                    border:none;
                    border-radius:6px;
                    padding:8px 12px;
                    font-weight:bold;
                    font-size:13px;
                ">
                    Cerrar
                </button>
            </div>

            <p>
                ID partido manual: <strong>${manualMatchId}</strong><br>
                Tiros encontrados: <strong>${rows.length}</strong><br>
                Sin id_jugador: <strong>${warnings.missingPlayers}</strong><br>
                Sin id_arquero: <strong>${warnings.missingKeepers}</strong>
            </p>

            <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">
                <button id="copy-full-script" style="
                    cursor:pointer;
                    background:#0b6;
                    color:#fff;
                    border:none;
                    border-radius:6px;
                    padding:8px 10px;
                    font-weight:bold;
                ">
                    Copiar todo el script
                </button>

                <button id="select-full-script" style="cursor:pointer;">
                    Seleccionar todo
                </button>

                <button id="download-sql" style="cursor:pointer;">
                    Descargar SQL
                </button>

                <button id="copy-csv" style="cursor:pointer;">
                    Copiar CSV
                </button>

                <button id="download-csv" style="cursor:pointer;">
                    Descargar CSV
                </button>
            </div>

            <p style="margin-bottom:6px;">Vista SQL:</p>

            <textarea id="nextdata-output" style="
                width:100%;
                height:380px;
                background:#222;
                color:#fff;
                border:1px solid #444;
                border-radius:6px;
                padding:8px;
                resize:vertical;
            ">${sql}</textarea>

            <p style="margin-top:8px;color:#aaa;font-size:12px;">
                También podés cerrar este panel con la tecla Escape.
            </p>
        `;

        document.body.appendChild(panel);

        const textarea = document.getElementById('nextdata-output');

        document.getElementById('close-nextdata-panel').onclick = () => {
            panel.remove();
        };

        document.getElementById('copy-full-script').onclick = async () => {
            const fullScript = textarea.value;

            try {
                await navigator.clipboard.writeText(fullScript);
                alert('Script SQL completo copiado.');
            } catch (error) {
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                alert('Script SQL completo copiado.');
            }
        };

        document.getElementById('select-full-script').onclick = () => {
            textarea.focus();
            textarea.select();
        };

        document.getElementById('download-sql').onclick = () => {
            downloadFile(`insert_tiros_partido_${manualMatchId}.sql`, textarea.value, 'text/sql');
        };

        document.getElementById('copy-csv').onclick = async () => {
            await navigator.clipboard.writeText(csv);
            alert('CSV copiado.');
        };

        document.getElementById('download-csv').onclick = () => {
            downloadFile(`tiros_partido_${manualMatchId}.csv`, csv, 'text/csv');
        };
    }

    function extractShots() {
        try {
            const manualMatchId = askManualMatchId();

            if (!manualMatchId) {
                alert('Extracción cancelada: no ingresaste id_partido.');
                return;
            }

            const data = getNextData();

            console.log('NEXT_DATA pageProps:', data);

            const teamCodeMap = getTeamCodeMap(data);
            const playerMap = buildPlayerMap(data, teamCodeMap);
            const shots = getShots(data);

            console.log('teamCodeMap:', teamCodeMap);
            console.log('playerMap:', playerMap);
            console.log('shots:', shots);

            if (!shots.length) {
                alert('No encontré tiros en NEXT_DATA. Revisá consola.');
                return;
            }

            const rows = shots.map(shot => {
                return normalizeShot(
                    shot,
                    playerMap,
                    teamCodeMap,
                    manualMatchId
                );
            });

            console.table(rows);

            const missingPlayers = rows.filter(row => !row.id_jugador);
            const missingKeepers = rows.filter(row => !row.id_arquero && row._keeperIdFotMob);

            if (missingPlayers.length) {
                console.warn('Tiros sin id_jugador:', missingPlayers);
            }

            if (missingKeepers.length) {
                console.warn('Tiros sin id_arquero:', missingKeepers);
            }

            const sql = toSql(rows);
            const csv = toCsv(rows);

            createPanel(
                rows,
                csv,
                sql,
                {
                    missingPlayers: missingPlayers.length,
                    missingKeepers: missingKeepers.length
                },
                manualMatchId
            );

        } catch (error) {
            console.error(error);
            alert('Error extrayendo tiros desde NEXT_DATA: ' + error.message);
        }
    }

    function addButton() {
        if (document.getElementById('fotmob-nextdata-btn')) return;

        const button = document.createElement('button');
        button.id = 'fotmob-nextdata-btn';
        button.textContent = 'Extraer tiros SQL';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.zIndex = '999999';
        button.style.padding = '12px 16px';
        button.style.background = '#0b6';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.borderRadius = '8px';
        button.style.fontWeight = 'bold';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)';

        button.onclick = extractShots;

        document.body.appendChild(button);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            const panel = document.getElementById('fotmob-nextdata-panel');
            if (panel) panel.remove();
        }
    });

    setTimeout(addButton, 2000);
})();