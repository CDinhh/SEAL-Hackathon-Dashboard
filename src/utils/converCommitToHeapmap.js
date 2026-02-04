export function convertCommitsToHeatmap(data) {

    const hours = [7, 8, 9, 10, 11, 12, 13, 14];
    const SLOT_COUNT = 4;
    const SLOT_MINUTES = 60 / SLOT_COUNT;

    return data.map(repo => {
        const heatmap = {};

        for (const h of hours) heatmap[h] = new Array(SLOT_COUNT).fill(0);

        (repo.commits || []).forEach(commit => {
            const d = new Date(commit.timestamp);
            const hour = d.getHours();

            if (hour < 7 || hour > 14) return;
            const slot = Math.floor(d.getMinutes() / SLOT_MINUTES);
            try {
                heatmap[hour][slot] += 1;
            } catch (error) {
                console.log(`Error with commit at ${commit.commit_sha}`);
                console.log(`commits:`, commit);
                console.log(`Commit time: ${commit.timestamp}, Parsed hour: ${hour}`);
            }
        });
        return {
            repo_full_name: repo.repo_full_name,
            heatmap,
            highlight: !!repo.highlight,
        };
    });
}

export function sortReposByLatestCommit(repos = []) {
    // Precompute latest commit time cho từng repo (O(n))
    const processed = repos.map(repo => {
        const latestCommitTime = repo.commits?.length
            ? Math.max(...repo.commits.map(c => new Date(c.timestamp).getTime()))
            : 0; // 0 cho repo chưa có commit
        return { ...repo, latestCommitTime };
    });

    // Sort theo latestCommitTime giảm dần (O(n log n))
    return processed.sort((a, b) => b.latestCommitTime - a.latestCommitTime);
}

// 🎨 30 màu OKLCH cố định – tone sáng, contrast cao cho nền tối
// 🎨 30 màu Heatmap Gradient (Red -> Orange -> Yellow -> Green -> Blue)
const HEATMAP_PALETTE = [
    "#FF0000", "#FF1E00", "#FF3C00", "#FF5A00", "#FF7800", // Red to Orange
    "#FF9600", "#FFB400", "#FFD200", "#FFF000", "#FFFF00", // Orange to Yellow
    "#CCFF00", "#99FF00", "#66FF00", "#33FF00", "#00FF00", // Yellow to Green
    "#00FF33", "#00FF66", "#00FF99", "#00FFCC", "#00FFFF", // Green to Cyan
    "#00CCFF", "#0099FF", "#0066FF", "#0033FF", "#0000FF", // Cyan to Blue
    "#3300FF", "#6600FF", "#9900FF", "#CC00FF", "#FF00FF"  // Blue to Magenta
];

// 🗺️ Lưu map repo → màu vào localStorage
export function getTeamColor(teamName) {
    if (!teamName) return '#ccc';

    const storageKey = `team-color-map-heatmap-v2`;
    let colorMap = {};

    // 🔹 Load từ localStorage
    try {
        colorMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
        colorMap = {};
    }

    // 🔹 Nếu repo đã có màu → trả về luôn
    if (colorMap[teamName]) return colorMap[teamName];

    // 🔹 Chiến thuật chọn màu phân tán (Stride = 5)
    // Thay vì chọn 0, 1, 2, 3... (tất cả đều đỏ/cam), ta chọn 0, 5, 10, 15... (Đỏ, Vàng, Xanh Lá, Xanh Dương...)
    const usedColors = Object.values(colorMap);
    const STRIDE = 5;
    let selectedColor = HEATMAP_PALETTE[0];

    // Tạo danh sách ưu tiên chỉ số: [0, 5, 10, 15, 20, 25, 1, 6, 11, ...]
    const preferredIndices = [];
    for (let offset = 0; offset < STRIDE; offset++) {
        for (let i = offset; i < HEATMAP_PALETTE.length; i += STRIDE) {
            preferredIndices.push(i);
        }
    }

    // Tìm màu chưa dùng theo thứ tự ưu tiên
    for (const index of preferredIndices) {
        if (!usedColors.includes(HEATMAP_PALETTE[index])) {
            selectedColor = HEATMAP_PALETTE[index];
            break;
        }
    }

    // 🔹 Lưu lại để cố định lần sau (F5 vẫn giữ)
    colorMap[teamName] = selectedColor;
    localStorage.setItem(storageKey, JSON.stringify(colorMap));

    return selectedColor;
}

export function getRepoShortName(fullName) {
    if (typeof fullName !== "string") return "";

    const parts = fullName.split("/");
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
}
