import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { convertCommitsToHeatmap, getTeamColor, getRepoShortName, sortReposByLatestCommit } from '../../utils/converCommitToHeapmap.js';
const hours = [7, 8, 9, 10, 11, 12, 13, 14];

// High contrast cyberpunk colors - easy to distinguish

function calcGlobalMaxCommitSlot(repos) {
    const allCounts = repos.flatMap(repo => Object.values(repo.heatmap).flat());
    if (!allCounts.length) return 5;
    const sorted = allCounts.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    return Math.max(5, p95);
}

const CommitBoard = ({ data }) => {
    const convertData = useMemo(() => convertCommitsToHeatmap(sortReposByLatestCommit(data)), [data]);

    const maxCommitGlobal = useMemo(
        () => calcGlobalMaxCommitSlot(convertData),
        [convertData]
    );

    return (
        <div className="font-sans select-none bg-black rounded-lg border border-pink-500/30 shadow-2xl shadow-cyan-500/20">
            {/* Header */}
            <div className="grid grid-cols-9">
                <div className="col-span-1 border border-pink-500 bg-gradient-to-r from-purple-900 to-pink-900 text-pink-400 font-bold text-center p-2 shadow-lg shadow-pink-500/50">
                    REPO NAME
                </div>
                {hours.map((h) => (
                    <div
                        key={h}
                        className={`col-span-1 border border-pink-500 bg-gradient-to-r from-purple-900 to-pink-900 text-pink-400 font-bold text-center p-2 cursor-pointer shadow-lg shadow-pink-500/50`}
                    >
                        {h}:00
                    </div>
                ))}
            </div>

            {/* Body */}
            <AnimatePresence mode="sync" initial={false}>
                {convertData.map((repo, repoIdx) => {
                    const teamColor = getTeamColor(repo.team_name, 1);
                    const teamColorDark = getTeamColor(repo.team_name, 0.2);

                    return (
                        <motion.div
                            key={repo.repo_full_name}
                            layout="position"
                            initial={{
                                opacity: 0,
                                y: -60,
                                scale: 1.05,
                                backgroundColor: teamColorDark,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                zIndex: 1,
                                backgroundColor: teamColorDark,
                                transition: {
                                    y: { type: 'spring', stiffness: 150, damping: 18, mass: 1.2 },
                                    scale: { duration: 0.5 },
                                    backgroundColor: { duration: 1 }
                                }
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.95,
                                y: -30,
                                transition: { duration: 0.4 }
                            }}
                            className="grid grid-cols-9 items-center"
                            style={{
                                borderBottom: `1px solid ${getTeamColor(repo.team_name, 0.3)}`,
                                color: teamColor
                            }}
                        >
                            {/* Repo Name Cell */}
                            <div className="col-span-1 p-2 text-sm font-bold truncate" style={{ color: teamColor }}>
                                {getRepoShortName(repo.repo_full_name)}
                            </div>

                            {/* Heatmap Cells */}
                            {hours.map((hour) => {
                                const commitCount = repo.heatmap[hour]?.length || 0;
                                const opacity = Math.min(commitCount / maxCommitGlobal, 1);

                                return (
                                    <div
                                        key={hour}
                                        className="col-span-1 text-center p-2 h-full flex items-center justify-center"
                                        style={{
                                            backgroundColor: `rgba(${parseInt(teamColor.slice(1, 3), 16)}, ${parseInt(teamColor.slice(3, 5), 16)}, ${parseInt(teamColor.slice(5, 7), 16)}, ${opacity * 0.2})`,
                                        }}
                                    >
                                        {commitCount > 0 && (
                                            <span
                                                className="text-lg font-black"
                                                style={{
                                                    color: teamColor,
                                                    textShadow: `0 0 8px ${teamColor}, 0 0 12px ${teamColor}`
                                                }}
                                            >
                                                {commitCount}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default CommitBoard;