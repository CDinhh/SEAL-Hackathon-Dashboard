import React, { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

import { getTeamColor, getRepoShortName } from '../../utils/converCommitToHeapmap.js';
import logoHackathon from '../../assets/logo-hackathon.png';

const hours = [7, 8, 9, 10, 11, 12, 13, 14];

const CommitGraph = ({ data }) => {
    const svgRef = useRef(null);

    // Calculate positions for nodes
    const graphData = useMemo(() => {
        if (!data || data.length === 0) return { center: null, repos: [] };

        const VIEWBOX_WIDTH = 2800;
        const VIEWBOX_HEIGHT = 1600;

        const centerX = VIEWBOX_WIDTH / 2;
        const centerY = VIEWBOX_HEIGHT / 2;

        // Sort repos by commit count - REVERSED: high commits first
        const sortedRepos = [...data].sort((a, b) => b.total_commits - a.total_commits);

        // Split into two rings - HIGH commits on INNER, LOW commits on OUTER
        const midPoint = Math.ceil(sortedRepos.length / 2);
        const innerRepos = sortedRepos.slice(0, midPoint); // High commits
        const outerRepos = sortedRepos.slice(midPoint);    // Low commits

        const innerRadiusX = 600;
        const innerRadiusY = 420;
        const outerRadiusX = 1100;
        const outerRadiusY = 550; // Reduced to lift bottom nodes up

        const repos = [];

        // Position inner ring repos (HIGH commits - closer)
        innerRepos.forEach((repo, index) => {
            const angle = (index / innerRepos.length) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + innerRadiusX * Math.cos(angle);
            const y = centerY + innerRadiusY * Math.sin(angle);
            const repoName = getRepoShortName(repo.repo_full_name);
            const color = getTeamColor(repoName);

            repos.push({
                x,
                y,
                color,
                repoName,
                fullName: repo.repo_full_name,
                commits: repo.total_commits,
                angle,
                ring: 'inner'
            });
        });

        // Position outer ring repos (LOW commits - farther)
        outerRepos.forEach((repo, index) => {
            const angle = (index / outerRepos.length) * 2 * Math.PI - Math.PI / 2 + Math.PI / outerRepos.length; // Offset for stagger
            const x = centerX + outerRadiusX * Math.cos(angle);
            const y = centerY + outerRadiusY * Math.sin(angle);
            const repoName = getRepoShortName(repo.repo_full_name);
            const color = getTeamColor(repoName);

            repos.push({
                x,
                y,
                color,
                repoName,
                fullName: repo.repo_full_name,
                commits: repo.total_commits,
                angle,
                ring: 'outer'
            });
        });

        return {
            center: { x: centerX, y: centerY, size: 130 },
            repos,
            viewBox: { width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT }
        };
    }, [data]);

    // Calculate commits per hour for timeline
    const timelineData = useMemo(() => {
        return hours.map(hour => {
            const commitsInHour = data.reduce((sum, repo) => {
                return sum + repo.commits.filter(c => {
                    const h = new Date(c.timestamp).getHours();
                    return h === hour;
                }).length;
            }, 0);
            return { hour, commits: commitsInHour };
        });
    }, [data]);

    const handleNodeClick = (fullName) => {
        window.open(`https://github.com/${fullName}`, '_blank');
    };

    if (!graphData.center) {
        return <div className="text-white">Loading...</div>;
    }

    return (
        <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
            {/* Graph Container */}
            <div className="flex-1 relative overflow-hidden">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${graphData.viewBox.width} ${graphData.viewBox.height}`}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >

                    {/* Draw connections from center to repos */}
                    {graphData.repos.map((repo, index) => (
                        <motion.line
                            key={`line-${index}`}
                            x1={graphData.center.x}
                            y1={graphData.center.y}
                            x2={repo.x}
                            y2={repo.y}
                            stroke={repo.color}
                            strokeWidth="2"
                            initial={{ x2: graphData.center.x, y2: graphData.center.y, opacity: 0 }}
                            animate={{ x2: repo.x, y2: repo.y, opacity: 0.5 }}
                            transition={{
                                duration: 0.4,
                                delay: index * 0.1,
                                ease: "easeOut"
                            }}
                        />
                    ))}

                    {/* Draw center node - Cosmic Gradient */}
                    <defs>
                        <radialGradient id="centerGradient">
                            <stop offset="0%" stopColor="#f72585" />
                            <stop offset="100%" stopColor="#7209b7" />
                        </radialGradient>
                    </defs>
                    <circle
                        cx={graphData.center.x}
                        cy={graphData.center.y}
                        r={graphData.center.size}
                        fill="url(#centerGradient)"
                        stroke="#f72585"
                        strokeWidth="3"
                        opacity="0.9"
                        style={{ filter: "drop-shadow(0 0 15px #7209b7)" }}
                    />

                    {/* Center logo */}
                    <image
                        href={logoHackathon}
                        x={graphData.center.x - 90}
                        y={graphData.center.y - 90}
                        width="180"
                        height="180"
                        opacity="0.9"
                    />

                    {/* Draw repo nodes */}
                    {graphData.repos.map((repo, index) => {
                        // Label offset - push outward based on angle
                        const labelDistance = 100;
                        const labelX = repo.x + labelDistance * Math.cos(repo.angle);
                        const labelY = repo.y + labelDistance * Math.sin(repo.angle);

                        // Rectangle dimensions
                        const rectWidth = 290;
                        const rectHeight = 115;
                        const rectX = labelX - rectWidth / 2;
                        const rectY = labelY - rectHeight / 2;

                        // Truncate function
                        const displayRepoName = repo.repoName.length > 15
                            ? repo.repoName.substring(0, 12) + '..'
                            : repo.repoName;

                        // Cosmic Heatmap Color Scale (Green for commits)
                        const maxCommits = Math.max(...graphData.repos.map(r => r.commits));
                        const getHeatmapColor = (count) => {
                            if (count === 0) return '#1a0b2e'; // Empty (Dark Void - Keeping theme background)
                            const ratio = count / maxCommits;
                            if (ratio < 0.25) return '#0e4429'; // Level 1 (Dark Green)
                            if (ratio < 0.5) return '#006d32';  // Level 2 (Medium Green)
                            if (ratio < 0.75) return '#26a641'; // Level 3 (Light Green)
                            return '#39d353';                   // Level 4 (Neon Green)
                        };

                        const badgeColor = getHeatmapColor(repo.commits);
                        const isTop1 = repo.commits === maxCommits && maxCommits > 0;

                        return (
                            <motion.g
                                key={`node-${index}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1, y: [0, -15, 0] }}
                                whileHover={{ scale: 1.1 }}
                                transition={{
                                    default: { // For entrance
                                        duration: 0.5,
                                        delay: index * 0.1 + 0.35,
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 20
                                    },
                                    y: { // For floating loop
                                        duration: 4 + (index % 3), // Random-ish duration 4-6s
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: index * 0.2 // delay start of float slightly
                                    }
                                }}
                                onClick={() => handleNodeClick(repo.fullName)}
                                style={{ cursor: 'pointer', transformOrigin: 'center' }}
                                className="hover:opacity-80 transition-opacity"
                            >
                                {/* Node indicator - small circle at original position */}
                                <circle
                                    cx={repo.x}
                                    cy={repo.y}
                                    r="9"
                                    fill="#4cc9f0"
                                    stroke="#ffffff"
                                    strokeWidth="3"
                                    opacity="0.8"
                                    style={{ filter: "drop-shadow(0 0 5px #4cc9f0)" }}
                                />

                                {/* Crown for Top 1 */}
                                {isTop1 && (
                                    <text
                                        x={rectX + rectWidth / 2}
                                        y={rectY - 15}
                                        textAnchor="middle"
                                        fontSize="48"
                                        style={{ filter: 'drop-shadow(0 0 10px gold)' }}
                                    >
                                        👑
                                    </text>
                                )}

                                {/* Label rectangle - positioned radially */}
                                <rect
                                    x={rectX}
                                    y={rectY}
                                    width={rectWidth}
                                    height={rectHeight}
                                    rx="12"
                                    ry="12"
                                    fill="rgba(20, 10, 35, 0.95)"
                                    stroke={isTop1 ? "green" : repo.color}
                                    strokeWidth={isTop1 ? "3" : "2"}
                                    opacity="0.95"
                                    style={{ filter: isTop1 ? "drop-shadow(0 0 15px rgba(4, 255, 0, 0.6))" : "drop-shadow(0 0 10px rgba(114, 9, 183, 0.3))" }}
                                />

                                {/* Static Border Element for Top 1 (No pulsing) */}
                                {isTop1 && (
                                    <rect
                                        x={rectX - 5}
                                        y={rectY - 5}
                                        width={rectWidth + 10}
                                        height={rectHeight + 10}
                                        rx="16"
                                        ry="16"
                                        fill="none"
                                        stroke="green"
                                        strokeWidth="2"
                                        opacity="0.5"
                                    />
                                )}

                                {/* Repo name - top part with team color */}
                                <text
                                    x={labelX}
                                    y={labelY - 10}
                                    textAnchor="middle"
                                    fill={repo.color}
                                    fontSize="30"
                                    fontWeight="bold"
                                >
                                    {displayRepoName}
                                </text>
                                {/* Commit count badge - cosmic background */}
                                <rect
                                    x={labelX - 58}
                                    y={labelY + 10}
                                    width="116"
                                    height="42"
                                    rx="8"
                                    ry="8"
                                    fill={isTop1 ? "#00ff15ff" : badgeColor}
                                    opacity="1"
                                />
                                <text
                                    x={labelX}
                                    y={labelY + 38}
                                    textAnchor="middle"
                                    fill={isTop1 ? "#000000" : '#ffffff'}
                                    fontSize="26"
                                    fontWeight="bold"
                                >
                                    {repo.commits}
                                </text>
                            </motion.g>
                        );
                    })}
                </svg>




            </div>

            {/* Timeline - Compact display with Green/Cosmic Fusion */}
            <div className="">
                <div className="flex gap-1.5 justify-end flex-wrap mb-3">
                    {timelineData.map(({ hour, commits }) => {
                        const maxCommits = Math.max(...timelineData.map(t => t.commits));
                        const intensity = maxCommits > 0 ? commits / maxCommits : 0;

                        return (
                            <motion.div
                                key={hour}
                                whileHover={{ scale: 1.05, y: -2 }}
                                className="px-2 py-1 rounded font-bold transition-all bg-gray-900 border border-green-900"
                                style={{
                                    background: commits > 0
                                        ? `linear-gradient(135deg, rgba(38, 166, 65, ${0.2 + intensity * 0.8}), rgba(57, 211, 83, ${0.2 + intensity * 0.8}))`
                                        : 'rgb(20, 10, 30)',
                                    borderColor: commits > 0
                                        ? `rgba(57, 211, 83, ${0.3 + intensity * 0.7})`
                                        : 'rgb(40, 20, 60)',
                                    boxShadow: commits > 0 ? `0 0 ${5 + intensity * 10}px rgba(57, 211, 83, 0.3)` : 'none'
                                }}
                            >
                                <div className="text-xs font-bold text-white">{hour}:00</div>
                                <div className={`text-[10px] ${commits > 0 ? 'text-green-300' : 'text-gray-600'}`}>
                                    {commits}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
};

export default CommitGraph;
