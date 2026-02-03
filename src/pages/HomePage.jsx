import { useCallback, useState } from 'react'
import CommitGraph from '../components/CommitGraph/CommitGraph'
import MainHeader from '../components/MainHeader/MainHeader'
import { useRealtimeCommits } from '../hooks/useRealtimeCommits.js'

const HomePage = () => {

  const [commits, setCommits] = useState([]);
  // Khi có commit mới
  const handleNewCommit = useCallback((newCommit) => {
    setCommits((prev) => {
      const foundRepoIndex = prev.findIndex(
        (r) => r.repo_full_name === newCommit.repo_full_name
      );

      if (foundRepoIndex !== -1) {
        // ✅ Repo đã tồn tại
        const updatedRepo = {
          ...prev[foundRepoIndex],
          total_commits: prev[foundRepoIndex].total_commits + 1,
          commits: [...prev[foundRepoIndex].commits, newCommit],
          highlight: true, // thêm flag để highlight
        };

        // Đưa repo đó lên đầu danh sách
        const newList = [
          updatedRepo,
          ...prev.filter((_, idx) => idx !== foundRepoIndex),
        ];

        // Sau 3s bỏ highlight
        setTimeout(() => {
          setCommits((current) =>
            current.map((repo) =>
              repo.repo_full_name === updatedRepo.repo_full_name
                ? { ...repo, highlight: false }
                : repo
            )
          );
        }, 3000);

        return newList;
      } else {
        // ✅ Repo mới hoàn toàn
        const newRepo = {
          repo_full_name: newCommit.repo_full_name,
          total_commits: 1,
          commits: [newCommit],
          highlight: true,
        };

        // Sau 3s bỏ highlight
        setTimeout(() => {
          setCommits((current) =>
            current.map((repo) =>
              repo.repo_full_name === newRepo.repo_full_name
                ? { ...repo, highlight: false }
                : repo
            )
          );
        }, 3000);

        return [newRepo, ...prev];
      }
    });
  }, []);

  useRealtimeCommits(handleNewCommit);
  return (
    <div className='h-screen overflow-hidden relative p-5'>

      {/* Graph Network Background */}
      <div className="network-lines">
        {/* Generate random graph edges */}
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={`net-line-${i}`}
            className="network-line"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${100 + Math.random() * 300}px`,
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: 0.2 + Math.random() * 0.3
            }}
          ></div>
        ))}
      </div>

      {/* Enhanced Binary Rain */}
      <div className="binary-rain">
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            className="binary-char"
            style={{
              left: `${i * 3.3}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${4 + Math.random() * 2}s`,
              fontSize: `${12 + Math.random() * 6}px`,
              color: i % 3 === 0 ? '#00ff88' : i % 3 === 1 ? '#00ffff' : '#ff00ff'
            }}
          >
            {Math.random() > 0.5 ? '1' : '0'}
          </div>
        ))}
      </div>

      {/* Hexagon Particles */}
      <div className="hackathon-particles">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={`hex-${i}`}
            className="hex-particle"
            style={{
              left: `${i * 12.5}%`,
              animationDelay: `${Math.random() * 12}s`,
              animationDuration: `${10 + Math.random() * 4}s`
            }}
          ></div>
        ))}
      </div>

      {/* Data Stream Particles */}
      <div className="hackathon-particles">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={`data-${i}`}
            className="data-stream"
            style={{
              top: `${10 + i * 8}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${15 + Math.random() * 3}s`
            }}
          >
            {['</>', '{}', '[]', '()', 'git;', 'commit;', '//'][Math.floor(Math.random() * 7)]}
          </div>
        ))}
      </div>

      {/* Pulse Rings */}
      <div className="pulse-ring" style={{ top: '20%', left: '10%', width: '100px', height: '100px', animationDelay: '0s' }}></div>
      <div className="pulse-ring" style={{ top: '60%', right: '15%', width: '150px', height: '150px', animationDelay: '1s' }}></div>
      <div className="pulse-ring" style={{ bottom: '30%', left: '70%', width: '80px', height: '80px', animationDelay: '2s' }}></div>

      {/* Energy Orbs */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={`orb-${i}`}
          className="energy-orb"
          style={{
            top: `${20 + i * 10}%`,
            left: `${10 + i * 15}%`,
            animationDelay: `${i * 1.3}s`,
            animationDuration: `${6 + Math.random() * 4}s`
          }}
        ></div>
      ))}

      {/* Scanning Line */}
      <div className="scan-line"></div>

      {/* Main content with enhanced glassmorphism */}
      <div className="relative z-10 px-7">
        <MainHeader />
        {commits && commits.length > 0 ? (
          <CommitGraph data={commits} />
        ) : (
          <div className="text-fuchsia-300 font-mono select-none p-8">
            {/* Loading/Empty State */}
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
              {/* Animated loading spinner */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>

              {/* Loading text with typing effect */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-fuchsia-400 animate-pulse">
                  INITIALIZING HACKATHON DASHBOARD...
                </h3>
                <p className="text-violet-300 text-sm">
                  Connecting to repositories<span className="animate-pulse">...</span>
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-64 h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div className="h-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>

              {/* Decorative elements */}
              <div className="flex space-x-4 text-xs text-fuchsia-500/50">
                <span className="animate-pulse">LOADING...</span>
                <span className="animate-pulse" style={{ animationDelay: '0.5s' }}>SCANNING...</span>
                <span className="animate-pulse" style={{ animationDelay: '1s' }}>ANALYZING...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
