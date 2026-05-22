# HAIPablo - AI 视觉生成工作台

基于 GPT 图像生成模型的 AI 视觉生成工作台，支持多种预设模板和自定义配置，让图片生成更简单、更高效。

## 功能特性

### 核心能力

- **多场景图片生成**：支持物料延展、海报生成、产品视觉、人像形象照等多种应用场景
- **预设提示词模板**：内置丰富的提示词模板，用户只需填写变量即可快速生成
- **灵活的模板系统**：支持自定义模板配置，可根据业务需求扩展生成能力
- **批量生成任务**：支持单图和批量生成，适合项目制生产场景
- **项目管理**：组织和管理不同项目的素材与生成记录

### 技术特点

- **安全可靠**：API Key 仅存放在服务端环境变量，前端不暴露密钥
- **参数校验**：严格的尺寸、质量等参数校验，确保生成成功率
- **结果追溯**：完整的生成记录，方便复盘与二次修改
- **现代化架构**：基于 Next.js + TypeScript 构建，支持服务端渲染

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- PostgreSQL（需自备数据库服务，可通过 Docker 或云 RDS 部署）

### 安装步骤

1. **克隆项目**
   ```bash
   cd e:\Server\HAIPablo
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **初始化数据库**
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **配置环境变量**
   
   项目根目录已包含 `.env` 文件，配置如下：
   ```env
   DATABASE_URL="postgresql://postgres:postgres@113.59.125.17:5458/haiPablodb"
   GPT_IMAGE_API_BASE_URL="https://api.jyf.ai"
   GPT_IMAGE_API_KEY="sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW"
   STORAGE_DRIVER="local"
   LOCAL_STORAGE_ROOT="./storage"
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
   ```

6. **访问应用**
   
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
HAIPablo/
├── app/                    # Next.js 应用目录
│   ├── page.tsx           # 首页
│   ├── globals.css       # 全局样式
│   └── layout.tsx        # 根布局
├── components/            # React 组件
│   ├── layout/           # 布局组件
│   ├── ui/               # UI 基础组件
│   └── ...
├── lib/                   # 工具库
│   ├── prisma.ts         # Prisma 客户端
│   ├── image-api-client.ts # 图像 API 客户端
│   └── ...
├── prisma/                # 数据库相关
│   └── schema.prisma     # 数据库模型
├── storage/               # 文件存储目录
│   ├── uploads/          # 上传素材
│   ├── outputs/          # 生成结果
│   └── thumbnails/        # 缩略图
└── .env                   # 环境变量
```

## 使用指南

### 创建项目

1. 在首页点击「新建项目」
2. 填写项目名称、描述、客户名称、活动名称等信息
3. 上传主视觉 KV、Logo、样机图等素材

### 选择生成模板

系统内置以下功能模板：

- **物料延展生成**：签到板、讲台贴、门型展架、手举牌、工作证、朋友圈海报
- **海报智能生成**：活动海报、传播海报
- **产品视觉生成**：产品海报、商业展示图
- **人像形象照生成**：商务形象照、风格头像

### 配置生成参数

1. 选择目标模板
2. 填写模板变量（如活动名称、主标题、副标题等）
3. 选择输出尺寸和质量
4. 预览最终 Prompt
5. 点击「创作」

### 查看结果

- 单张图片可预览、下载
- 批量任务可查看进度、成功/失败统计
- 支持一键打包下载全部结果

## API 配置

### 中转 API

项目使用 `api.jyf.ai` 作为 API 中转服务，已在 `.env` 中配置：

```env
GPT_IMAGE_API_BASE_URL="https://api.jyf.ai"
GPT_IMAGE_API_KEY="sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW"
```

### 尺寸规则

GPT Image API 支持以下尺寸：

- **常用尺寸**：1024x1024、1536x1024、1024x1536、2048x2048、2048x1152
- **自定义尺寸要求**：
  - 最大边长 ≤ 3840px
  - 宽和高必须是 16 的倍数
  - 长边/短边 ≤ 3:1
  - 总像素数：655,360 - 8,294,400

### 质量设置

- **low**：草稿、快速预览
- **medium**：默认选项，适合大多数场景
- **high**：最终出图，对细节要求较高
- **auto**：模型自动判断

## 设计理念

### 视觉风格

遵循 AGENTS.md 中的设计指南，打造独特、高级的前端界面：

- **极简主义**：干净的界面，大留白，低噪音
- **科技感**：柔和渐变，圆角卡片，微动效
- **清晰层级**：明确的信息架构，舒适的视觉节奏

### 色彩系统

```css
--background: #FAFBFC;    /* 背景色 */
--foreground: #0F1419;    /* 主文字 */
--accent: #7C3AED;        /* 强调色（紫罗兰） */
--success: #10B981;       /* 成功色 */
--warning: #F59E0B;       /* 警告色 */
--destructive: #EF4444;   /* 错误色 */
```

### 字体选择

- **主字体**：Outfit - 现代几何无衬线，独特且有品味
- **代码字体**：Space Mono - 技术感强，适合参数展示

## 技术栈

- **前端框架**：Next.js 14 + React 18 + TypeScript
- **样式方案**：Tailwind CSS
- **数据库**：SQLite + Prisma ORM
- **动画库**：Tailwind CSS 动画 + CSS 自定义动画
- **图标**：Lucide React

## 常见问题

### Q: 如何添加新的模板？

A: 在「模板中心」页面，可以添加新的功能组和小功能模板，配置提示词、变量、默认参数等。

### Q: 支持批量生成吗？

A: 是的，支持在单个任务中添加多个生成项，系统会按顺序执行。

### Q: 生成失败怎么办？

A: 系统会自动记录失败原因，可以查看详细错误信息，并支持重试失败项。

### Q: 如何自定义 API 配置？

A: 修改 `.env` 文件中的 `GPT_IMAGE_API_BASE_URL` 和 `GPT_IMAGE_API_KEY` 即可。

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 生产模式运行
npm start

# 代码检查
npm run lint

# 数据库操作
npm run db:generate   # 生成 Prisma Client
npm run db:push       # 推送数据库变更
npm run db:seed       # 初始化种子数据
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过项目 Issues 页面反馈。
