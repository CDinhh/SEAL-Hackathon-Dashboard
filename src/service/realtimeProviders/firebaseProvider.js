import { initializeApp } from "firebase/app";
import { getDatabase, ref, onChildAdded, onChildChanged } from "firebase/database";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Khởi tạo Firebase App (chỉ 1 lần)
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const normalizeCommit = (rawCommit) => {
    if (!rawCommit || typeof rawCommit !== "object") {
        return rawCommit;
    }

    const repoName = rawCommit.repo_name ?? rawCommit.repo_full_name ?? "";
    const authorName = rawCommit.author ?? rawCommit.author_name ?? "";
    const commitMessage = rawCommit.commit_message ?? rawCommit.message ?? "";
    const commitStats = rawCommit.stats ?? {};
    const additions = commitStats.additions ?? rawCommit.added ?? 0;
    const deletions = commitStats.deletions ?? rawCommit.removed ?? 0;
    const filesChangedCount = commitStats.files_changed_count ?? rawCommit.modified ?? 0;
    const modifiedFilesList = rawCommit.modified_files_list ?? rawCommit.modified_files ?? [];

    return {
        ...rawCommit,
        repo_name: repoName,
        repo_full_name: repoName,
        author: authorName,
        author_name: authorName,
        commit_message: commitMessage,
        message: commitMessage,
        stats: {
            additions,
            deletions,
            files_changed_count: filesChangedCount,
            ...commitStats,
        },
        added: additions,
        removed: deletions,
        modified: filesChangedCount,
        modified_files_list: Array.isArray(modifiedFilesList) ? modifiedFilesList : [],
    };
};

export const listenFirebaseCommits = (onNewCommit) => {
    // Giả sử commit của Đại vương được lưu ở path /commits
    const commitsRef = ref(db, "commit");

    console.log("🔥 [Firebase] Listening for new commits...");

    // Lắng nghe khi có node con mới được thêm vào
    const unsubscribe = onChildAdded(commitsRef, (snapshot) => {
        const commit = normalizeCommit(snapshot.val());
        if (commit) {
            console.log("✅ [Firebase] New commit:", commit);
            onNewCommit(commit);
        }
    });

    const unsubscribeChanged = onChildChanged(commitsRef, (snapshot) => {
        const rawCommit = snapshot.val();
        console.log("🟠 Commit bị cập nhật:", rawCommit);
        const commit = normalizeCommit(rawCommit);
        if (commit) {
            console.log("✅ [Firebase] New commit:", commit);
            onNewCommit(commit);
        }
    });

    // Trả về hàm cleanupe m
    return () => {
        unsubscribe();
        unsubscribeChanged();
    };
};
