# HAIPablo - AI 视觉生成工作台使用指南

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run db:push
npm run db:seed
```

### 3. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000

## 📋 功能概览

### 核心功能
- **首页**：查看统计数据、最近项目、快速入口
- **模板中心**：浏览和选择生成模板
- **图片生成**：基于模板生成各类图片

### 预置模板

#### 物料延展生成
- 签到板生成
- 讲台贴生成
- 手举牌生成

#### 海报智能生成
- 朋友圈活动海报

#### 产品视觉生成
- 产品海报生成

#### 人像形象照生成
- 商务形象照

## 🔧 配置说明

### API 配置
项目已配置使用 `api.jyf.ai` 中转服务：

```env
GPT_IMAGE_API_BASE_URL="https://api.jyf.ai"
GPT_IMAGE_API_KEY="sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW"
```

### 尺寸说明
GPT Image API 支持以下尺寸：
- `1024x1024` - 正方形
- `1536x1024` - 横版 3:2
- `1024x1536` - 竖版 2:3
- `2048x2048` - 高清正方形
- `2048x1152` - 宽屏 16:9
- `1920x1080` - 全高清

### 质量设置
- `low` - 速度优先，快速预览
- `medium` - 均衡模式，默认选项
- `high` - 质量优先，高细节
- `auto` - 模型自动判断

## 💡 使用流程

### 1. 访问模板中心
点击首页的「查看模板」或导航到 `/templates`

### 2. 选择功能分类
左侧栏显示四大功能分类：
- 物料延展生成
- 海报智能生成
- 产品视觉生成
- 人像形象照生成

### 3. 选择具体模板
中间栏显示该分类下的所有模板

### 4. 配置生成参数
右侧栏配置：
- 上传需要的图片素材
- 填写模板变量（活动名称、主标题等）
- 选择输出尺寸和质量

### 5. 创作
点击「创作」按钮，系统将调用 GPT Image API 生成图片

## 🎨 设计风格

项目采用高级简约的设计风格：
- **配色**：紫罗兰渐变强调色
- **字体**：Outfit（现代几何无衬线）
- **布局**：大留白、清晰层级
- **动效**：流畅的微交互动画

## 📁 项目结构

```
HAIPablo/
├── app/                    # Next.js 应用
│   ├── api/               # API 路由
│   │   ├── projects/      # 项目管理 API
│   │   ├── templates/     # 模板管理 API
│   │   ├── feature-groups/ # 功能组 API
│   │   └── image/generate/ # 图片生成 API
│   ├── templates/         # 模板页面
│   ├── page.tsx          # 首页
│   ├── layout.tsx        # 根布局
│   └── globals.css       # 全局样式
├── components/           # React 组件
│   └── ui/              # UI 基础组件
├── lib/                  # 工具库
│   ├── prisma.ts       # Prisma 客户端
│   ├── image-api-client.ts # 图像 API 客户端
│   └── prompt-utils.ts  # 提示词工具
├── prisma/              # 数据库
│   ├── schema.prisma   # 数据库模型
│   └── seed.ts         # 种子数据
└── storage/             # 文件存储
    ├── uploads/        # 上传素材
    └── outputs/       # 生成结果
```

## ⚙️ 环境变量

```env
DATABASE_URL="file:./dev.db"
GPT_IMAGE_API_BASE_URL="https://api.jyf.ai"
GPT_IMAGE_API_KEY="your-api-key"
STORAGE_DRIVER="local"
LOCAL_STORAGE_ROOT="./storage"
```

## 🛠️ 开发命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 生产模式运行
npm start

# 数据库操作
npm run db:generate   # 生成 Prisma Client
npm run db:push       # 推送数据库变更
npm run db:seed       # 初始化种子数据
```

## 📝 注意事项

1. **API Key 安全**：API Key 仅存放在服务端 `.env` 文件，不会暴露给前端
2. **文件上传**：支持 PNG、JPG、JPEG、WEBP 格式，单个文件建议 20MB 以内
3. **尺寸限制**：自定义尺寸必须满足 GPT Image API 的要求
4. **成本控制**：建议使用 medium 质量进行预览，high 质量用于最终输出

## 🎯 下一步

根据需要，你可以：
- 添加更多预设模板
- 自定义提示词模板
- 扩展项目功能（如批量生成、任务队列等）
- 接入钉钉或其他权限系统

如有问题，请查看 README.md 或提交 Issue。
