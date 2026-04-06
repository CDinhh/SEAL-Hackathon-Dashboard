import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { getRepoShortName } from '../../utils/converCommitToHeapmap.js';
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
 * Tạo floating params ổn định theo repo key để line và node luôn đồng bộ,
 * kể cả khi repos bị reorder sau commit mới.
 */
const getStableFloatParams = (repoKey) => {
    const key = String(repoKey || 'repo');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) % 100000;
    }

    const duration = 5 + (hash % 3); // 5s -> 7s
    const delay = ((hash % 6) * 0.12); // 0 -> 0.6s
    const ampX = 6 + (hash % 4); // 6 -> 9px
    const ampY = 10 + (hash % 6); // 10 -> 15px

    return {
        duration,
        delay,
        floatX: [0, ampX, -ampX, 0],
        floatY: [0, -ampY, 0],
        rotate: [0, 2, -2, 0],
    };
};

const NODE_TRACKING_SPRING = {
    type: "spring",
    stiffness: 110,
    damping: 20,
    mass: 0.8,
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

const CommitGraph = ({ data, onSimulateCommit }) => {
    const svgRef = useRef(null);
    const [activeCommits, setActiveCommits] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]); // Track commits for 5-minute heat
    const [isSimulateOpen, setIsSimulateOpen] = useState(false); // Trạng thái đóng/mở Dev Controls
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
                // Determine how many new commits came in
                const diff = repo.total_commits - prevRepo.total_commits;
                for (let i = 0; i < diff; i++) {
                    newCommits.push({
                        repoIndex: index,
                        repoName: repo.repo_full_name,
                        timestamp: Date.now(),
                        id: `${repo.repo_full_name}-${Date.now()}-${i}`,
                    });
                }
            }
        });

        if (newCommits.length > 0) {
            setActiveCommits(prev => [...prev, ...newCommits]);
            setRecentActivity(prev => [...prev, ...newCommits]);
        }

        prevDataRef.current = data;
    }, [data]);

    // Auto-cleanup loops
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            // Animation pulses: keep for 1s
            setActiveCommits(prev => prev.filter(c => now - c.timestamp < 1000));
            setRecentActivity(prev => prev.filter(c => now - c.timestamp < 300000));
        }, 1000); // Check every second
        return () => clearInterval(interval);
    }, []);

    // Calculate positions for nodes
    const graphData = useMemo(() => {
        if (!data || data.length === 0) return { center: null, repos: [] };

        const VIEWBOX_WIDTH = 2800;
        const VIEWBOX_HEIGHT = 1600;

        const centerX = VIEWBOX_WIDTH / 2;
        const centerY = VIEWBOX_HEIGHT / 2;

        // Nội suy màu gradient từ Cold (Xanh dương) -> Hot (Đỏ rực)
        const getHeatColor = (ratio) => {
            // Đảm bảo ratio nằm trong [0, 1]
            const clampedRatio = Math.max(0, Math.min(1, ratio));

            // Màu gốc
            const colors = [
                { r: 0, g: 102, b: 255 },    // 0.0 - Xanh dương (Blue - Rất lạnh)
                { r: 0, g: 255, b: 170 },    // 0.3 - Xanh Ngọc (Cyan - Lạnh)
                { r: 57, g: 211, b: 83 },    // 0.5 - Xanh Lá (Green - Ấm vừa)
                { r: 255, g: 215, b: 0 },    // 0.8 - Vàng (Yellow - Nóng)
                { r: 255, g: 0, b: 0 }       // 1.0 - Đỏ (Red - Rất nóng)
            ];

            const stops = [0, 0.3, 0.5, 0.8, 1];

            for (let i = 0; i < stops.length - 1; i++) {
                if (clampedRatio >= stops[i] && clampedRatio <= stops[i + 1]) {
                    const localRatio = (clampedRatio - stops[i]) / (stops[i + 1] - stops[i]);
                    const c1 = colors[i];
                    const c2 = colors[i + 1];
                    const r = Math.round(c1.r + (c2.r - c1.r) * localRatio);
                    const g = Math.round(c1.g + (c2.g - c1.g) * localRatio);
                    const b = Math.round(c1.b + (c2.b - c1.b) * localRatio);
                    return `rgb(${r}, ${g}, ${b})`;
                }
            }
            return `rgb(${colors[colors.length - 1].r}, ${colors[colors.length - 1].g}, ${colors[colors.length - 1].b})`;
        };

        const maxCommits = Math.max(0, ...data.map(r => r.total_commits));

        // Sort repos by commit count - REVERSED: high commits first
        const sortedRepos = [...data].sort((a, b) => b.total_commits - a.total_commits);

        // Split into two rings - HIGH commits on INNER, LOW commits on OUTER
        const midPoint = Math.ceil(sortedRepos.length / 2);
        const innerRepos = sortedRepos.slice(0, midPoint); // High commits
        const outerRepos = sortedRepos.slice(midPoint);    // Low commits

        const innerRadiusX = 600;
        const innerRadiusY = 420;
        const outerRadiusX = 1100;
        const outerRadiusY = 550;

        const repos = [];

        // Get fixed angles for inner ring
        const innerAngles = getFixedAngles(innerRepos.length);

        // Position inner ring repos (HIGH commits - closer)
        innerRepos.forEach((repo, index) => {
            const angle = innerAngles[index];
            const x = centerX + innerRadiusX * Math.cos(angle);
            const y = centerY + innerRadiusY * Math.sin(angle);
            const repoName = getRepoShortName(repo.repo_full_name);

            // Tính toán màu dựa trên tổng số lượng commit
            const ratio = maxCommits > 0 ? (repo.total_commits / maxCommits) : 0;
            const color = getHeatColor(ratio);

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

            // Tính toán màu dựa trên tổng số lượng commit
            const ratio = maxCommits > 0 ? (repo.total_commits / maxCommits) : 0;
            const color = getHeatColor(ratio);

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
        <div className="w-full h-full flex flex-col">
            {/* Graph Container */}
            <div className="flex-1 relative overflow-hidden z-[99]">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${graphData.viewBox.width} ${graphData.viewBox.height}`}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <radialGradient id="centerGradient">
                            <stop offset="0%" stopColor="#f72585" />
                            <stop offset="50%" stopColor="#7209b7" />
                            <stop offset="100%" stopColor="#3a0ca3" />
                        </radialGradient>
                    </defs>

                    {/* === CONNECTIONS LAYER === */}
                    {graphData.repos.map((repo, index) => {
                        const recentCount = recentActivity.filter(c => c.repoName === repo.fullName).length;
                        const HEAT_THRESHOLD = 30;
                        const heatFactor = Math.min(recentCount / HEAT_THRESHOLD, 1);

                        let dynamicColor = repo.color;
                        if (heatFactor > 0.6) dynamicColor = '#FF0000';
                        else if (heatFactor > 0.2) dynamicColor = '#FF8800';

                        const floatParams = getStableFloatParams(repo.fullName);

                        return (
                            <motion.line
                                key={`line-${repo.fullName}`}
                                x1={graphData.center.x}
                                y1={graphData.center.y}
                                stroke={dynamicColor}
                                strokeWidth={heatFactor > 0.2 ? 6 : 3}
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0, x2: graphData.center.x, y2: graphData.center.y }}
                                animate={{
                                    pathLength: 1,
                                    opacity: heatFactor > 0.2 ? 1 : 0.7,
                                    stroke: dynamicColor,
                                    // Keep endpoint pinned to current repo position so it always follows reordering.
                                    x2: repo.x,
                                    y2: repo.y
                                }}
                                style={{
                                    filter: `drop-shadow(0 0 8px ${dynamicColor})`
                                }}
                                transition={{
                                    pathLength: { duration: 1.5, delay: index * 0.05, ease: "easeInOut" },
                                    opacity: { duration: 1.5, delay: index * 0.05 },
                                    stroke: { duration: 0.5 },
                                    x2: NODE_TRACKING_SPRING,
                                    y2: NODE_TRACKING_SPRING
                                }}
                            />
                        );
                    })}

                    {/* === ENERGY PULSES === */}
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

                    {/* === CENTER REACTOR NODE === */}
                    <g transform={`translate(${graphData.center.x}, ${graphData.center.y})`}>
                        {/* Outer Rotation Ring */}
                        <motion.circle
                            r={graphData.center.size + 40}
                            fill="none"
                            stroke="#4cc9f0"
                            strokeWidth={2}
                            strokeDasharray="20,20"
                            opacity="0.3"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        />
                        {/* Inner Counter-Rotation Ring */}
                        <motion.circle
                            r={graphData.center.size + 15}
                            fill="none"
                            stroke="#f72585"
                            strokeWidth={3}
                            strokeDasharray="10, 30"
                            opacity="0.5"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        />

                        {/* Core Pulse Ring (Reaction) */}
                        {activeCommits.length > 0 && (
                            <motion.circle
                                r={graphData.center.size}
                                fill="none"
                                stroke="#f72585"
                                strokeWidth={6}
                                initial={{ r: graphData.center.size, opacity: 0.8 }}
                                animate={{
                                    r: graphData.center.size + 80,
                                    opacity: 0,
                                }}
                                transition={{
                                    duration: 1.2,
                                    ease: "easeOut",
                                }}
                            />
                        )}

                        {/* Main Core */}
                        <motion.circle
                            r={graphData.center.size}
                            fill="url(#centerGradient)"
                            stroke="#f72585"
                            strokeWidth={4}
                            style={{ filter: "drop-shadow(0 0 30px #7209b7)" }}
                            animate={{
                                scale: activeCommits.length > 0 ? [1, 1.1, 1] : 1,
                                filter: activeCommits.length > 0
                                    ? ["drop-shadow(0 0 30px #7209b7)", "drop-shadow(0 0 60px #f72585)", "drop-shadow(0 0 30px #7209b7)"]
                                    : "drop-shadow(0 0 30px #7209b7)"
                            }}
                            transition={{ duration: 0.5 }}
                        />

                        {/* Logo Image */}
                        <image
                            href={logoHackathon}
                            x="-90"
                            y="-90"
                            width="180"
                            height="180"
                            opacity="0.95"
                            style={{ pointerEvents: 'none' }}
                        />
                    </g>

                    {/* === REPO NODES === */}
                    {graphData.repos.map((repo, index) => {
                        // Relative layout calculations
                        const labelDistance = 100;
                        const localLabelX = labelDistance * Math.cos(repo.angle);
                        const localLabelY = labelDistance * Math.sin(repo.angle);

                        // Rectangle dimensions
                        const rectWidth = 290;
                        const rectHeight = 115;

                        // Center the rect around the label point
                        const localRectX = localLabelX - rectWidth / 2;
                        const localRectY = localLabelY - rectHeight / 2;

                        const displayRepoName = repo.repoName.length > 15
                            ? repo.repoName.substring(0, 12) + '..'
                            : repo.repoName;

                        const maxCommits = Math.max(...graphData.repos.map(r => r.commits));
                        const getHeatmapColor = (count) => {
                            if (count === 0) return '#1a0b2e'; // Dark Base
                            const ratio = count / maxCommits;

                            // 8-step fine-grained color scale
                            if (ratio <= 0.125) return '#3a0ca3'; // Deep Purple
                            if (ratio <= 0.250) return '#4361ee'; // Royal Blue
                            if (ratio <= 0.375) return '#4cc9f0'; // Neon Cyan
                            if (ratio <= 0.500) return '#2ecc71'; // Neon Green
                            if (ratio <= 0.625) return '#b4b709ff'; // Bright Yellow-Green (User preference)
                            if (ratio <= 0.750) return '#f39c12'; // Neon Orange
                            if (ratio <= 0.875) return '#f72585'; // Neon Pink
                            return '#ff0054'; // Strong Neon Red for Top
                        };

                        const badgeColor = getHeatmapColor(repo.commits);
                        const isTop1 = repo.commits === maxCommits && maxCommits > 0;
                        const repoRecentActivity = recentActivity.filter(c => c.repoName === repo.fullName);
                        const recentCount = repoRecentActivity.length;
                        const HEAT_THRESHOLD = 30;
                        const heatFactor = Math.min(recentCount / HEAT_THRESHOLD, 1);
                        const dynamicScale = 1 + heatFactor * 0.35;

                        // Tính toán màu cho con số hiển thị (Vận tốc commit)
                        let numberColor = '#ffffff'; // Mặc định màu trắng
                        if (recentCount > 0) {
                            const latestCommitTime = Math.max(...repoRecentActivity.map(c => c.timestamp));
                            const timeSinceLatest = Date.now() - latestCommitTime;
                            const fadeRatio = Math.min(timeSinceLatest / 300000, 1); // Trôi qua trong 5 phút (300,000ms)

                            // Từ Vàng rực rỡ (Gold: 255, 215, 0) sang Trắng (255, 255, 255)
                            const r = 255;
                            const g = Math.round(215 + (40 * fadeRatio));
                            const b = Math.round(0 + (255 * fadeRatio));
                            numberColor = `rgb(${r}, ${g}, ${b})`;
                        }

                        let dynamicColor = repo.color;
                        const baseBlur = 20 + (heatFactor * 60);
                        const pulseBlur = activeCommits.some(c => c.repoName === repo.fullName) ? 15 : 0;
                        const finalBlur = baseBlur + pulseBlur;

                        if (heatFactor > 0.6) dynamicColor = '#FF0000';
                        else if (heatFactor > 0.2) dynamicColor = '#FF8800';

                        const hasActiveCommit = activeCommits.some(c => c.repoName === repo.fullName);

                        const floatParams = getStableFloatParams(repo.fullName);

                        return (
                            <motion.g
                                key={`node-${repo.fullName}`}
                                initial={{
                                    opacity: 0,
                                    scale: 0,
                                    x: graphData.center.x,
                                    y: graphData.center.y
                                }}
                                animate={{
                                    opacity: 1,
                                    scale: hasActiveCommit ? dynamicScale * 1.1 : dynamicScale,
                                    x: repo.x,
                                    y: repo.y
                                }}
                                transition={{
                                    x: NODE_TRACKING_SPRING,
                                    y: NODE_TRACKING_SPRING,
                                    opacity: { duration: 0.35, delay: index * 0.03 },
                                    scale: {
                                        // Adjust scale duration here
                                        duration: 0.3,
                                        type: "spring",
                                        bounce: 0.5
                                    }
                                }}
                                style={{
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleNodeClick(repo.fullName)}
                            >
                                {/* Floating Animation Wrapper */}
                                <motion.g
                                    animate={{
                                        y: 0,
                                        x: 0,
                                        rotate: floatParams.rotate,
                                        scale: [1, 1.02, 1] // Added subtle constant heartbeat pulse
                                    }}
                                    transition={{
                                        duration: floatParams.duration,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: floatParams.delay
                                    }}
                                >
                                    {/* Repo Pulse Ring (Wave Effect) */}
                                    {hasActiveCommit && (
                                        <motion.rect
                                            x={localRectX - 10}
                                            y={localRectY - 10}
                                            width={rectWidth + 20}
                                            height={rectHeight + 20}
                                            rx="18"
                                            ry="18"
                                            fill="none"
                                            stroke={dynamicColor}
                                            strokeWidth={3}
                                            initial={{ opacity: 0.8, scale: 0.9 }}
                                            animate={{ opacity: 0, scale: 1.4 }} // Increased scale to 1.4 for wider wave
                                            transition={{
                                                duration: 2, // Adjust Pulse/Wave duration here
                                                ease: "easeOut"
                                            }}
                                        />
                                    )}

                                    {/* Crown for Top 1 */}
                                    {isTop1 && (
                                        <motion.text
                                            x={localRectX + rectWidth / 2}
                                            y={localRectY - 45}
                                            textAnchor="middle"
                                            fontSize="56"
                                            initial={{ y: -20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 1, type: "spring" }}
                                            style={{ filter: 'drop-shadow(0 0 15px gold)' }}
                                        >
                                            👑
                                        </motion.text>
                                    )}

                                    {/* Main Card */}
                                    <motion.rect
                                        key={dynamicColor}
                                        className={isTop1 ? "top1-fire-glow" : ""}
                                        x={localRectX}
                                        y={localRectY}
                                        width={rectWidth}
                                        height={rectHeight}
                                        rx="12"
                                        ry="12"
                                        fill="rgba(10, 10, 25, 0.9)"
                                        stroke={isTop1 ? undefined : dynamicColor}
                                        strokeWidth={isTop1 ? 4 : 2}
                                        style={isTop1 ? {} : {
                                            filter: `drop-shadow(0 0 ${finalBlur}px ${dynamicColor})`,
                                            transition: 'filter 0.3s ease-out'
                                        }}
                                        whileHover={isTop1 ? { scale: 1.05 } : { strokeWidth: 4, stroke: "#3CF2F2" }}
                                    />

                                    {/* Repo Name */}
                                    <text
                                        className={isTop1 ? "top1-glitch-text" : ""}
                                        x={localLabelX}
                                        y={localLabelY - 10}
                                        textAnchor="middle"
                                        fill={isTop1 ? "#FFD700" : dynamicColor}
                                        fontSize="30"
                                        fontWeight="bold"
                                        style={isTop1 ? { textShadow: `0 0 15px #FFD700, 0 0 30px #FF8800` } : { textShadow: `0 0 10px ${dynamicColor}` }}
                                    >
                                        {displayRepoName}
                                    </text>

                                    {/* Commit Badge */}
                                    <motion.rect
                                        x={localLabelX - 58}
                                        y={localLabelY + 10}
                                        width={116}
                                        height={42}
                                        rx="8"
                                        fill={badgeColor}
                                        animate={hasActiveCommit ? { fill: [badgeColor, '#ffffff', badgeColor] } : {}}
                                        transition={{ duration: 0.5 }}
                                    />
                                    <motion.text
                                        x={localLabelX}
                                        y={localLabelY + 38}
                                        textAnchor="middle"
                                        fill={numberColor}
                                        fontSize="26"
                                        fontWeight="bold"
                                        animate={{ fill: numberColor }}
                                        transition={{ duration: 1, ease: 'linear' }}
                                        style={recentCount > 0 ? { textShadow: `0 0 10px ${numberColor}` } : {}}
                                    >
                                        {repo.commits}
                                    </motion.text>

                                    {/* Tight Holographic/Laser Border for Top 1 */}
                                    {isTop1 && (
                                        <g style={{ pointerEvents: 'none' }}>
                                            {/* Glowing Aura Base */}
                                            <motion.rect
                                                x={localRectX - 4}
                                                y={localRectY - 4}
                                                width={rectWidth + 8}
                                                height={rectHeight + 8}
                                                rx="16"
                                                ry="16"
                                                fill="none"
                                                stroke="#FFD700"
                                                strokeWidth={3}
                                                opacity="0.8"
                                                style={{ filter: 'drop-shadow(0 0 12px #FFD700)' }}
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            />
                                            {/* Cyan Laser Beam 1 (Clockwise) */}
                                            <motion.rect
                                                x={localRectX - 4}
                                                y={localRectY - 4}
                                                width={rectWidth + 8}
                                                height={rectHeight + 8}
                                                rx="16"
                                                ry="16"
                                                fill="none"
                                                stroke="#3CF2F2"
                                                strokeWidth={4}
                                                strokeLinecap="round"
                                                style={{ filter: 'drop-shadow(0 0 12px #3CF2F2)' }}
                                                initial={{ pathLength: 0.2, pathOffset: 0 }}
                                                animate={{ pathOffset: 1 }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                            />
                                            {/* Magenta Laser Beam 2 (Offset by half perimeter) */}
                                            <motion.rect
                                                x={localRectX - 4}
                                                y={localRectY - 4}
                                                width={rectWidth + 8}
                                                height={rectHeight + 8}
                                                rx="16"
                                                ry="16"
                                                fill="none"
                                                stroke="#FF003C"
                                                strokeWidth={4}
                                                strokeLinecap="round"
                                                style={{ filter: 'drop-shadow(0 0 12px #FF003C)' }}
                                                initial={{ pathLength: 0.2, pathOffset: 0.5 }}
                                                animate={{ pathOffset: 1.5 }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                            />
                                        </g>
                                    )}
                                </motion.g>
                            </motion.g>
                        );
                    })}
                </svg>
            </div>

            {/* Footer Zone (Timeline only) */}
            <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
                <div className="flex gap-1.5 justify-end flex-wrap">
                    {timelineData.map(({ hour, commits }, i) => {
                        const maxCommits = Math.max(...timelineData.map(t => t.commits));
                        const intensity = maxCommits > 0 ? commits / maxCommits : 0;
                        return (
                            <motion.div
                                key={hour}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
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

            {/* Dev Controls Toggle */}
            <div className="absolute bottom-4 left-4 z-[100] pointer-events-auto flex flex-col items-start gap-2">
                <AnimatePresence>
                    {isSimulateOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: 20 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: 20 }}
                            className="flex flex-col gap-2 p-4 bg-black/90 rounded-lg border border-white/20 max-h-[400px] w-64 overflow-y-auto shadow-2xl backdrop-blur-md overflow-hidden"
                        >
                            <h3 className="text-white text-sm font-bold mb-2">Simulate Commit</h3>
                            {[...graphData.repos]
                                .sort((a, b) => a.repoName.localeCompare(b.repoName, 'en', { sensitivity: 'base', numeric: true }))
                                .map((repo) => (
                                    <button
                                        key={repo.fullName}
                                        onClick={() => {
                                            if (onSimulateCommit) {
                                                onSimulateCommit(repo.fullName);
                                            }
                                        }}
                                        className="text-sm px-3 py-2 rounded bg-gray-800 text-white hover:bg-gray-700 transition-colors text-left font-medium flex items-center gap-2 w-full border border-gray-700"
                                        style={{ borderLeft: `4px solid ${repo.color}` }}
                                    >
                                        <span className="truncate">{repo.repoName}</span>
                                    </button>
                                ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setIsSimulateOpen(!isSimulateOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-lg shadow-xl hover:bg-gray-800 transition-all text-white font-bold text-sm"
                >
                    <span className="text-cyan-400">⚡</span>
                    Simulate
                    <span className="text-gray-400 ml-1 text-xs">
                        {isSimulateOpen ? '▼' : '▲'}
                    </span>
                </button>
            </div>

        </div >
    );
};

export default CommitGraph;
