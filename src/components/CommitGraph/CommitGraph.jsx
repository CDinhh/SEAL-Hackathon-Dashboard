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

        const centerX = 400;
        const centerY = 300;
        const radius = 200;

        const repos = data.map((repo, index) => {
            const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const repoName = getRepoShortName(repo.repo_full_name);
            const color = getTeamColor(repoName);
            const nodeSize = Math.max(30, Math.min(50, 30 + repo.total_commits * 0.8));

            return {
                x,
                y,
                size: nodeSize,
                color,
                repoName,
                fullName: repo.repo_full_name,
                commits: repo.total_commits
            };
        });

        return {
            center: { x: centerX, y: centerY, size: 60 },
            repos
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
        <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            {/* Graph Container */}
            <div className="flex-1 relative bg-gradient-to-br from-gray-900 via-purple-900/20 to-black rounded-lg border border-pink-500/30 shadow-2xl shadow-cyan-500/20 overflow-hidden">
                <svg
                    ref={svgRef}
                    viewBox="0 0 800 600"
                    className="w-full h-full"
                    style={{ maxHeight: '600px' }}
                >
                    {/* Draw connections from center to repos */}
                    {graphData.repos.map((repo, index) => (
                        <line
                            key={`line-${index}`}
                            x1={graphData.center.x}
                            y1={graphData.center.y}
                            x2={repo.x}
                            y2={repo.y}
                            stroke={repo.color}
                            strokeWidth="2"
                            opacity="0.6"
                        />
                    ))}

                    {/* Draw center node */}
                    <circle
                        cx={graphData.center.x}
                        cy={graphData.center.y}
                        r={graphData.center.size}
                        fill="#ff00ff"
                        stroke="#ffffff"
                        strokeWidth="3"
                        opacity="0.9"
                    />

                    {/* Center logo */}
                    <image
                        href={logoHackathon}
                        x={graphData.center.x - 40}
                        y={graphData.center.y - 40}
                        width="80"
                        height="80"
                        opacity="0.9"
                    />

                    {/* Draw repo nodes */}
                    {graphData.repos.map((repo, index) => (
                        <g
                            key={`node-${index}`}
                            onClick={() => handleNodeClick(repo.fullName)}
                            style={{ cursor: 'pointer' }}
                            className="hover:opacity-80 transition-opacity"
                        >
                            <circle
                                cx={repo.x}
                                cy={repo.y}
                                r={repo.size}
                                fill={repo.color}
                                stroke="#ffffff"
                                strokeWidth="2"
                                opacity="0.9"
                            />
                            <text
                                x={repo.x}
                                y={repo.y - repo.size - 10}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="12"
                                fontWeight="bold"
                            >
                                {repo.repoName}
                            </text>
                            <text
                                x={repo.x}
                                y={repo.y}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="14"
                                fontWeight="bold"
                            >
                                {repo.commits}
                            </text>
                        </g>
                    ))}
                </svg>




            </div>

            {/* Timeline - Display only (no filter) */}
            <div className="mt-4 bg-gradient-to-r from-gray-900 via-purple-900/30 to-gray-900 rounded-lg border border-pink-500/30 shadow-lg shadow-cyan-500/10 p-4">
                <h3 className="text-pink-400 font-bold mb-3 text-center text-sm">⏰ COMMIT TIMELINE</h3>
                <div className="flex gap-2 justify-center flex-wrap">
                    {timelineData.map(({ hour, commits }) => {
                        const maxCommits = Math.max(...timelineData.map(t => t.commits));
                        const intensity = maxCommits > 0 ? commits / maxCommits : 0;

                        return (
                            <motion.div
                                key={hour}
                                whileHover={{ scale: 1.05, y: -2 }}
                                className="px-3 py-2 rounded-lg font-bold transition-all bg-gray-800 border-2 border-gray-600"
                                style={{
                                    background: commits > 0
                                        ? `linear-gradient(135deg, rgba(6, 182, 212, ${0.2 + intensity * 0.8}), rgba(59, 130, 246, ${0.2 + intensity * 0.8}))`
                                        : 'rgb(31, 41, 55)',
                                    borderColor: commits > 0
                                        ? `rgba(6, 182, 212, ${0.3 + intensity * 0.7})`
                                        : 'rgb(75, 85, 99)',
                                }}
                            >
                                <div className="text-sm font-bold text-white">{hour}:00</div>
                                <div className={`text-xs ${commits > 0 ? 'text-cyan-300' : 'text-gray-500'}`}>
                                    {commits} commits
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CommitGraph;
