# AI Library / AI 小书屋

[English](#english) | [中文](#中文)

---

## English

**Live Site:** [library.630381.com](https://library.630381.com)

AI Library is a full-stack digital reading platform designed for schools and educational institutions. It combines an e-book reader with AI-powered reading assistance, gamification, and comprehensive admin management — all in one system.

### Features

**For Readers**
- 📖 EPUB & PDF reader with progress tracking, bookmarks, highlights, and notes
- 🤖 AI reading assistant — explain, define, translate, and chat about book content
- 🌐 Multi-language support: English, 中文, Bahasa Melayu, தமிழ்
- 🌓 Light / Sepia / Dark reading themes with brightness and font size controls
- 📊 Personal reading stats: weekly activity, monthly trends, category distribution
- 🏆 Leaderboard with points, books, and reading time rankings
- 🎮 Gamification: achievements, badges, points, and levels
- 📝 Auto-generated quizzes after book completion
- ❤️ Favorites and reading history with time-range filtering

**For Administrators**
- 📈 Real-time dashboard with KPIs, reading trends, category pie charts, and school comparisons
- 👨‍🎓 Student management with pagination, filters, detail panels, deregister/reregister, and batch export
- 🏫 School management with expandable student reports and batch export
- 📚 Book management with full-text search, upload, copyright tracking
- 📊 Statistics with state/city/school drill-down filters
- 🏅 Leaderboard management with multiple metrics and period filters
- 🔐 Role-based access: super admin → school admin → teacher → student
- 🔍 Global search across books, students, and schools
- 🛡️ IP binding, login session tracking, and device management

### Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts   |
| Backend  | Express.js, TypeScript, JWT authentication           |
| Database | MySQL (mysql2), drizzle-orm                          |
| Reader   | epubjs, pdfjs-dist                                   |
| i18n     | react-i18next (zh / en / ms / ta)                   |
| AI       | Qwen / OpenAI-compatible API                         |

### Project Structure

```
ai-library/
├── api/                    # Express backend
│   ├── routes/             # auth, books, reading, learning, admin, ai, leaderboard
│   ├── middleware/          # JWT auth middleware
│   └── db/                 # Database initialization & connection pool
├── src/                    # React frontend
│   ├── components/         # Reusable UI components & layout
│   ├── pages/              # Page components
│   │   ├── admin/          # Admin dashboard, students, schools, books, etc.
│   │   ├── auth/           # Login, register, forgot password
│   │   ├── books/          # Book list, book detail, home
│   │   ├── leaderboard/    # Public leaderboard
│   │   ├── profile/        # Profile, history, favorites, notes, achievements, growth
│   │   ├── quiz/           # Book quizzes
│   │   └── reader/         # EPUB/PDF reader with AI assistant
│   ├── stores/             # Zustand state management
│   ├── i18n/               # Translation files (zh, en, ms, ta)
│   └── utils/              # API client, export utilities
├── public/                 # Static assets
└── scripts/                # Utility scripts
```

### Getting Started

**Prerequisites:** Node.js 18+, MySQL 8+

```bash
# Clone the repo
git clone https://github.com/zoranges/ai-library.git
cd ai-library

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret

# Start development (frontend + backend concurrently)
npm run dev
```

The app runs at `http://localhost:5173` with the API proxied to `http://localhost:3000`.

**Default accounts (seeded on first run):**

| Role          | Email                       | Password         |
| ------------- | --------------------------- | ---------------- |
| Super Admin   | admin@ailibrary.com         | admin123         |
| School Admin  | schooladmin@ailibrary.com   | schooladmin123   |
| Teacher       | teacher1@ailibrary.com      | teacher123       |
| Student       | student1@ailibrary.com      | student123        |

### Scripts

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start frontend + backend concurrently |
| `npm run build`  | Type-check and build for production  |
| `npm run check`  | TypeScript type-check only           |
| `npm run preview`| Preview production build             |

---

## 中文

**在线地址:** [library.630381.com](https://library.630381.com)

AI 小书屋是一个面向学校和教育机构的数字阅读平台，集电子书阅读、AI 阅读助手、游戏化激励和后台管理于一体。

### 功能特色

**读者端**
- 📖 EPUB / PDF 阅读器，支持进度追踪、书签、高亮和笔记
- 🤖 AI 阅读助手 — 解释、释义、翻译、对话讨论书中内容
- 🌐 多语言支持：English / 中文 / Bahasa Melayu / தமிழ்
- 🌓 浅色 / 护眼 / 深色三种阅读主题，可调亮度和字号
- 📊 个人阅读统计：每周活动、月度趋势、分类分布
- 🏆 排行榜：按积分、阅读量、阅读时长排名
- 🎮 游戏化：成就、徽章、积分、等级系统
- 📝 读完书籍自动生成测验
- ❤️ 收藏和阅读历史，支持时间范围筛选

**管理后台**
- 📈 实时仪表盘：KPI 指标、阅读趋势图、分类饼图、学校对比表
- 👨‍🎓 学生管理：分页、筛选、详情面板、注销/恢复、批量导出
- 🏫 学校管理：展开行查看学生报告、日期筛选、批量导出
- 📚 图书管理：全文搜索、上传、版权信息管理
- 📊 数据统计：州/市/学校逐级筛选
- 🏅 排行榜管理：多种指标和时段筛选
- 🔐 三级权限：超级管理员 → 学校管理员 → 教师 → 学生
- 🔍 全局搜索：图书、学生、学校一键搜索
- 🛡️ IP 绑定、登录会话追踪、设备管理

### 技术栈

| 层级     | 技术                                                  |
| -------- | ----------------------------------------------------- |
| 前端     | React 18, TypeScript, Vite, Tailwind CSS, Recharts    |
| 后端     | Express.js, TypeScript, JWT 认证                      |
| 数据库   | MySQL (mysql2), drizzle-orm                           |
| 阅读器   | epubjs, pdfjs-dist                                    |
| 国际化   | react-i18next (zh / en / ms / ta)                     |
| AI       | 通义千问 / OpenAI 兼容 API                            |

### 项目结构

```
ai-library/
├── api/                    # Express 后端
│   ├── routes/             # 路由：auth, books, reading, learning, admin, ai, leaderboard
│   ├── middleware/          # JWT 认证中间件
│   └── db/                 # 数据库初始化与连接池
├── src/                    # React 前端
│   ├── components/         # 可复用 UI 组件与布局
│   ├── pages/              # 页面组件
│   │   ├── admin/          # 管理后台各页面
│   │   ├── auth/           # 登录、注册、忘记密码
│   │   ├── books/          # 图书列表、详情、首页
│   │   ├── leaderboard/    # 公开排行榜
│   │   ├── profile/        # 个人中心、历史、收藏、笔记、成就、成长档案
│   │   ├── quiz/           # 阅读测验
│   │   └── reader/         # EPUB/PDF 阅读器 + AI 助手
│   ├── stores/             # Zustand 状态管理
│   ├── i18n/               # 多语言翻译文件
│   └── utils/              # API 客户端、导出工具
├── public/                 # 静态资源
└── scripts/                # 工具脚本
```

### 快速开始

**环境要求：** Node.js 18+, MySQL 8+

```bash
# 克隆仓库
git clone https://github.com/zoranges/ai-library.git
cd ai-library

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 MySQL 连接信息和 JWT 密钥

# 启动开发服务器（前后端同时启动）
npm run dev
```

前端运行在 `http://localhost:5173`，API 代理到 `http://localhost:3000`。

**默认账号（首次运行自动创建）：**

| 角色         | 邮箱                       | 密码             |
| ------------ | -------------------------- | ---------------- |
| 超级管理员   | admin@ailibrary.com        | admin123         |
| 学校管理员   | schooladmin@ailibrary.com  | schooladmin123   |
| 教师         | teacher1@ailibrary.com     | teacher123       |
| 学生         | student1@ailibrary.com     | student123        |

### 命令

| 命令             | 说明                       |
| ---------------- | -------------------------- |
| `npm run dev`    | 同时启动前端和后端开发服务 |
| `npm run build`  | 类型检查并构建生产包       |
| `npm run check`  | 仅 TypeScript 类型检查     |
| `npm run preview`| 预览生产构建               |
