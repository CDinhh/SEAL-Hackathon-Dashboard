import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { getTeamColor, getRepoShortName } from '../../utils/converCommitToHeapmap.js';
import logoHackathon from '../../assets/logo-hackathon.png';

const hours = [7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Tính toán mảng góc phân bố cho repos dựa trên số lượng
 * @param {number} total - Tổng số repos
 * @param {number} offset - Góc offset (radians) để stagger giữa các rings
 * @returns {number[]} - Mảng các góc (radians)
 */
const getFixedAngles = (total, offset = 0) => {
    if (total === 0) return [];

    if (total === 1) {
        // 1 repo: đặt ở góc 0° (bên phải)
        return [0 + offset];
    }

    if (total === 2) {
        // 2 repos: đối xứng chéo (tránh line-up ngang)
        // Đặt ở góc 45° và 225° (top-right và bottom-left)
        return [Math.PI / 4 + offset, Math.PI + Math.PI / 4 + offset];
    }

    if (total === 3) {
        // 3 repos: tam giác đều (120° mỗi node)
        // Bắt đầu từ -90° để node đầu tiên ở trên
        return [
            -Math.PI / 2 + offset,                      // -90° (top)
            -Math.PI / 2 + (2 * Math.PI / 3) + offset,  // 30° (bottom-right)
            -Math.PI / 2 + (4 * Math.PI / 3) + offset   // 150° (bottom-left)
        ];
    }

    if (total === 4) {
        // 4 repos: hình vuông (90° mỗi node)
        return [
            -Math.PI / 2 + offset,           // -90° (top)
            0 + offset,                      // 0° (right)
            Math.PI / 2 + offset,            // 90° (bottom)
            Math.PI + offset                 // 180° (left)
        ];
    }

    // 5+ repos: phân bố đều trên vòng tròn
    const angles = [];
    for (let i = 0; i < total; i++) {
        angles.push((i / total) * 2 * Math.PI - Math.PI / 2 + offset);
    }
    return angles;
};

/**
 * Component: Energy Pulse - Hiệu ứng năng lượng chạy trên line
 */
const EnergyPulse = ({ centerX, centerY, targetX, targetY, color }) => {
    return (
        <motion.circle
            cx={centerX}
            cy={centerY}
            r="12"
            fill={color}
            opacity="0"
            style={{ filter: `drop-shadow(0 0 15px ${color})` }}
            initial={{ cx: centerX, cy: centerY, opacity: 0, r: 12 }}
            animate={{
                cx: targetX,
                cy: targetY,
                opacity: [0, 1, 1, 0.5],
                r: [12, 18, 15, 10],
            }}
            transition={{
                duration: 0.8,
                delay: 0.3,
                ease: [0.25, 0.1, 0.25, 1],
            }}
        />
    );
};

const CommitGraph = ({ data }) => {
    const svgRef = useRef(null);
    const [activeCommits, setActiveCommits] = useState([]);
    const prevDataRef = useRef(null);

    // Detect new commits
    useEffect(() => {
        if (!data || !prevDataRef.current) {
            prevDataRef.current = data;
            return;
        }

        const newCommits = [];
        data.forEach((repo, index) => {
            const prevRepo = prevDataRef.current.find(r => r.repo_full_name === repo.repo_full_name);
            if (prevRepo && repo.total_commits > prevRepo.total_commits) {
                newCommits.push({
                    repoIndex: index,
                    repoName: repo.repo_full_name,
                    timestamp: Date.now(),
                    id: `${repo.repo_full_name}-${Date.now()}`,
                });
            }
        });

        if (newCommits.length > 0) {
            setActiveCommits(prev => [...prev, ...newCommits]);
        }

        prevDataRef.current = data;
    }, [data]);

    // Auto-cleanup old commits
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveCommits(prev => prev.filter(c => Date.now() - c.timestamp < 1000));
        }, 100);
        return () => clearInterval(interval);
    }, []);

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

        // Get fixed angles for inner ring
        const innerAngles = getFixedAngles(innerRepos.length);

        // Position inner ring repos (HIGH commits - closer)
        innerRepos.forEach((repo, index) => {
            const angle = innerAngles[index];
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

        // Get fixed angles for outer ring with offset to stagger
        // Offset by half the angle between outer nodes to prevent line-up
        const outerOffset = outerRepos.length > 0 ? Math.PI / outerRepos.length : 0;
        const outerAngles = getFixedAngles(outerRepos.length, outerOffset);

        // Position outer ring repos (LOW commits - farther)
        outerRepos.forEach((repo, index) => {
            const angle = outerAngles[index];
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

                    {/* ========== ANIMATION LAYER: Energy Pulses ========== */}
                    <AnimatePresence>
                        {activeCommits.map((commit) => {
                            const targetRepo = graphData.repos.find(r => r.fullName === commit.repoName);
                            if (!targetRepo) return null;

                            return (
                                <EnergyPulse
                                    key={commit.id}
                                    centerX={graphData.center.x}
                                    centerY={graphData.center.y}
                                    targetX={targetRepo.x}
                                    targetY={targetRepo.y}
                                    color={targetRepo.color}
                                />
                            );
                        })}
                    </AnimatePresence>

                    {/* Draw center node - Cosmic Gradient */}
                    <defs>
                        <radialGradient id="centerGradient">
                            <stop offset="0%" stopColor="#f72585" />
                            <stop offset="100%" stopColor="#7209b7" />
                        </radialGradient>
                    </defs>

                    {/* Center Pulse Ring (Phase 1) */}
                    {activeCommits.length > 0 && (
                        <motion.circle
                            cx={graphData.center.x}
                            cy={graphData.center.y}
                            r={graphData.center.size}
                            fill="none"
                            stroke="#f72585"
                            strokeWidth="4"
                            initial={{ r: graphData.center.size, opacity: 0.8 }}
                            animate={{
                                r: graphData.center.size + 40,
                                opacity: 0,
                            }}
                            transition={{
                                duration: 1.0,
                                ease: "easeOut",
                            }}
                        />
                    )}

                    {/* Center Node with Pulse */}
                    <motion.circle
                        cx={graphData.center.x}
                        cy={graphData.center.y}
                        r={graphData.center.size}
                        fill="url(#centerGradient)"
                        stroke="#f72585"
                        strokeWidth="3"
                        opacity="0.9"
                        style={{ filter: "drop-shadow(0 0 15px #7209b7)" }}
                        animate={activeCommits.length > 0 ? {
                            scale: [1, 1.15, 1],
                            filter: [
                                "drop-shadow(0 0 15px #7209b7)",
                                "drop-shadow(0 0 35px #f72585)",
                                "drop-shadow(0 0 15px #7209b7)",
                            ],
                        } : {}}
                        transition={{
                            duration: 0.5,
                            ease: "easeOut",
                        }}
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

                    {/* Draw node indicators FIRST (behind everything) */}
                    {graphData.repos.map((repo, index) => (
                        <circle
                            key={`indicator-${index}`}
                            cx={repo.x}
                            cy={repo.y}
                            r="9"
                            fill="#4cc9f0"
                            stroke="#ffffff"
                            strokeWidth="3"
                            opacity="0.8"
                            style={{ filter: "drop-shadow(0 0 5px #4cc9f0)" }}
                        />
                    ))}

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

                        // Check if this repo has active commit
                        const hasActiveCommit = activeCommits.some(c => c.repoName === repo.fullName);

                        return (
                            <motion.g
                                key={`node-${index}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: 1,
                                    scale: hasActiveCommit ? [1, 1.2, 1] : 1,
                                    y: hasActiveCommit ? [0, -15, 0] : [0, -15, 0],
                                }}
                                whileHover={{ scale: 1.1 }}
                                transition={{
                                    default: {
                                        duration: 0.5,
                                        delay: index * 0.1 + 0.35,
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 20
                                    },
                                    y: {
                                        duration: hasActiveCommit ? 0.5 : 4 + (index % 3),
                                        repeat: hasActiveCommit ? 0 : Infinity,
                                        ease: "easeInOut",
                                        delay: hasActiveCommit ? 0.8 : index * 0.2,
                                    },
                                    scale: {
                                        duration: 0.5,
                                        delay: 0.8,
                                        ease: "easeOut",
                                    }
                                }}
                                onClick={() => handleNodeClick(repo.fullName)}
                                style={{ cursor: 'pointer', transformOrigin: 'center' }}
                                className="hover:opacity-80 transition-opacity"
                            >
                                {/* Repo Pulse Ring (giống center node) */}
                                {hasActiveCommit && (
                                    <motion.rect
                                        x={rectX - 10}
                                        y={rectY - 10}
                                        width={rectWidth + 20}
                                        height={rectHeight + 20}
                                        rx="18"
                                        ry="18"
                                        fill="none"
                                        stroke={repo.color}
                                        strokeWidth="3"
                                        initial={{ opacity: 0.8 }}
                                        animate={{
                                            opacity: 0,
                                            strokeWidth: [3, 1, 0],
                                        }}
                                        transition={{
                                            duration: 1.0,
                                            delay: 0.8,
                                            ease: "easeOut",
                                        }}
                                    />
                                )}

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
                                <motion.rect
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
                                    animate={hasActiveCommit ? {
                                        filter: [
                                            isTop1 ? "drop-shadow(0 0 15px rgba(4, 255, 0, 0.6))" : "drop-shadow(0 0 10px rgba(114, 9, 183, 0.3))",
                                            `drop-shadow(0 0 25px ${repo.color}) drop-shadow(0 0 45px ${repo.color})`,
                                            isTop1 ? "drop-shadow(0 0 15px rgba(4, 255, 0, 0.6))" : "drop-shadow(0 0 10px rgba(114, 9, 183, 0.3))",
                                        ],
                                    } : {}}
                                    transition={{
                                        duration: 0.6,
                                        delay: 0.8,
                                        ease: "easeOut",
                                    }}
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
                                {/* Commit count badge - WITH FLASH */}
                                <motion.rect
                                    x={labelX - 58}
                                    y={labelY + 10}
                                    width="116"
                                    height="42"
                                    rx="8"
                                    ry="8"
                                    fill={isTop1 ? "#00ff15ff" : badgeColor}
                                    opacity="1"
                                    animate={hasActiveCommit ? {
                                        fill: [
                                            isTop1 ? "#00ff15ff" : badgeColor,
                                            repo.color,
                                            isTop1 ? "#00ff15ff" : badgeColor,
                                        ],
                                    } : {}}
                                    transition={{
                                        duration: 0.6,
                                        delay: 0.8,
                                        ease: "easeInOut",
                                    }}
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
