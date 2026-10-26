import { Box } from "@mui/material";
import * as React from 'react';
import { IS_AVAILABLE, IS_BANNED, IS_PICKED } from "../constants";
import { createInitialFactions } from "../data/factions";
import {
    assignMissingPlayers,
    clearUnlockedPickedFactions,
    cyclePlayerAssignment,
    pickStatusesFromFactions,
    randomCompletePicks,
    recomputeFactionAvailability,
    sanitizeLockedFactions,
    sanitizePlayerAssignments,
    sumPickedReach,
} from "../factionSelection";
import { loadSession, saveSession } from "../sessionStorage";
import { ChooseFactionButton } from "./ChooseFactionButton";

function factionsFromSession() {
    const factions = createInitialFactions();
    const { factionStatuses } = loadSession();
    for (const key of Object.keys(factionStatuses)) {
        if (factions[key]) {
            // Only restore explicit picks/bans; availability is recomputed below.
            if (factionStatuses[key] === IS_PICKED || factionStatuses[key] === IS_BANNED) {
                factions[key].status = factionStatuses[key];
            }
        }
    }
    return factions;
}

function assignmentsFromSession() {
    const { playerAssignments } = loadSession();
    if (!playerAssignments || typeof playerAssignments !== 'object') {
        return {};
    }
    return playerAssignments;
}

function lockedFactionsFromSession() {
    const { lockedFactions } = loadSession();
    if (!lockedFactions || typeof lockedFactions !== 'object') {
        return {};
    }
    return lockedFactions;
}

function persistSelection(factions, playerAssignments, lockedFactions) {
    saveSession({
        factionStatuses: pickStatusesFromFactions(factions),
        playerAssignments,
        lockedFactions,
    });
}

export const ChooseFactionButtons = ({playerCount, setReach, requiredReach, isBanMode, randomizeSignal}) => {
    const [factions, setFactions] = React.useState(() => factionsFromSession());
    const [playerAssignments, setPlayerAssignments] = React.useState(() => assignmentsFromSession());
    const [lockedFactions, setLockedFactions] = React.useState(() => lockedFactionsFromSession());
    const lastHandledRandomizeSignalRef = React.useRef(randomizeSignal);

    const applySelectionRules = React.useCallback((baseFactions, baseAssignments, baseLockedFactions) => {
        const nextFactions = recomputeFactionAvailability(baseFactions, playerCount, requiredReach);
        const nextLockedFactions = sanitizeLockedFactions(baseLockedFactions, nextFactions);
        const sanitizedAssignments = sanitizePlayerAssignments(baseAssignments, nextFactions, playerCount);
        const nextAssignments = assignMissingPlayers(sanitizedAssignments, nextFactions, playerCount);
        return {
            factions: nextFactions,
            playerAssignments: nextAssignments,
            lockedFactions: nextLockedFactions,
        };
    }, [playerCount, requiredReach]);

    React.useEffect(() => {
        const nextSelection = applySelectionRules(factions, playerAssignments, lockedFactions);
        setFactions(nextSelection.factions);
        setPlayerAssignments(nextSelection.playerAssignments);
        setLockedFactions(nextSelection.lockedFactions);
        persistSelection(nextSelection.factions, nextSelection.playerAssignments, nextSelection.lockedFactions);
    }, [applySelectionRules]);

    const handleFactionClick = (factionName) => {
        const newFactions = {...factions};
        const newLockedFactions = { ...lockedFactions };
        const currentStatus = factions[factionName].status;

        if (isBanMode) {
            newFactions[factionName].status = (currentStatus === IS_BANNED) ? IS_AVAILABLE : IS_BANNED;
            delete newLockedFactions[factionName];
        } else {
            newFactions[factionName].status = (currentStatus === IS_PICKED) ? IS_AVAILABLE : IS_PICKED;
            if (newFactions[factionName].status === IS_PICKED) {
                newLockedFactions[factionName] = true;
            } else {
                delete newLockedFactions[factionName];
            }
        }

        const nextSelection = applySelectionRules(newFactions, playerAssignments, newLockedFactions);
        setFactions(nextSelection.factions);
        setPlayerAssignments(nextSelection.playerAssignments);
        setLockedFactions(nextSelection.lockedFactions);
        persistSelection(nextSelection.factions, nextSelection.playerAssignments, nextSelection.lockedFactions);
    }

    const handleCyclePlayer = (factionName) => {
        const cycledAssignments = cyclePlayerAssignment(playerAssignments, factionName, factions, playerCount);
        setPlayerAssignments(cycledAssignments);
        persistSelection(factions, cycledAssignments, lockedFactions);
    };

    const handleRandomComplete = () => {
        const lockedOnly = sanitizeLockedFactions(lockedFactions, factions);
        const factionsForRandom = clearUnlockedPickedFactions(factions, lockedOnly);
        const assignmentsForRandom = { ...playerAssignments };
        for (const key of Object.keys(assignmentsForRandom)) {
            if (!lockedOnly[key]) {
                delete assignmentsForRandom[key];
            }
        }

        const nextSelection = randomCompletePicks(factionsForRandom, assignmentsForRandom, playerCount, requiredReach);
        setFactions(nextSelection.factions);
        setPlayerAssignments(nextSelection.assignments);
        setLockedFactions(lockedOnly);
        persistSelection(nextSelection.factions, nextSelection.assignments, lockedOnly);
    };

    React.useEffect(() => {
        if (randomizeSignal <= lastHandledRandomizeSignalRef.current) return;
        lastHandledRandomizeSignalRef.current = randomizeSignal;
        handleRandomComplete();
    }, [randomizeSignal]);

    React.useEffect(() => {
        setReach(sumPickedReach(factions));
    }, [setReach, factions])

    const factionArray = Object.values(factions);
    const lastRowCount = factionArray.length % 3;
    const lastRowStart = lastRowCount > 0 ? factionArray.length - lastRowCount : factionArray.length;

    return (
        <Box className="faction-grid">
            {factionArray.map((faction, index) => {
                const isLastRow = lastRowCount > 0 && index >= lastRowStart;
                const posInLastRow = isLastRow ? index - lastRowStart : 0;
                const gridColumn = isLastRow ? `${posInLastRow * 2 + 2} / span 2` : 'span 2';

                return (
                    <Box key={index} sx={{ display: "flex", justifyContent: "center", alignItems: "center", gridColumn }}>
                        <ChooseFactionButton
                            handleFactionClick={handleFactionClick}
                            handleCyclePlayer={handleCyclePlayer}
                            faction={faction}
                            isBanMode={isBanMode}
                            assignedPlayer={playerAssignments[faction.name]}
                            isLocked={lockedFactions[faction.name] === true}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};
