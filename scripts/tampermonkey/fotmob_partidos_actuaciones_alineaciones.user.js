// ==UserScript==
// @name         FotMob Partido + Actuaciones + Alineaciones SQL
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Extrae partido, actuaciones y alineaciones desde FotMob y genera INSERT SQL con id_partido manual
// @match        https://www.fotmob.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.fotmob.com
// ==/UserScript==

(function () {
    'use strict';

    const TEAM_IDS = {
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
        'Bosnia-Herzegovina': 'BIH',
        'Bosnia': 'BIH',
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
        'US': 'USA',
        'Paraguay': 'PAR',
        'Australia': 'AUS',
        'Turkiye': 'TUR',
        'Türkiye': 'TUR',
        'Turkey': 'TUR',

        // Grupo E
        'Germany': 'GER',
        'Curacao': 'CUW',
        'Curaçao': 'CUW',
        'Ivory Coast': 'CIV',
        "Cote d'Ivoire": 'CIV',
        "Côte d'Ivoire": 'CIV',
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
        'Algeria (DZA)': 'ALG',
        'Austria': 'AUT',
        'Jordan': 'JOR',

        // Grupo K
        'Portugal': 'POR',
        'DR Congo': 'COD',
        'Congo DR': 'COD',
        'Congo': 'COD',
        'Democratic Republic of Congo': 'COD',
        'Uzbekistan': 'UZB',
        'Colombia': 'COL',

        // Grupo L
        'England': 'ENG',
        'Croatia': 'CRO',
        'Ghana': 'GHA',
        'Panama': 'PAN'
    };

    const STADIUM_IDS = {
        'BC Place Vancouver': 1,
        'Toronto Stadium': 2,
        'Guadalajara Stadium': 3,
        'Mexico City Stadium': 4,
        'Monterrey Stadium': 5,
        'Atlanta Stadium': 6,
        'Boston Stadium': 7,
        'Dallas Stadium': 8,
        'Houston Stadium': 9,
        'Kansas City Stadium': 10,
        'Los Angeles Stadium': 11,
        'Miami Stadium': 12,
        'New York New Jersey Stadium': 13,
        'Philadelphia Stadium': 14,
        'San Francisco Bay Area Stadium': 15,
        'Seattle Stadium': 16
    };

    function normalizeText(value) {
        if (!value) return '';
        return String(value).trim().replace(/\s+/g, ' ');
    }

    function getTeamCode(teamName) {
        const cleanName = normalizeText(teamName);

        if (TEAM_IDS[cleanName]) {
            return TEAM_IDS[cleanName];
        }

        console.warn('Equipo no mapeado:', teamName);
        return cleanName;
    }

    function getStadiumId(stadiumName) {
        const cleanName = normalizeText(stadiumName);

        if (STADIUM_IDS[cleanName]) {
            return STADIUM_IDS[cleanName];
        }

        console.warn('Estadio no mapeado:', stadiumName);
        return null;
    }

    function getFotmobMatchIdFromUrl() {
        const url = window.location.href;

        const hashMatch = url.match(/#(\d+)/);
        if (hashMatch) return hashMatch[1];

        const anyNumber = url.match(/(\d{6,})/);
        if (anyNumber) return anyNumber[1];

        return '';
    }

    function requestText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    'Accept': 'application/json,text/plain,*/*',
                    'Referer': window.location.href
                },
                onload: response => resolve(response.responseText),
                onerror: reject
            });
        });
    }

    async function requestJsonFromPossibleUrls(fotmobMatchId) {
        const urls = [
            `https://www.fotmob.com/api/matchDetails?matchId=${fotmobMatchId}`,
            `https://www.fotmob.com/matchDetails?matchId=${fotmobMatchId}`
        ];

        for (const url of urls) {
            try {
                console.log('Probando endpoint:', url);

                const text = await requestText(url);
                const trimmed = text.trim();

                if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                    console.warn('Respuesta no JSON en:', url);
                    console.warn(trimmed.slice(0, 200));
                    continue;
                }

                return JSON.parse(trimmed);
            } catch (error) {
                console.warn('Falló endpoint:', url, error);
            }
        }

        return null;
    }

    function findMatchDetailsObject(root, fotmobMatchId) {
        const seen = new WeakSet();

        function walk(value) {
            if (!value || typeof value !== 'object') return null;

            if (seen.has(value)) return null;
            seen.add(value);

            const hasGeneral = value.general && typeof value.general === 'object';
            const hasContent = value.content && typeof value.content === 'object';

            if (
                hasGeneral &&
                hasContent &&
                String(value.general.matchId || '') === String(fotmobMatchId)
            ) {
                return value;
            }

            if (
                hasGeneral &&
                hasContent &&
                value.content.stats &&
                value.header
            ) {
                return value;
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    const found = walk(item);
                    if (found) return found;
                }
            } else {
                for (const key of Object.keys(value)) {
                    const found = walk(value[key]);
                    if (found) return found;
                }
            }

            return null;
        }

        return walk(root);
    }

    function getDataFromPage(fotmobMatchId) {
        const nextDataScript = document.querySelector('#__NEXT_DATA__');

        if (nextDataScript?.textContent) {
            try {
                const nextData = JSON.parse(nextDataScript.textContent);
                const found = findMatchDetailsObject(nextData, fotmobMatchId);

                if (found) {
                    console.log('Datos encontrados en __NEXT_DATA__');
                    return found;
                }
            } catch (error) {
                console.warn('No pude parsear __NEXT_DATA__:', error);
            }
        }

        const scripts = [...document.querySelectorAll('script')];

        for (const script of scripts) {
            const text = script.textContent || '';

            if (!text.includes('matchId') || !text.includes('shotmap')) continue;

            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1) continue;

            const possibleJson = text.slice(firstBrace, lastBrace + 1);

            try {
                const parsed = JSON.parse(possibleJson);
                const found = findMatchDetailsObject(parsed, fotmobMatchId);

                if (found) {
                    console.log('Datos encontrados en script embebido');
                    return found;
                }
            } catch (_) {
                // Muchos scripts no son JSON puro. Se ignoran.
            }
        }

        return null;
    }

    async function getMatchData(fotmobMatchId) {
        let data = getDataFromPage(fotmobMatchId);

        if (data) return data;

        data = await requestJsonFromPossibleUrls(fotmobMatchId);

        if (data) return data;

        throw new Error(
            'No pude obtener JSON. Abrí Stats o Lineup, esperá unos segundos y volvé a tocar el botón.'
        );
    }

    function num(value) {
        if (value === undefined || value === null || value === '') return 0;

        if (typeof value === 'number') return value;

        const clean = String(value)
            .replace('%', '')
            .replace(',', '.')
            .trim();

        const n = Number(clean);
        return Number.isNaN(n) ? 0 : n;
    }

    function sqlNum(value) {
        if (value === undefined || value === null || value === '') return 'NULL';
        const n = Number(value);
        return Number.isNaN(n) ? 'NULL' : n;
    }

    function sqlText(value) {
        if (value === undefined || value === null || value === '') return 'NULL';
        return `'${String(value).replaceAll("'", "''").trim()}'`;
    }

    function buildLocalPlayerId(teamCode, shirtNumber) {
        if (!teamCode || shirtNumber === undefined || shirtNumber === null || shirtNumber === '') {
            return null;
        }

        const cleanNumber = Number(shirtNumber);
        if (Number.isNaN(cleanNumber)) return null;

        return `${teamCode}${cleanNumber}`;
    }

    function getTeamsInfo(data) {
        const homeTeam = data?.general?.homeTeam || {};
        const awayTeam = data?.general?.awayTeam || {};
        const headerTeams = data?.header?.teams || [];

        const homeHeader = headerTeams.find(t => t.id === homeTeam.id) || headerTeams[0] || {};
        const awayHeader = headerTeams.find(t => t.id === awayTeam.id) || headerTeams[1] || {};

        const homeName = homeTeam.name || homeHeader.name || '';
        const awayName = awayTeam.name || awayHeader.name || '';

        const homeCode = getTeamCode(homeName);
        const awayCode = getTeamCode(awayName);

        return {
            homeTeam,
            awayTeam,
            homeHeader,
            awayHeader,
            homeName,
            awayName,
            homeCode,
            awayCode
        };
    }

    function getAllStatsArray(data) {
        const statsGroups = data?.content?.stats?.Periods?.All?.stats || [];
        const allStats = [];

        statsGroups.forEach(group => {
            if (Array.isArray(group.stats)) {
                group.stats.forEach(stat => allStats.push(stat));
            }
        });

        return allStats;
    }

    function findStatByKeyOrTitle(allStats, keysOrTitles) {
        const wanted = keysOrTitles.map(x => x.toLowerCase());

        return allStats.find(stat => {
            const key = String(stat.key || '').toLowerCase();
            const title = String(stat.title || '').toLowerCase();

            return wanted.includes(key) || wanted.includes(title);
        });
    }

    function getStatPair(allStats, keysOrTitles, defaultValue = 0) {
        const stat = findStatByKeyOrTitle(allStats, keysOrTitles);

        if (!stat || !Array.isArray(stat.stats)) {
            return [defaultValue, defaultValue];
        }

        return [
            stat.stats[0] ?? defaultValue,
            stat.stats[1] ?? defaultValue
        ];
    }

    function parseAccuratePasses(value) {
        if (value === undefined || value === null) {
            return {
                pases_acertados: 0,
                precision_pases: 0,
                pases_totales: 0
            };
        }

        const text = String(value);

        const accurateMatch = text.match(/(\d+)/);
        const pctMatch = text.match(/\((\d+)%\)/);

        const pasesAcertados = accurateMatch ? Number(accurateMatch[1]) : 0;
        const precision = pctMatch ? Number(pctMatch[1]) : 0;

        const pasesTotales = precision > 0
            ? Math.round(pasesAcertados / (precision / 100))
            : 0;

        return {
            pases_acertados: pasesAcertados,
            precision_pases: precision,
            pases_totales: pasesTotales
        };
    }

    function formatDateYYYYMMDD(dateValue) {
        if (!dateValue) return null;

        const d = new Date(dateValue);

        if (Number.isNaN(d.getTime())) return null;

        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    function extractPartidoInsert(data, manualMatchId) {
        const {
            homeHeader,
            awayHeader,
            homeCode,
            awayCode
        } = getTeamsInfo(data);

        const allStats = getAllStatsArray(data);

        const xg = getStatPair(allStats, ['expected_goals', 'Expected goals (xG)']);
        const xgot = getStatPair(allStats, ['expected_goals_on_target', 'xG on target (xGOT)']);

        const lineup = data?.content?.lineup || {};
        const homeLineup = lineup?.homeTeam || {};
        const awayLineup = lineup?.awayTeam || {};

        const infoBox = data?.content?.matchFacts?.infoBox || {};

        const fecha =
            formatDateYYYYMMDD(infoBox?.['Match Date']?.utcTime) ||
            formatDateYYYYMMDD(data?.general?.matchTimeUTCDate) ||
            formatDateYYYYMMDD(data?.header?.status?.utcTime);

        const fase =
            infoBox?.Tournament?.roundName ||
            data?.general?.leagueRoundName ||
            data?.general?.matchRound ||
            null;

        const arbitro =
            infoBox?.Referee?.text ||
            null;

        const espectadores =
            infoBox?.Attendance ??
            null;

        const estadio =
            infoBox?.Stadium?.name ||
            null;

        const idEstadio = getStadiumId(estadio);

        return {
            id_partido: manualMatchId,

            id_equipo_local: homeCode,
            goles_local: num(homeHeader.score),
            xg_local: num(xg[0]),
            xgot_local: num(xgot[0]),
            formacion_local: homeLineup?.formation || null,

            id_equipo_visitante: awayCode,
            goles_visitante: num(awayHeader.score),
            xg_visitante: num(xg[1]),
            xgot_visitante: num(xgot[1]),
            formacion_visitante: awayLineup?.formation || null,

            id_estadio: idEstadio,
            fecha,
            fase,
            arbitro,
            espectadores,
            estadio
        };
    }

    function extractMatchStats(data, manualMatchId) {
        const {
            homeHeader,
            awayHeader,
            homeCode,
            awayCode
        } = getTeamsInfo(data);

        const allStats = getAllStatsArray(data);

        const possession = getStatPair(allStats, ['BallPossesion', 'Ball possession']);
        const xg = getStatPair(allStats, ['expected_goals', 'Expected goals (xG)']);
        const totalShots = getStatPair(allStats, ['total_shots', 'Total shots']);
        const shotsOnTarget = getStatPair(allStats, ['ShotsOnTarget', 'Shots on target']);
        const bigChances = getStatPair(allStats, ['big_chance', 'Big chances']);
        const bigChancesMissed = getStatPair(allStats, ['big_chance_missed_title', 'Big chances missed']);
        const touchesOppBox = getStatPair(allStats, ['touches_opp_box', 'Touches in opposition box']);
        const accuratePasses = getStatPair(allStats, ['accurate_passes', 'Accurate passes']);
        const yellowCards = getStatPair(allStats, ['yellow_cards', 'Yellow cards'], 0);
        const redCards = getStatPair(allStats, ['red_cards', 'Red cards'], 0);
        const fouls = getStatPair(allStats, ['fouls', 'Fouls committed', 'Fouls'], 0);
        const recoveries = getStatPair(allStats, ['recoveries', 'Recoveries'], 0);
        const interceptions = getStatPair(allStats, ['interceptions', 'Interceptions'], 0);

        const homePasses = parseAccuratePasses(accuratePasses[0]);
        const awayPasses = parseAccuratePasses(accuratePasses[1]);

        const homeGoals = num(homeHeader.score);
        const awayGoals = num(awayHeader.score);

        return [
            {
                id_partido: manualMatchId,
                id_equipo: homeCode,
                id_rival: awayCode,
                ranking_equipo: homeHeader.fifaRank ?? null,
                ranking_rival: awayHeader.fifaRank ?? null,
                goles_favor: homeGoals,
                goles_contra: awayGoals,
                xg_favor: num(xg[0]),
                xg_contra: num(xg[1]),
                tiros_favor: num(totalShots[0]),
                tiros_contra: num(totalShots[1]),
                tiros_arco_favor: num(shotsOnTarget[0]),
                tiros_arco_contra: num(shotsOnTarget[1]),
                big_chances_favor: num(bigChances[0]),
                big_chances_contra: num(bigChances[1]),
                big_chances_missed: num(bigChancesMissed[0]),
                toques_area_rival: num(touchesOppBox[0]),
                toques_area_propia_concedidos: num(touchesOppBox[1]),
                posesion: num(possession[0]),
                pases_totales: homePasses.pases_totales,
                pases_acertados: homePasses.pases_acertados,
                precision_pases: homePasses.precision_pases,
                recuperaciones: num(recoveries[0]),
                intercepciones: num(interceptions[0]),
                faltas: num(fouls[0]),
                tarjetas_amarillas: num(yellowCards[0]),
                tarjetas_rojas: num(redCards[0])
            },
            {
                id_partido: manualMatchId,
                id_equipo: awayCode,
                id_rival: homeCode,
                ranking_equipo: awayHeader.fifaRank ?? null,
                ranking_rival: homeHeader.fifaRank ?? null,
                goles_favor: awayGoals,
                goles_contra: homeGoals,
                xg_favor: num(xg[1]),
                xg_contra: num(xg[0]),
                tiros_favor: num(totalShots[1]),
                tiros_contra: num(totalShots[0]),
                tiros_arco_favor: num(shotsOnTarget[1]),
                tiros_arco_contra: num(shotsOnTarget[0]),
                big_chances_favor: num(bigChances[1]),
                big_chances_contra: num(bigChances[0]),
                big_chances_missed: num(bigChancesMissed[1]),
                toques_area_rival: num(touchesOppBox[1]),
                toques_area_propia_concedidos: num(touchesOppBox[0]),
                posesion: num(possession[1]),
                pases_totales: awayPasses.pases_totales,
                pases_acertados: awayPasses.pases_acertados,
                precision_pases: awayPasses.precision_pases,
                recuperaciones: num(recoveries[1]),
                intercepciones: num(interceptions[1]),
                faltas: num(fouls[1]),
                tarjetas_amarillas: num(yellowCards[1]),
                tarjetas_rojas: num(redCards[1])
            }
        ];
    }

    function getLineupPlayers(teamLineup) {
        const starters = teamLineup?.starters || teamLineup?.lineup || [];
        const subs =
            teamLineup?.subs ||
            teamLineup?.substitutes ||
            teamLineup?.bench ||
            [];

        return { starters, subs };
    }

    function getPlayerGeneralPosition(player, playerStats) {
        const usual =
            player?.usualPlayingPositionId ??
            player?.usualPosition ??
            playerStats?.usualPosition ??
            playerStats?.usualPlayingPositionId ??
            null;

        if (player?.isGoalkeeper || playerStats?.isGoalkeeper) return 'GK';

        const n = Number(usual);

        if (n === 0) return 'GK';
        if (n === 1) return 'DF';
        if (n === 2) return 'MF';
        if (n === 3) return 'FW';

        return null;
    }

    function getPlayerDetailPosition(player, playerStats) {
        const possible =
            player?.positionLabel?.label ||
            player?.positionLabel ||
            player?.localizedPosition?.label ||
            player?.role ||
            playerStats?.positionLabel?.label ||
            playerStats?.positionLabel ||
            playerStats?.role ||
            null;

        if (possible && typeof possible === 'string') return possible;

        const general = getPlayerGeneralPosition(player, playerStats);
        return general;
    }

    function getMinute(event) {
        const base = Number(event?.time ?? event?.timeStr ?? 0);
        const added = Number(event?.overloadTime ?? event?.overloadTimeStr ?? 0);

        if (!Number.isNaN(base) && !Number.isNaN(added) && added > 0) {
            return base + added;
        }

        return Number.isNaN(base) ? null : base;
    }

    function getAllPlayersMap(data) {
        const map = new Map();
        const playerStats = data?.content?.playerStats || {};

        for (const [fotmobId, ps] of Object.entries(playerStats)) {
            const teamName = ps?.teamName;
            const teamCode = getTeamCode(teamName);
            const shirtNumber = ps?.shirtNumber;
            const localId = buildLocalPlayerId(teamCode, shirtNumber);

            if (!localId) continue;

            map.set(String(fotmobId), {
                localId,
                teamCode,
                shirtNumber,
                playerStats: ps
            });
        }

        return map;
    }

    function extractAlineaciones(data, manualMatchId) {
        const {
            homeCode,
            awayCode
        } = getTeamsInfo(data);

        const lineup = data?.content?.lineup || {};
        const homeLineup = lineup?.homeTeam || {};
        const awayLineup = lineup?.awayTeam || {};

        const playerStats = data?.content?.playerStats || {};
        const allPlayersMap = getAllPlayersMap(data);

        const rowsByKey = new Map();

        function addPlayerRow(player, teamCode, rivalCode, condicion) {
            const fotmobId = String(player?.id ?? '');
            const ps = playerStats[fotmobId] || {};

            const shirtNumber = player?.shirtNumber ?? ps?.shirtNumber;
            const localPlayerId = buildLocalPlayerId(teamCode, shirtNumber);

            if (!localPlayerId) return null;

            const row = {
                id_partido: manualMatchId,
                id_equipo: teamCode,
                id_jugador: localPlayerId,
                id_rival: rivalCode,
                condicion,
                jugo: condicion === 'titular' ? 1 : 0,
                minuto_ingreso: condicion === 'titular' ? 0 : null,
                minuto_salida: null,
                id_jugador_reemplaza_a: null,
                id_jugador_reemplazado_por: null,
                posicion_general: getPlayerGeneralPosition(player, ps),
                posicion_detalle: getPlayerDetailPosition(player, ps)
            };

            rowsByKey.set(`${teamCode}_${localPlayerId}`, row);

            return row;
        }

        const homePlayers = getLineupPlayers(homeLineup);
        const awayPlayers = getLineupPlayers(awayLineup);

        homePlayers.starters.forEach(p => addPlayerRow(p, homeCode, awayCode, 'titular'));
        homePlayers.subs.forEach(p => addPlayerRow(p, homeCode, awayCode, 'suplente'));

        awayPlayers.starters.forEach(p => addPlayerRow(p, awayCode, homeCode, 'titular'));
        awayPlayers.subs.forEach(p => addPlayerRow(p, awayCode, homeCode, 'suplente'));

        const events = data?.content?.matchFacts?.events?.events || [];

        events
            .filter(ev => ev?.type === 'Substitution' && Array.isArray(ev?.swap))
            .forEach(ev => {
                const teamCode = ev.isHome ? homeCode : awayCode;
                const rivalCode = ev.isHome ? awayCode : homeCode;
                const minute = getMinute(ev);

                const playerInFotmobId = String(ev.swap[0]?.id ?? '');
                const playerOutFotmobId = String(ev.swap[1]?.id ?? '');

                const playerInInfo = allPlayersMap.get(playerInFotmobId);
                const playerOutInfo = allPlayersMap.get(playerOutFotmobId);

                const playerInLocalId = playerInInfo?.localId || null;
                const playerOutLocalId = playerOutInfo?.localId || null;

                if (!playerInLocalId || !playerOutLocalId) {
                    console.warn('No pude mapear sustitución completa:', ev);
                    return;
                }

                const inKey = `${teamCode}_${playerInLocalId}`;
                const outKey = `${teamCode}_${playerOutLocalId}`;

                let inRow = rowsByKey.get(inKey);
                let outRow = rowsByKey.get(outKey);

                if (!inRow) {
                    const ps = playerStats[playerInFotmobId] || {};

                    inRow = {
                        id_partido: manualMatchId,
                        id_equipo: teamCode,
                        id_jugador: playerInLocalId,
                        id_rival: rivalCode,
                        condicion: 'suplente',
                        jugo: 1,
                        minuto_ingreso: minute,
                        minuto_salida: null,
                        id_jugador_reemplaza_a: playerOutLocalId,
                        id_jugador_reemplazado_por: null,
                        posicion_general: getPlayerGeneralPosition({}, ps),
                        posicion_detalle: getPlayerDetailPosition({}, ps)
                    };

                    rowsByKey.set(inKey, inRow);
                }

                if (!outRow) {
                    const ps = playerStats[playerOutFotmobId] || {};

                    outRow = {
                        id_partido: manualMatchId,
                        id_equipo: teamCode,
                        id_jugador: playerOutLocalId,
                        id_rival: rivalCode,
                        condicion: 'titular',
                        jugo: 1,
                        minuto_ingreso: 0,
                        minuto_salida: minute,
                        id_jugador_reemplaza_a: null,
                        id_jugador_reemplazado_por: playerInLocalId,
                        posicion_general: getPlayerGeneralPosition({}, ps),
                        posicion_detalle: getPlayerDetailPosition({}, ps)
                    };

                    rowsByKey.set(outKey, outRow);
                }

                inRow.jugo = 1;
                inRow.minuto_ingreso = minute;
                inRow.id_jugador_reemplaza_a = playerOutLocalId;

                outRow.minuto_salida = minute;
                outRow.id_jugador_reemplazado_por = playerInLocalId;
            });

        return Array.from(rowsByKey.values())
            .sort((a, b) => {
                if (a.id_equipo !== b.id_equipo) return a.id_equipo.localeCompare(b.id_equipo);
                if (a.condicion !== b.condicion) return a.condicion === 'titular' ? -1 : 1;
                return a.id_jugador.localeCompare(b.id_jugador);
            });
    }

    function toSqlPartidoInsert(row) {
        return `INSERT INTO partidos
    (id, id_equipo_local, goles_local, xg_local, xgot_local, formacion_local,
     id_equipo_visitante, goles_visitante, xg_visitante, xgot_visitante, formacion_visitante,
     id_estadio, fecha, fase, arbitro, espectadores)
VALUES
    (${[
        sqlNum(row.id_partido),
        sqlText(row.id_equipo_local),
        sqlNum(row.goles_local),
        sqlNum(row.xg_local),
        sqlNum(row.xgot_local),
        sqlText(row.formacion_local),

        sqlText(row.id_equipo_visitante),
        sqlNum(row.goles_visitante),
        sqlNum(row.xg_visitante),
        sqlNum(row.xgot_visitante),
        sqlText(row.formacion_visitante),

        sqlNum(row.id_estadio),
        sqlText(row.fecha),
        sqlText(row.fase),
        sqlText(row.arbitro),
        sqlNum(row.espectadores)
    ].join(', ')});

-- Estadio detectado en FotMob: ${row.estadio || 'No detectado'}
-- id_estadio asignado: ${row.id_estadio || 'NULL'}
-- Si id_estadio sale NULL, agregá el nombre exacto del estadio al diccionario STADIUM_IDS.`;
    }

    function toSqlActuaciones(rows) {
        const columns = [
            'id_partido',
            'id_equipo',
            'id_rival',
            'ranking_equipo',
            'ranking_rival',
            'goles_favor',
            'goles_contra',
            'xg_favor',
            'xg_contra',
            'tiros_favor',
            'tiros_contra',
            'tiros_arco_favor',
            'tiros_arco_contra',
            'big_chances_favor',
            'big_chances_contra',
            'big_chances_missed',
            'toques_area_rival',
            'toques_area_propia_concedidos',
            'posesion',
            'pases_totales',
            'pases_acertados',
            'precision_pases',
            'recuperaciones',
            'intercepciones',
            'faltas',
            'tarjetas_amarillas',
            'tarjetas_rojas'
        ];

        const values = rows.map(row => {
            return `    (${[
                sqlNum(row.id_partido),
                sqlText(row.id_equipo),
                sqlText(row.id_rival),
                sqlNum(row.ranking_equipo),
                sqlNum(row.ranking_rival),
                sqlNum(row.goles_favor),
                sqlNum(row.goles_contra),
                sqlNum(row.xg_favor),
                sqlNum(row.xg_contra),
                sqlNum(row.tiros_favor),
                sqlNum(row.tiros_contra),
                sqlNum(row.tiros_arco_favor),
                sqlNum(row.tiros_arco_contra),
                sqlNum(row.big_chances_favor),
                sqlNum(row.big_chances_contra),
                sqlNum(row.big_chances_missed),
                sqlNum(row.toques_area_rival),
                sqlNum(row.toques_area_propia_concedidos),
                sqlNum(row.posesion),
                sqlNum(row.pases_totales),
                sqlNum(row.pases_acertados),
                sqlNum(row.precision_pases),
                sqlNum(row.recuperaciones),
                sqlNum(row.intercepciones),
                sqlNum(row.faltas),
                sqlNum(row.tarjetas_amarillas),
                sqlNum(row.tarjetas_rojas)
            ].join(', ')})`;
        }).join(',\n');

        return `INSERT INTO estadisticas_actuaciones
    (${columns.join(', ')})
VALUES
${values};`;
    }

    function toSqlAlineaciones(rows) {
        if (!rows.length) {
            return '-- No se encontraron alineaciones para insertar.';
        }

        const values = rows.map(row => {
            return `    (${[
                sqlNum(row.id_partido),
                sqlText(row.id_equipo),
                sqlText(row.id_jugador),
                sqlText(row.id_rival),
                sqlText(row.condicion),
                sqlNum(row.jugo),
                sqlNum(row.minuto_ingreso),
                sqlNum(row.minuto_salida),
                sqlText(row.id_jugador_reemplaza_a),
                sqlText(row.id_jugador_reemplazado_por),
                sqlText(row.posicion_general),
                sqlText(row.posicion_detalle)
            ].join(', ')})`;
        }).join(',\n');

        return `INSERT INTO alineaciones_partido
    (id_partido, id_equipo, id_jugador, id_rival,
     condicion, jugo, minuto_ingreso, minuto_salida,
     id_jugador_reemplaza_a, id_jugador_reemplazado_por,
     posicion_general, posicion_detalle)
VALUES
${values};`;
    }

    function createPanel({
        partidoRow,
        actuacionesRows,
        alineacionesRows,
        sqlPartido,
        sqlActuaciones,
        sqlAlineaciones,
        sqlCompleto,
        manualMatchId,
        fotmobMatchId
    }) {
        const oldPanel = document.getElementById('fotmob-actuaciones-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'fotmob-actuaciones-panel';
        panel.style.position = 'fixed';
        panel.style.top = '70px';
        panel.style.right = '20px';
        panel.style.zIndex = '999999';
        panel.style.width = '800px';
        panel.style.maxHeight = '82vh';
        panel.style.overflow = 'auto';
        panel.style.background = '#111';
        panel.style.color = '#fff';
        panel.style.padding = '14px';
        panel.style.borderRadius = '10px';
        panel.style.boxShadow = '0 4px 20px rgba(0,0,0,.45)';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.fontSize = '13px';

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <strong>FotMob - SQL partido + actuaciones + alineaciones</strong>
                <button id="close-actuaciones-panel"
                    style="
                        cursor:pointer;
                        background:#c62828;
                        color:white;
                        border:none;
                        border-radius:6px;
                        padding:6px 10px;
                        font-weight:bold;
                    ">
                    Cerrar
                </button>
            </div>

            <p style="margin:6px 0;">ID partido local: <strong>${manualMatchId}</strong></p>
            <p style="margin:6px 0;">ID partido FotMob: <strong>${fotmobMatchId || 'no detectado'}</strong></p>
            <p style="margin:6px 0;">Partido: <strong>${partidoRow.id_equipo_local} ${partidoRow.goles_local} - ${partidoRow.goles_visitante} ${partidoRow.id_equipo_visitante}</strong></p>
            <p style="margin:6px 0;">Formaciones: <strong>${partidoRow.formacion_local || 'NULL'} vs ${partidoRow.formacion_visitante || 'NULL'}</strong></p>
            <p style="margin:6px 0;">Estadio: <strong>${partidoRow.estadio || 'NULL'}</strong> | id_estadio: <strong>${partidoRow.id_estadio || 'NULL'}</strong></p>
            <p style="margin:6px 0;">Actuaciones: <strong>${actuacionesRows.length}</strong></p>
            <p style="margin:6px 0;">Alineaciones: <strong>${alineacionesRows.length}</strong></p>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;">
                <button id="copy-sql-completo" style="cursor:pointer;background:#ff8c00;color:white;border:none;border-radius:6px;padding:8px 12px;font-weight:bold;">
                    Copiar TODO
                </button>

                <button id="copy-sql-partido" style="cursor:pointer;background:#444;color:white;border:none;border-radius:6px;padding:8px 12px;font-weight:bold;">
                    Copiar partido
                </button>

                <button id="copy-sql-actuaciones" style="cursor:pointer;background:#444;color:white;border:none;border-radius:6px;padding:8px 12px;font-weight:bold;">
                    Copiar actuaciones
                </button>

                <button id="copy-sql-alineaciones" style="cursor:pointer;background:#444;color:white;border:none;border-radius:6px;padding:8px 12px;font-weight:bold;">
                    Copiar alineaciones
                </button>
            </div>

            <textarea id="actuaciones-output"
                style="
                    width:100%;
                    height:480px;
                    background:#222;
                    color:#fff;
                    border:1px solid #444;
                    border-radius:6px;
                    padding:8px;
                    box-sizing:border-box;
                ">${sqlCompleto}</textarea>
        `;

        document.body.appendChild(panel);

        document.getElementById('close-actuaciones-panel').onclick = () => {
            panel.remove();
        };

        document.getElementById('copy-sql-completo').onclick = async () => {
            await navigator.clipboard.writeText(sqlCompleto);
            alert('SQL completo copiado');
        };

        document.getElementById('copy-sql-partido').onclick = async () => {
            await navigator.clipboard.writeText(sqlPartido);
            alert('SQL de partido copiado');
        };

        document.getElementById('copy-sql-actuaciones').onclick = async () => {
            await navigator.clipboard.writeText(sqlActuaciones);
            alert('SQL de actuaciones copiado');
        };

        document.getElementById('copy-sql-alineaciones').onclick = async () => {
            await navigator.clipboard.writeText(sqlAlineaciones);
            alert('SQL de alineaciones copiado');
        };
    }

    async function extractAll() {
        const fotmobMatchId = getFotmobMatchIdFromUrl();

        if (!fotmobMatchId) {
            alert('No pude detectar el matchId de FotMob en la URL.');
            return;
        }

        const manualMatchId = prompt(
            'Ingresá tu id_partido local para insertar en tu tabla partidos:',
            ''
        );

        if (!manualMatchId) {
            alert('Cancelado: necesitás ingresar un id_partido local.');
            return;
        }

        try {
            const data = await getMatchData(fotmobMatchId);

            console.log('FotMob data usada:', data);

            const partidoRow = extractPartidoInsert(data, manualMatchId);
            const actuacionesRows = extractMatchStats(data, manualMatchId);
            const alineacionesRows = extractAlineaciones(data, manualMatchId);

            console.table([partidoRow]);
            console.table(actuacionesRows);
            console.table(alineacionesRows);

            const sqlPartido = toSqlPartidoInsert(partidoRow);
            const sqlActuaciones = toSqlActuaciones(actuacionesRows);
            const sqlAlineaciones = toSqlAlineaciones(alineacionesRows);

            const sqlCompleto = [
                '-- ===============================',
                '-- PARTIDOS',
                '-- ===============================',
                sqlPartido,
                '',
                '-- ===============================',
                '-- ESTADISTICAS ACTUACIONES',
                '-- ===============================',
                sqlActuaciones,
                '',
                '-- ===============================',
                '-- ALINEACIONES PARTIDO',
                '-- ===============================',
                sqlAlineaciones
            ].join('\n');

            createPanel({
                partidoRow,
                actuacionesRows,
                alineacionesRows,
                sqlPartido,
                sqlActuaciones,
                sqlAlineaciones,
                sqlCompleto,
                manualMatchId,
                fotmobMatchId
            });

        } catch (error) {
            console.error('Error completo:', error);
            alert('Error extrayendo datos. Mensaje: ' + error.message);
        }
    }

    function addMainButton() {
        if (document.getElementById('fotmob-actuaciones-btn')) return;

        const button = document.createElement('button');
        button.id = 'fotmob-actuaciones-btn';
        button.textContent = 'Extraer SQL completo';
        button.style.position = 'fixed';
        button.style.bottom = '70px';
        button.style.right = '20px';
        button.style.zIndex = '999999';
        button.style.padding = '12px 16px';
        button.style.background = '#ff8c00';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.borderRadius = '8px';
        button.style.fontWeight = 'bold';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)';

        button.onclick = extractAll;

        document.body.appendChild(button);
    }

    setTimeout(addMainButton, 3000);
})();