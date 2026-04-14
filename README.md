<h1>
	SEAL Hackathon Dashboard
	<a href="https://app.netlify.com/projects/seal-hackathon-dashboard/deploys">
		<img align="right" src="https://api.netlify.com/api/v1/badges/5415e6e9-21f5-43e6-90f5-d1dc3341807d/deploy-status" alt="Netlify Status" />
	</a>
</h1>
 
Dashboard realtime để theo dõi commit của các team trong hackathon.

## 1. Tech stack
- React 19
- Vite 7
- React Router 7
- Tailwind CSS 3
- Firebase Realtime Database (forked from https://github.com/baodhg/SEAL-Hackathon-Dashboard)
- Framer Motion

## 2. Yêu cầu môi trường
- Node.js 18+ (khuyến nghị 20+)
- npm 9+

## 3. Cài đặt và chạy local
1. Cài dependencies:
```bash
npm install
```

2. Tạo file .env ở thư mục gốc (copy từ .env.template):
```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

3. Chạy dev:
```bash
npm run dev
```
Mặc định app chạy tại http://localhost:5173

## 4. Scripts
- npm run dev: chạy local development
- npm run build: build production
- npm run preview: preview bản build
- npm run lint: lint code

## 5. Các thư mục chính
- src/components: UI components
- src/pages: các trang
- src/hooks: custom hooks
- src/service: kết nối realtime provider (Firebase)
- src/utils: hàm xử lý dữ liệu
- docs/workflows: file workflow backend (n8n)

## 6. Backend (n8n) - tóm tắt
Dự án backend dùng n8n để nhận/xử lý commit và đẩy lên Firebase Realtime Database.

Import workflow tại:
- docs/workflows/process-commit.json

Hình workflow:

![Workflow list](outline_img/workflows.png)
![Workflow summary](outline_img/workflow_summary.png)

## 7. Cây thư mục
```text
📦 SEAL-Hackathon-Dashboard/
├─ 📁 docs/
│  ├─ images/
│  └─ workflows/
│     └─ process-commit.json
├─ 📁 outline_img/
│  ├─ workflows.png
│  └─ workflow_summary.png
├─ 📁 public/
│  └─ favicon.ico
├─ 📁 src/
│  ├─ assets/
│  │  ├─ Frame 8.png
│  │  └─ logo-fpt.png
│  ├─ common/
│  │  └─ path.js
│  ├─ components/
│  │  ├─ CommitGraph/CommitGraph.jsx
│  │  ├─ MainHeader/MainHeader.jsx
│  │  ├─ CountdownClock.jsx
│  │  └─ PageNotFound/PageNotFound.jsx
│  ├─ hooks/
│  │  ├─ useRealtimeCommits.js
│  │  └─ useRootesCoustom.jsx
│  ├─ pages/
│  │  └─ HomePage.jsx
│  ├─ service/
│  │  ├─ realtimeManager.js
│  │  └─ realtimeProviders/firebaseProvider.js
│  ├─ template/
│  │  └─ MainTemplate/MainTemplate.jsx
│  ├─ utils/
│  │  └─ converCommitToHeapmap.js
│  ├─ App.jsx
│  ├─ index.css
│  └─ main.jsx
├─ .env.template
├─ eslint.config.js
├─ index.html
├─ package.json
├─ postcss.config.js
├─ README.md
├─ tailwind.config.js
└─ vite.config.js
```

## 8. Lỗi thường gặp
- Trang trống: kiểm tra biến môi trường trong .env, sau đó khởi động lại dev server.
- Không có dữ liệu: kiểm tra Firebase Realtime Database đã có data ở path commit.
- Lỗi Firebase URL: kiểm tra VITE_FIREBASE_DATABASE_URL trong .env.

