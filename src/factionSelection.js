import { IS_AVAILABLE, IS_BANNED, IS_NOT_AVAILABLE, IS_PICKED } from './constants';

const VALID_PICK_STATUSES = new Set([IS_PICKED, IS_BANNED]);

function cloneFactions(previousFactions) {
    return { ...previousFactions };
}

export function sumPickedReach(factions) {
    return Object.values(factions)
        .filter((faction) => faction.status === IS_PICKED)
        .map((faction) => faction.reach)
        .reduce((total, currentFactionReach) => total + currentFactionReach, 0);
}

export function recomputeFactionAvailability(previousFactions, playerCount, requiredReach) {
    const factions = cloneFactions(previousFactions);
    const pickedFactions = Object.values(factions).filter((faction) => faction.status === IS_PICKED);

    // If picked factions already fill all player slots, every other non-banned
    // faction must be treated as unavailable.
    if (pickedFactions.length >= playerCount) {
        for (const key of Object.keys(factions)) {
            if (!(factions[key].status === IS_PICKED || factions[key].status === IS_BANNED)) {
                factions[key].status = IS_NOT_AVAILABLE;
            }
        }
        return factions;
    }

    // Candidate pool used for "can this still reach target" checks.
    // Picked and banned factions are excluded because they cannot be added.
    const sortedFactionArray = Object.values(factions)
        .filter((faction) => !(faction.status === IS_PICKED || faction.status === IS_BANNED))
        .sort((faction1, faction2) => {
            if (faction1.reach > faction2.reach) {
                return -1;
            }
            if (faction1.reach < faction2.reach) {
                return 1;
            }
            return 0;
        });

    const playersStillToPick = playerCount - pickedFactions.length;
    const reach = sumPickedReach(factions);

    for (const factionsKey of Object.keys(factions)) {
        if (factions[factionsKey].status === IS_PICKED || factions[factionsKey].status === IS_BANNED) {
            continue;
        }

        if (factions[factionsKey].name === 'vagabond2' && (factions.vagabond1.status !== IS_PICKED)) {
            factions[factionsKey].status = IS_NOT_AVAILABLE;
            continue;
        }

        // Knaves of the Deepwood use Vagabond components and cannot be played with any Vagabond.
        if (factions[factionsKey].name === 'knaves' && (factions.vagabond1.status === IS_PICKED || factions.vagabond2.status === IS_PICKED)) {
            factions[factionsKey].status = IS_NOT_AVAILABLE;
            continue;
        }

        if ((factions[factionsKey].name === 'vagabond1' || factions[factionsKey].name === 'vagabond2') && factions.knaves.status === IS_PICKED) {
            factions[factionsKey].status = IS_NOT_AVAILABLE;
            continue;
        }

        // Conservative reach viability check: assume this faction is picked,
        // then add the highest-reach remaining factions for the other open slots.
        // If that best-case total is still below required reach, this faction
        // must be unavailable.
        const sortedFactionArrayWithoutFaction = sortedFactionArray.filter((faction) => faction.name !== factionsKey);
        let maxReachForFaction = factions[factionsKey].reach;
        for (let i = 0; i < playersStillToPick - 1; i++) {
            if (sortedFactionArrayWithoutFaction[i]) {
                maxReachForFaction += sortedFactionArrayWithoutFaction[i].reach;
            }
        }

        if (reach + maxReachForFaction < requiredReach) {
            factions[factionsKey].status = IS_NOT_AVAILABLE;
        } else {
            factions[factionsKey].status = IS_AVAILABLE;
        }
    }

    return factions;
}

function usedPlayerNumbers(assignments, pickedFactionNames, maxPlayers) {
    const used = new Set();
    for (const factionName of pickedFactionNames) {
        const value = assignments[factionName];
        if (Number.isInteger(value) && value >= 1 && value <= maxPlayers) {
            used.add(value);
        }
    }
    return used;
}

function firstFreePlayerNumber(assignments, pickedFactionNames, maxPlayers) {
    const used = usedPlayerNumbers(assignments, pickedFactionNames, maxPlayers);
    for (let number = 1; number <= maxPlayers; number++) {
        if (!used.has(number)) {
            return number;
        }
    }
    return null;
}

export function sanitizePlayerAssignments(previousAssignments, factions, maxPlayers) {
    const assignments = {};
    const pickedFactionNames = Object.values(factions)
        .filter((faction) => faction.status === IS_PICKED)
        .map((faction) => faction.name);

    const used = new Set();
    for (const factionName of pickedFactionNames) {
        const value = previousAssignments[factionName];
        if (!Number.isInteger(value) || value < 1 || value > maxPlayers) {
            continue;
        }
        if (used.has(value)) {
            continue;
        }
        assignments[factionName] = value;
        used.add(value);
    }

    return assignments;
}

export function assignMissingPlayers(previousAssignments, factions, maxPlayers) {
    const assignments = { ...previousAssignments };
    const pickedFactionNames = Object.values(factions)
        .filter((faction) => faction.status === IS_PICKED)
        .map((faction) => faction.name);

    for (const factionName of pickedFactionNames) {
        if (Number.isInteger(assignments[factionName]) && assignments[factionName] >= 1 && assignments[factionName] <= maxPlayers) {
            continue;
        }
        const freePlayerNumber = firstFreePlayerNumber(assignments, pickedFactionNames, maxPlayers);
        if (freePlayerNumber === null) {
            break;
        }
        assignments[factionName] = freePlayerNumber;
    }

    return assignments;
}

export function sanitizeLockedFactions(previousLockedFactions, factions) {
    const lockedFactions = {};
    for (const key of Object.keys(previousLockedFactions)) {
        if (previousLockedFactions[key] !== true) {
            continue;
        }
        if (!factions[key] || factions[key].status !== IS_PICKED) {
            continue;
        }
        lockedFactions[key] = true;
    }
    return lockedFactions;
}

export function clearUnlockedPickedFactions(previousFactions, lockedFactions) {
    const factions = cloneFactions(previousFactions);
    for (const key of Object.keys(factions)) {
        if (factions[key].status !== IS_PICKED) {
            continue;
        }
        // Locked picks are manual user selections and should survive rerolls.
        if (lockedFactions[key] === true) {
            continue;
        }
        // Unlocked picks came from random completion and are reroll candidates.
        factions[key] = { ...factions[key], status: IS_AVAILABLE };
    }
    return factions;
}

export function cyclePlayerAssignment(previousAssignments, factionName, factions, maxPlayers) {
    if (!factions[factionName] || factions[factionName].status !== IS_PICKED) {
        return previousAssignments;
    }

    const assignments = { ...previousAssignments };
    const currentValue = assignments[factionName];
    if (!Number.isInteger(currentValue) || currentValue < 1 || currentValue > maxPlayers) {
        return previousAssignments;
    }

    const nextValue = currentValue >= maxPlayers ? 1 : currentValue + 1;
    if (nextValue === currentValue) {
        return previousAssignments;
    }

    let swapFactionName = null;
    for (const key of Object.keys(assignments)) {
        if (key !== factionName && assignments[key] === nextValue) {
            swapFactionName = key;
            break;
        }
    }

    assignments[factionName] = nextValue;
    if (swapFactionName) {
        assignments[swapFactionName] = currentValue;
    }

    return assignments;
}

export function randomCompletePicks(previousFactions, previousAssignments, playerCount, requiredReach) {
    let factions = recomputeFactionAvailability(previousFactions, playerCount, requiredReach);
    let assignments = assignMissingPlayers(
        sanitizePlayerAssignments(previousAssignments, factions, playerCount),
        factions,
        playerCount,
    );

    // Keep filling until the roster is full, or until no legal continuation
    // exists under bans/special rules/reach viability.
    while (Object.values(factions).filter((faction) => faction.status === IS_PICKED).length < playerCount) {
        const availableCandidates = Object.values(factions).filter((faction) => faction.status === IS_AVAILABLE);
        if (availableCandidates.length === 0) {
            break;
        }

        const randomIndex = Math.floor(Math.random() * availableCandidates.length);
        const candidate = availableCandidates[randomIndex];
        factions = cloneFactions(factions);
        factions[candidate.name] = { ...factions[candidate.name], status: IS_PICKED };
        factions = recomputeFactionAvailability(factions, playerCount, requiredReach);
        assignments = assignMissingPlayers(assignments, factions, playerCount);
    }

    return {
        factions,
        assignments,
    };
}

export function pickStatusesFromFactions(factions) {
    const factionStatuses = {};
    for (const key of Object.keys(factions)) {
        const status = factions[key].status;
        if (VALID_PICK_STATUSES.has(status)) {
            factionStatuses[key] = status;
        }
    }
    return factionStatuses;
}