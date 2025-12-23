# 🦈 BidShark - 海大拍賣系統 (NTOU Auction System)

![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

**BidShark** 是一個專為校園設計的物品拍賣平台，整合了競標拍賣與直購功能。本系統採用現代化的 Serverless 架構，解決了雲端部署的諸多限制，並提供響應式設計 (RWD) 與深色模式 (Dark Mode)，致力於提供最佳的使用者體驗。

---

## ✨ 專案亮點與特色 (Key Features)

### 🚀 技術突破與效能優化
*   **Vercel Serverless 架構優化**：針對 Vercel 的請求限制 (4.5MB) 與唯讀環境，實作了獨特的圖片處理流程。
*   **智慧圖片壓縮 (Hybrid Compression)**：
    *   **前端**：使用 `browser-image-compression` 在客戶端預先壓縮圖片，大幅降低上傳頻寬需求。
    *   **後端**：使用 `sharp` 套件生成「縮圖 (Thumbnail)」與「大圖 (Full Image)」，並以 Base64 格式存入 MongoDB，解決 Serverless 無法寫入硬碟的問題。
*   **被動式觸發機制 (Lazy Execution)**：解決 Serverless 無法執行 Cron Job 的問題，在使用者瀏覽競標列表時自動檢查並結算過期商品。

### 💻 使用者介面與體驗 (UI/UX)
*   **響應式設計 (RWD)**：支援 Desktop、Tablet 與 Mobile。手機版具備專屬的側滑選單 (Off-canvas Sidebar) 與優化的觸控介面。
*   **深色模式 (Dark Mode)**：基於 CSS Variables 實作，支援一鍵切換並自動記憶使用者偏好。
*   **即時通知系統**：透過 Polling 機制實現「被超越通知」、「成交通知」與「未讀訊息紅點提示」。

### 🛡️ 安全性與驗證
*   **Google OAuth 2.0**：支援 Google 帳號一鍵登入，並解決了 MongoDB Schema Validation 的相容性問題。
*   **Session 持久化**：使用 `connect-mongo` 將 Session 存入資料庫，避免 Serverless 實例重啟導致登出。

---

## 🛠️ 技術棧 (Tech Stack)

### Frontend
*   **Core**: HTML5, CSS3, Vanilla JavaScript (ES Modules)
*   **Style**: CSS Variables, Flexbox, Grid Layout, Bootstrap 5 (部分元件)
*   **Libraries**: `browser-image-compression` (CDN)

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Language**: TypeScript
*   **Libraries**:
    *   `sharp`: 圖片處理
    *   `google-auth-library`: OAuth 驗證
    *   `multer`: 檔案上傳處理
    *   `bcrypt`: 密碼加密
    *   `express-session` & `connect-mongo`: 會話管理

### Database
*   **MongoDB Atlas**: Cloud NoSQL Document Database

---

## ⚙️ 本地開發安裝指南 (Installation)

### 1. 克隆專案 (Clone Repository)
```bash
git clone https://github.com/你的帳號/BidShark.git
cd BidShark
```

### 2. 安裝依賴 (Install Dependencies)
```bash
npm install
```

### 3. 設定環境變數 (.env)
在專案根目錄建立 `.env` 檔案，並填入以下內容：

```env
# MongoDB 連線字串 (包含帳號密碼)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/BidSharkDB

# Session 加密密鑰 (任意隨機字串)
SESSION_SECRET=your_super_secret_key_123

# Google OAuth 設定 (需至 Google Cloud Console 申請)
GOOGLE_CLIENT_ID=你的_Google_Client_ID
GOOGLE_CLIENT_SECRET=你的_Google_Client_Secret

# 開發環境設定
NODE_ENV=development
```

### 4. 啟動開發伺服器 (Run Development Server)
我們使用 `tsx` 直接執行 TypeScript 檔案，無需預先編譯。

```bash
npm start
```
伺服器預設運行於 `http://localhost:3000`。

---

## ☁️ 部署指南 (Deploy to Vercel)

本專案已針對 Vercel 進行配置 (`vercel.json`)。

1.  將專案 Push 到 GitHub。
2.  在 Vercel Dashboard 匯入專案。
3.  **Framework Preset** 選擇 `Other`。
4.  在 **Environment Variables** 設定中，加入上述 `.env` 的所有變數。
5.  **重要**：新增一個變數 `BASE_URL`，值為你的 Vercel 網址 (例如 `https://bidshark-demo.vercel.app`)，這對於 Google OAuth Redirect 至關重要。
6.  點擊 **Deploy**。

---

## 📂 專案結構 (Project Structure)

```
/BidShark
├── public/                  # 前端靜態資源 (HTML, CSS, JS, Images)
│   ├── css/                 # 樣式表 (含 Dark Mode 變數)
│   ├── javascript/          # 前端邏輯 (含圖片壓縮、Polling)
│   └── ...html              # 各頁面入口
│
├── src/                     # 後端源碼 (TypeScript)
│   ├── index.ts             # 程式進入點 (App Setup & Server Config)
│   ├── Router.ts            # 主路由管理 (匯總所有子路由)
│   ├── ConnectToDB.ts       # MongoDB 資料庫連線池管理
│   │
│   ├── userOperation.ts     # 帳號認證模組 (Login, Signup, Google OAuth)
│   ├── getSessionInfo.ts    # Session 狀態檢查工具
│   ├── session.d.ts         # TypeScript Session 型別定義
│   │
│   ├── dataManipulation.ts  # 商品管理模組 (上架、編輯、圖片處理、直購)
│   ├── auctionService.ts    # 拍賣核心模組 (結標判定、觸發通知)
│   ├── cartService.ts       # 購物車模組 (加入購物車、結帳流程)
│   ├── getDBdata.ts         # 通用資料讀取 (搜尋、歷史訂單、競標紀錄)
│   │
│   ├── chat.ts              # 即時通訊模組 (聊天室建立、訊息發送、未讀計數)
│   └── notificationRouter.ts# 通知系統模組 (取得通知、標記已讀)
│
├── vercel.json              # Vercel 部署設定檔
├── tsconfig.json            # TypeScript 編譯設定
└── package.json             # 專案依賴定義
```

---

## 👥 開發團隊 (Contributors)

**國立臺灣海洋大學 (NTOU)**

| 學號 | 姓名 | 負責項目 |
| :--- | :--- | :--- |
| 01257169 | 張欽平 | 介面設計與前端修正 |
| 01257066 | 劉玉蕃 | 前端介面設計、API / 後端路由實作 |
| 01257127 | 林哲緯 | 主負責核心開發（如資料處理、後端邏輯、API）|
| 01257172 | 鄭寧 | 測試、修復 bugs、補充文件 |
| 01257073 | 王斅民 | UI/前端與功能模組開發 |
| 01257171 | 林承濬 | 部署、專案整合、環境設定 |

---

## 📝 授權 (License)
本專案僅供學術研究與期末報告使用。
