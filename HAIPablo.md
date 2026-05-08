# AI视觉生成工作台 Web 项目开发文档项目名称：HAIPablo

> 适用对象：AI IDE / VibeCoding / Cursor / Trae / QCode 等代码生成工具  
> 项目目标：通过调用 `gpt-image-2` 的图片生成与图片编辑 API，搭建一个支持单图、批量、多模板、多参数配置的企业内部 AIGC 图片生产工具。  
> 核心定位：这不是一个“输入一句提示词然后生成图片”的小工具，而是一个“可配置的视觉生产流水线平台”。

---

## 1. 项目一句话定位

搭建一个面向活动营销、会展物料、品牌传播场景的 AI 视觉生成工作台。用户上传主视觉 KV、品牌素材、样机图片后，可以选择预设的业务功能，例如“物料延展生成”“海报生成”“形象照生成”“产品海报生成”等；每个大功能下面包含多个可自定义的小功能模板，例如签到板、讲台贴、门型展架、手举牌、朋友圈海报等。系统根据模板自动组合图片、提示词、尺寸比例、质量参数，并调用 `gpt-image-2` API 生成结果。

---

## 2. 建设目标

### 2.1 业务目标

1. 把设计生产中大量重复的“KV 延展、版式适配、物料套图生成”流程标准化。
2. 让非技术人员也能通过前端配置新增生成能力，不需要每次改代码。
3. 支持单张生成和批量生成，适合项目制生产场景。
4. 保留每次生成的输入图片、提示词、参数、结果图，方便复盘与二次修改。
5. 后期可以扩展成集团内部 AIGC 创作平台的一部分。

### 2.2 技术目标

1. 前端使用 TypeScript 技术栈，保证后续可维护。
2. API Key 只放在服务端，前端永远不能直接暴露密钥。
3. 数据库存储模板、任务、文件元数据、生成记录。
4. 图片文件不直接存进数据库，而是走本地文件目录或对象存储。
5. 所有生成参数必须经过统一校验，尤其是 `size`、`quality`、`image`、`prompt`。
6. 预留批量队列能力，避免用户一次性提交大量任务导致接口失败或成本失控。

---

## 3. 技术选型建议

### 3.1 推荐技术栈

```txt
前端框架：Next.js + React + TypeScript
UI 框架：Tailwind CSS + shadcn/ui + Framer Motion
数据库：SQLite + Prisma
文件存储：MVP 阶段使用本地 uploads 目录；生产阶段切换到 OSS / COS / MinIO / S3
任务队列：MVP 阶段使用数据库任务表 + 后端轮询执行；生产阶段使用 Redis + BullMQ
图片处理：sharp，用于缩略图、尺寸读取、格式转换、压缩
压缩下载：archiver，用于批量结果打包 ZIP
表单校验：zod
请求封装：fetch / axios 均可，建议服务端统一封装 ImageApiClient
权限：MVP 可先做管理员口令或本地账号；后期接入钉钉 OAuth / 企业内部 SSO
```

### 3.2 为什么 SQLite 可以，但不能只靠 SQLite

SQLite 适合这个项目的 MVP 阶段，原因是：

1. 部署简单，不需要独立数据库服务。
2. 适合单机、内部工具、小团队快速迭代。
3. 存储模板配置、任务记录、文件路径、生成参数完全够用。

但 SQLite 不适合直接存图片二进制。原因是：

1. 图片体积大，批量生成后数据库会迅速膨胀。
2. 图片读取、预览、下载都会影响数据库性能。
3. 后续迁移对象存储会更麻烦。

所以最终方案是：

```txt
SQLite 只存：文件名、文件路径、文件类型、尺寸、大小、上传人、归属项目、生成任务 ID。
本地文件目录 / 对象存储负责：原始图片、样机图片、输出图片、缩略图、ZIP 包。
```

### 3.3 存储决策

MVP 阶段采用：

```txt
数据库：SQLite
文件存储：项目根目录 /storage/uploads 与 /storage/outputs
```

生产阶段建议切换为：

```txt
数据库：PostgreSQL 或 MySQL
文件存储：阿里云 OSS / 腾讯云 COS / MinIO
任务队列：Redis + BullMQ
```

为了后续迁移顺畅，代码中必须抽象一个 `StorageService`，不要在业务代码里到处直接写本地路径。

---

## 4. 产品结构设计

### 4.1 核心产品模块

```txt
1. 工作台首页 Dashboard
2. 项目管理 Project Workspace
3. 素材管理 Asset Library
4. 功能模板管理 Template Center
5. 生成任务中心 Generation Jobs
6. 结果图库 Result Gallery
7. 系统设置 System Settings
```

### 4.2 核心业务对象

```txt
Project：一个项目，例如“君品文化巡游杭州站”
Asset：项目中的素材，例如主视觉 KV、Logo、样机图、产品图
FeatureGroup：大功能，例如“物料延展生成”
ActionTemplate：小功能，例如“签到板生成”“讲台贴生成”
InputSlot：模板需要的图片槽位，例如“主视觉 KV”“讲台贴样机图”
PromptVariable：模板中可替换的变量，例如活动名称、城市、主标题、副标题
GenerationJob：一次生成任务
GenerationJobItem：批量任务里的单个生成项
GeneratedImage：最终生成结果图
```

---

## 5. 功能需求说明

## 5.1 工作台首页 Dashboard

首页要让用户快速知道：

1. 当前有哪些常用生成能力。
2. 最近生成了哪些任务。
3. 今日生成量、失败量、预计消耗情况。
4. 快速入口：新建项目、上传 KV、开始生成、管理模板。

### 首页卡片建议

```txt
- 物料延展生成
- 海报智能生成
- 产品视觉生成
- 人像形象照生成
- 社媒内容图生成
- 历史任务
- 模板管理
```

---

## 5.2 项目管理 Project Workspace

用户需要先创建一个项目，再在项目里上传素材并发起生成。

### 字段设计

```ts
interface Project {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  eventName?: string;
  city?: string;
  brandName?: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

### 页面能力

```txt
1. 新建项目
2. 编辑项目基础信息
3. 上传项目素材
4. 选择生成模板
5. 查看项目历史生成结果
6. 一键复制项目，复用上一项目的配置
```

---

## 5.3 素材管理 Asset Library

素材分为项目素材和全局素材。

### 素材类型

```txt
main_kv：主视觉 KV
logo：品牌 Logo
product：产品图
mockup：样机图
reference：参考风格图
background：背景图
person：人物图
other：其他
```

### 素材字段

```ts
interface Asset {
  id: string;
  projectId?: string;
  name: string;
  type: 'main_kv' | 'logo' | 'product' | 'mockup' | 'reference' | 'background' | 'person' | 'other';
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: string;
}
```

### 上传要求

1. 支持 PNG、JPG、JPEG、WEBP。
2. 单个文件建议限制 20MB 以内。
3. 上传后自动读取宽高。
4. 上传后生成缩略图。
5. 同一项目下支持多张主视觉、多张样机、多张参考图。

---

## 5.4 功能模板管理 Template Center

这是整个系统最重要的模块。

### 设计原则

不要把“签到板生成”“讲台贴生成”写死在代码里，而是做成后台可配置模板。

大功能叫 `FeatureGroup`，小功能叫 `ActionTemplate`。

示例：

```txt
FeatureGroup：物料延展生成
  - ActionTemplate：签到板生成
  - ActionTemplate：讲台贴生成
  - ActionTemplate：门型展架生成
  - ActionTemplate：手举牌生成
  - ActionTemplate：工作证生成
  - ActionTemplate：朋友圈海报生成
```

### FeatureGroup 字段

```ts
interface FeatureGroup {
  id: string;
  name: string;
  key: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
}
```

### ActionTemplate 字段

```ts
interface ActionTemplate {
  id: string;
  featureGroupId: string;
  name: string;
  key: string;
  description?: string;
  mode: 'generation' | 'edit';
  promptTemplate: string;
  negativePrompt?: string;
  defaultSize: string;
  defaultQuality: 'low' | 'medium' | 'high' | 'auto';
  responseFormat: 'b64_json' | 'url';
  inputSlots: InputSlot[];
  variables: PromptVariable[];
  enabled: boolean;
  sortOrder: number;
}
```

### InputSlot 字段

```ts
interface InputSlot {
  key: string;
  label: string;
  required: boolean;
  assetTypes: Asset['type'][];
  maxCount: number;
  description?: string;
}
```

示例：讲台贴生成需要两个图片槽位：

```json
[
  {
    "key": "main_kv",
    "label": "主视觉KV",
    "required": true,
    "assetTypes": ["main_kv"],
    "maxCount": 1
  },
  {
    "key": "podium_mockup",
    "label": "讲台贴样机图",
    "required": true,
    "assetTypes": ["mockup"],
    "maxCount": 1
  }
]
```

### PromptVariable 字段

```ts
interface PromptVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}
```

---

## 6. gpt-image-2 参数设计

系统必须围绕以下参数设计，不要在前端暴露无效参数。

### 6.1 通用参数

```ts
interface GptImage2BaseParams {
  model: 'gpt-image-2';
  prompt: string;
  size?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  response_format?: 'b64_json' | 'url';
}
```

### 6.2 生成接口参数 Generations

对应接口：

```txt
POST /v1/images/generations
Content-Type: application/json
```

参数：

```ts
interface GptImage2GenerationParams extends GptImage2BaseParams {
  image?: string[];
}
```

请求示例：

```json
{
  "model": "gpt-image-2",
  "prompt": "基于品牌调性生成一张高端活动主视觉海报，画面简洁、高级、适合发布会传播。",
  "size": "1536x1024",
  "quality": "medium",
  "response_format": "b64_json"
}
```

### 6.3 编辑接口参数 Edits

对应接口：

```txt
POST /v1/images/edits
Content-Type: multipart/form-data
```

参数：

```ts
interface GptImage2EditParams extends GptImage2BaseParams {
  image: File[];
}
```

请求逻辑：

```txt
1. 将主视觉 KV、样机图、参考图等按 image 字段传入。
2. prompt 中明确说明每张图的作用。
3. size 使用模板配置或用户前端选择的尺寸。
4. quality 默认 medium，草稿用 low，最终图用 high。
5. response_format 建议默认 b64_json，便于服务端落盘。
```

### 6.4 Size 尺寸规则

`size` 支持常用值和自定义分辨率。

常用值：

```txt
auto
1024x1024
1536x1024
1024x1536
2048x2048
2048x1152
3840x2160
2160x3840
```

自定义尺寸必须满足：

```txt
1. 最大边长 <= 3840px
2. 宽和高都必须是 16 的倍数
3. 长边 / 短边 <= 3:1
4. 总像素数 >= 655,360
5. 总像素数 <= 8,294,400
```

### 6.5 Size 校验函数

```ts
export function validateGptImage2Size(size: string): { valid: boolean; message?: string } {
  if (size === 'auto') return { valid: true };

  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return { valid: false, message: '尺寸格式必须为 widthxheight，例如 1536x1024' };
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width <= 0 || height <= 0) {
    return { valid: false, message: '宽高必须大于 0' };
  }

  if (width > 3840 || height > 3840) {
    return { valid: false, message: '最大边长不能超过 3840px' };
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    return { valid: false, message: '宽和高都必须是 16 的倍数' };
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);

  if (longEdge / shortEdge > 3) {
    return { valid: false, message: '长边与短边比例不能超过 3:1' };
  }

  const pixels = width * height;

  if (pixels < 655_360) {
    return { valid: false, message: '总像素数不能低于 655,360' };
  }

  if (pixels > 8_294_400) {
    return { valid: false, message: '总像素数不能超过 8,294,400' };
  }

  return { valid: true };
}
```

### 6.6 Quality 质量策略

```txt
low：草稿、快速预览、低成本批量探索
medium：默认选项，适合大多数业务物料
high：最终出图、客户提案、对细节要求较高的图
unstable / auto：允许模型自动判断，但不建议作为批量生产默认值
```

前端建议展示为：

```txt
速度优先：low
均衡模式：medium
质量优先：high
自动：auto
```

---

## 7. Prompt 模板体系设计

### 7.1 Prompt 组装原则

每次实际发送给 API 的 prompt 不应该只等于用户输入，而应该由三部分组成：

```txt
最终 Prompt = 平台级基础规则 + 模板 Prompt + 用户变量内容
```

### 7.2 平台级基础规则

```txt
你是一个专业的商业视觉设计师，擅长活动营销、会展传播、品牌物料延展设计。
请严格基于用户提供的主视觉、品牌元素、产品元素或样机图进行创作。
保持核心视觉资产的一致性，包括主色、字体感觉、视觉层级、品牌气质和活动调性。
不要凭空更改品牌名称、活动名称、Logo、产品形态和核心文案。
如果画面中需要出现文字，请尽量保持简洁、清晰、可读，避免生成乱码。
输出应符合商业提案和正式活动执行物料的质感。
```

### 7.3 变量插入规则

模板里使用 `{{变量名}}`。

示例：

```txt
请基于上传的主视觉 KV，为活动「{{eventName}}」生成一张签到板设计。
主标题：{{mainTitle}}
副标题：{{subTitle}}
城市：{{city}}
风格要求：{{styleRequirement}}
```

### 7.4 最终 Prompt 预览

在用户点击生成前，必须提供一个“最终 Prompt 预览”区域。

用户可以：

1. 只填变量，不改模板。
2. 临时追加补充要求。
3. 展开查看完整 Prompt。
4. 管理员可以保存为新模板。

---

## 8. 典型模板示例

## 8.1 物料延展生成 / 签到板生成

### 模板配置

```json
{
  "name": "签到板生成",
  "key": "sign_board",
  "mode": "edit",
  "defaultSize": "2048x1152",
  "defaultQuality": "medium",
  "inputSlots": [
    {
      "key": "main_kv",
      "label": "主视觉KV",
      "required": true,
      "assetTypes": ["main_kv"],
      "maxCount": 1
    }
  ]
}
```

### Prompt 模板

```txt
请基于上传的主视觉 KV，延展生成一张活动签到板设计。

活动名称：{{eventName}}
主标题：{{mainTitle}}
副标题：{{subTitle}}
主办方/品牌：{{brandName}}

设计要求：
1. 保持主视觉的核心色彩、品牌气质、视觉符号和整体调性。
2. 画面横版构图，适合作为线下活动签到板。
3. 中心信息清晰，远距离可读。
4. 保留足够留白，方便现场嘉宾拍照。
5. 不要重新发明一套完全不同的视觉风格。
6. 输出商业活动正式物料质感，高级、干净、有秩序。
```

---

## 8.2 物料延展生成 / 讲台贴生成

### 模板配置

```json
{
  "name": "讲台贴生成",
  "key": "podium_sticker",
  "mode": "edit",
  "defaultSize": "1536x1024",
  "defaultQuality": "medium",
  "inputSlots": [
    {
      "key": "main_kv",
      "label": "主视觉KV",
      "required": true,
      "assetTypes": ["main_kv"],
      "maxCount": 1
    },
    {
      "key": "podium_mockup",
      "label": "讲台样机图",
      "required": true,
      "assetTypes": ["mockup"],
      "maxCount": 1
    }
  ]
}
```

### Prompt 模板

```txt
请基于图片1的主视觉 KV，以及图片2的讲台样机结构，生成一张讲台贴设计效果图。

活动名称：{{eventName}}
主标题：{{mainTitle}}
副标题：{{subTitle}}
品牌名称：{{brandName}}

设计要求：
1. 讲台贴画面必须适配样机图中的讲台比例和正面展示区域。
2. 延续主视觉的颜色、图形元素、背景氛围和品牌气质。
3. 文字不要过多，主标题清晰醒目。
4. 画面需要像真实落地物料，不要像单纯海报。
5. 注意透视、边缘、阴影与样机融合。
6. 输出结果要具备客户提案展示效果。
```

---

## 8.3 物料延展生成 / 手举牌生成

```txt
请基于上传的主视觉 KV，生成一组活动现场手举牌设计。

活动名称：{{eventName}}
口号/文案：{{slogan}}
品牌名称：{{brandName}}

设计要求：
1. 画面可爱、醒目、适合现场互动拍照。
2. 保持主视觉色彩和品牌元素。
3. 手举牌应有明确外轮廓，可以是圆形、异形或简洁矩形。
4. 文案必须简短、清晰、有传播感。
5. 不要生成复杂小字。
```

---

## 8.4 海报智能生成 / 朋友圈活动海报

```txt
请为活动「{{eventName}}」生成一张适合朋友圈传播的活动海报。

主标题：{{mainTitle}}
副标题：{{subTitle}}
时间：{{eventTime}}
地点：{{eventLocation}}
品牌：{{brandName}}

设计要求：
1. 竖版构图，信息层级清晰。
2. 高级、简洁、有传播感。
3. 适合手机屏幕阅读。
4. 主标题必须突出，时间地点清晰。
5. 风格参考上传图片的视觉调性，但不要完全复制。
```

---

## 9. 数据库设计 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  clientName  String?
  eventName   String?
  city        String?
  brandName   String?
  status      String   @default("active")
  assets      Asset[]
  jobs        GenerationJob[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Asset {
  id           String   @id @default(cuid())
  projectId    String?
  project      Project? @relation(fields: [projectId], references: [id])
  name         String
  type         String
  fileUrl      String
  thumbnailUrl String?
  mimeType     String
  width        Int?
  height       Int?
  sizeBytes    Int
  createdAt    DateTime @default(now())
}

model FeatureGroup {
  id          String           @id @default(cuid())
  name        String
  key         String           @unique
  description String?
  icon        String?
  sortOrder   Int              @default(0)
  enabled     Boolean          @default(true)
  templates   ActionTemplate[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model ActionTemplate {
  id             String   @id @default(cuid())
  featureGroupId String
  featureGroup   FeatureGroup @relation(fields: [featureGroupId], references: [id])
  name           String
  key            String   @unique
  description    String?
  mode           String   // generation | edit
  promptTemplate String
  negativePrompt String?
  defaultSize    String   @default("auto")
  defaultQuality String   @default("medium")
  responseFormat String   @default("b64_json")
  inputSlotsJson String   @default("[]")
  variablesJson  String   @default("[]")
  enabled        Boolean  @default(true)
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model GenerationJob {
  id          String   @id @default(cuid())
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id])
  name        String
  status      String   @default("pending") // pending | running | success | partial_failed | failed
  totalCount  Int      @default(0)
  successCount Int     @default(0)
  failedCount Int      @default(0)
  items       GenerationJobItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GenerationJobItem {
  id             String   @id @default(cuid())
  jobId          String
  job            GenerationJob @relation(fields: [jobId], references: [id])
  templateId     String?
  templateName   String
  mode           String
  requestJson    String
  responseJson   String?
  outputImageUrl String?
  status         String   @default("pending") // pending | running | success | failed
  errorMessage   String?
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())
}

model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 10. API 路由设计

### 10.1 项目相关

```txt
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
```

### 10.2 素材相关

```txt
POST   /api/assets/upload
GET    /api/assets?projectId=xxx
DELETE /api/assets/:id
```

### 10.3 模板相关

```txt
GET    /api/feature-groups
POST   /api/feature-groups
PUT    /api/feature-groups/:id
DELETE /api/feature-groups/:id

GET    /api/action-templates
POST   /api/action-templates
GET    /api/action-templates/:id
PUT    /api/action-templates/:id
DELETE /api/action-templates/:id
```

### 10.4 生成任务相关

```txt
POST   /api/generation-jobs
GET    /api/generation-jobs
GET    /api/generation-jobs/:id
POST   /api/generation-jobs/:id/run
POST   /api/generation-jobs/:id/retry-failed
GET    /api/generation-jobs/:id/download-zip
```

### 10.5 图片 API 封装

```txt
POST /api/image/generate
POST /api/image/edit
```

注意：这两个接口只允许服务端调用真实的 `gpt-image-2` 接口。前端只能调用自己系统的后端接口。

---

## 11. 服务端 gpt-image-2 封装示例

### 11.1 环境变量

```env
DATABASE_URL="file:./dev.db"
GPT_IMAGE_API_BASE_URL="https://api.openai.com"
GPT_IMAGE_API_KEY="你的API_KEY"
STORAGE_DRIVER="local"
LOCAL_STORAGE_ROOT="./storage"
```

如果你用的是中转网关，则：

```env
GPT_IMAGE_API_BASE_URL="你的中转网关地址"
GPT_IMAGE_API_KEY="你的中转网关KEY"
```

### 11.2 ImageApiClient

```ts
import fs from 'node:fs';
import path from 'node:path';

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

export interface GenerateImageInput {
  prompt: string;
  size?: string;
  quality?: ImageQuality;
  response_format?: 'b64_json' | 'url';
  image?: string[];
}

export interface EditImageInput {
  prompt: string;
  size?: string;
  quality?: ImageQuality;
  response_format?: 'b64_json' | 'url';
  imagePaths: string[];
}

export class ImageApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.GPT_IMAGE_API_BASE_URL || 'https://api.openai.com';
    this.apiKey = process.env.GPT_IMAGE_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('Missing GPT_IMAGE_API_KEY');
    }
  }

  async generate(input: GenerateImageInput) {
    const res = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: input.prompt,
        size: input.size || 'auto',
        quality: input.quality || 'medium',
        response_format: input.response_format || 'b64_json',
        image: input.image
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image generation failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  async edit(input: EditImageInput) {
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', input.prompt);
    form.append('size', input.size || 'auto');
    form.append('quality', input.quality || 'medium');
    form.append('response_format', input.response_format || 'b64_json');

    for (const imagePath of input.imagePaths) {
      const buffer = await fs.promises.readFile(imagePath);
      const file = new Blob([buffer]);
      form.append('image', file, path.basename(imagePath));
    }

    const res = await fetch(`${this.baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image edit failed: ${res.status} ${text}`);
    }

    return res.json();
  }
}
```

---

## 12. 生成结果落盘逻辑

当 `response_format = b64_json` 时：

```ts
import fs from 'node:fs/promises';
import path from 'node:path';

export async function saveBase64Image(params: {
  b64Json: string;
  outputDir: string;
  filename: string;
}) {
  const buffer = Buffer.from(params.b64Json, 'base64');
  await fs.mkdir(params.outputDir, { recursive: true });
  const filePath = path.join(params.outputDir, params.filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
```

文件命名建议：

```txt
项目名_模板名_时间戳_序号.png
```

例如：

```txt
junpin_hangzhou_sign_board_20260429_001.png
```

---

## 13. 批量生成任务设计

### 13.1 批量生成流程

```txt
1. 用户进入项目
2. 上传主视觉 KV、Logo、样机图等素材
3. 选择一个大功能，例如“物料延展生成”
4. 勾选多个小功能，例如签到板、讲台贴、手举牌、工作证
5. 系统根据每个小功能生成一个 GenerationJobItem
6. 用户确认每个任务的尺寸、质量和最终 Prompt
7. 点击“开始批量生成”
8. 后端按并发限制逐个执行
9. 前端展示进度、成功结果和失败原因
10. 用户可一键重试失败项或下载全部结果
```

### 13.2 并发建议

MVP 阶段：

```txt
并发数：1-2
失败重试：最多 2 次
任务超时：180 秒
```

生产阶段：

```txt
并发数：根据 API 限额与预算配置
失败重试：指数退避
任务队列：BullMQ + Redis
```

### 13.3 任务状态

```txt
pending：等待执行
running：生成中
success：成功
failed：失败
partial_failed：部分失败，仅用于 Job 总状态
```

---

## 14. 前端页面设计

## 14.1 整体视觉风格

参考 MiMo 类科技产品站的设计方向，做成“AI 工具型产品 + 高级活动站”的感觉。

### 关键词

```txt
极简
高级
科技感
数据卡片
大留白
柔和渐变
圆角卡片
微动效
清晰层级
低噪音界面
```

### 色彩建议

```txt
背景：#F6F7FB / #FFFFFF
主文字：#111827
次文字：#6B7280
边框：#E5E7EB
强调色：#4F46E5 / #2563EB / #7C3AED
成功色：#16A34A
警告色：#F59E0B
失败色：#DC2626
卡片背景：rgba(255,255,255,0.82)
```

### 页面设计方向

```txt
1. 顶部大面积 Hero 区：展示“AI视觉生成工作台”与最近生成数据。
2. 中间使用大卡片入口：物料延展、海报生成、产品视觉、人像形象照。
3. 右侧显示任务进度和系统消耗。
4. 模板管理页面采用左右分栏：左边功能组，右边模板详情。
5. 生成页面采用三栏结构：素材区 / 模板区 / 参数与结果区。
```

---

## 14.2 页面路由建议

```txt
/                         工作台首页
/projects                 项目列表
/projects/new             新建项目
/projects/:id             项目详情与生成入口
/templates                模板中心
/templates/:id            模板编辑
/jobs                     任务中心
/jobs/:id                 任务详情
/assets                   全局素材库
/settings                 系统设置
```

---

## 14.3 核心组件

```txt
ProjectCard
AssetUploader
AssetPicker
FeatureGroupCard
ActionTemplateCard
PromptVariableForm
PromptPreviewPanel
SizeSelector
QualitySelector
GenerationQueuePanel
GenerationResultGrid
ImageCompareViewer
DownloadZipButton
TemplateEditor
```

---

## 15. 生成页面交互设计

### 15.1 三栏结构

```txt
左栏：项目素材
  - 主视觉 KV
  - Logo
  - 样机图
  - 参考图

中栏：功能模板
  - 大功能列表
  - 小功能勾选
  - 模板说明

右栏：参数与结果
  - 变量填写
  - 尺寸选择
  - 质量选择
  - Prompt 预览
  - 生成按钮
  - 结果展示
```

### 15.2 用户操作流程

```txt
1. 选择项目
2. 上传或选择主视觉 KV
3. 选择“物料延展生成”
4. 勾选“签到板”“讲台贴”“手举牌”
5. 填写活动名称、主标题、副标题、城市等变量
6. 系统自动校验每个模板需要的素材是否齐全
7. 点击“预览 Prompt”
8. 点击“开始生成”
9. 实时查看任务状态
10. 下载单张或打包下载全部结果
```

---

## 16. 后台模板编辑器

模板编辑器必须支持：

```txt
1. 新增大功能
2. 新增小功能
3. 设置模式：generation / edit
4. 设置默认尺寸
5. 设置默认质量
6. 设置需要哪些图片输入槽位
7. 设置变量字段
8. 编写 Prompt 模板
9. 测试运行模板
10. 启用 / 禁用模板
11. 调整排序
```

### 模板编辑器布局

```txt
左侧：功能组列表
中间：模板列表
右侧：模板详情表单
底部：Prompt 预览与测试生成
```

---

## 17. 安全与权限

### 17.1 必须做

```txt
1. API Key 只能放服务端环境变量。
2. 上传文件必须校验类型和大小。
3. 所有生成请求必须记录日志。
4. 批量任务必须限制并发和单次数量。
5. 管理员才能编辑模板。
6. 普通用户只能使用已启用模板。
7. 错误信息不要把完整 API Key 或内部网关地址暴露给前端。
```

### 17.2 后期可接入钉钉权限

```txt
1. 钉钉 OAuth 登录
2. 根据用户所在部门分配权限
3. 管理员可以配置谁能使用高质量 high 模式
4. 按部门统计生成量和成本
5. 按项目归档生成资产
```

---

## 18. 成本控制设计

### 18.1 前端提醒

在生成按钮旁边展示：

```txt
当前选择：3 个模板 × medium 质量 × 2048x1152
预计会产生较高图片生成成本，请确认后提交。
```

### 18.2 系统限制

```txt
MVP 默认限制：
1. 单次批量最多 10 个生成项
2. 单个任务最多上传 5 张参考图
3. 默认 quality = medium
4. high 质量需要二次确认
5. 失败自动重试不超过 2 次
```

---

## 19. 异常处理

### 19.1 常见错误

```txt
1. 尺寸不合法
2. 图片过大
3. 图片格式不支持
4. 缺少必填素材
5. 缺少必填变量
6. API 调用超时
7. API 返回失败
8. 生成结果为空
9. b64 解码失败
10. 文件保存失败
```

### 19.2 前端提示示例

```txt
尺寸不符合 gpt-image-2 要求，请使用 1536x1024、1024x1536、2048x1152 等合法尺寸。

讲台贴生成缺少“讲台样机图”，请先上传或选择样机图片。

当前任务部分失败，你可以点击“重试失败项”。
```

---

## 20. 项目目录结构建议

```txt
ai-image-workbench/
  app/
    page.tsx
    projects/
    templates/
    jobs/
    assets/
    settings/
    api/
      projects/
      assets/
      templates/
      generation-jobs/
      image/
  components/
    layout/
    project/
    asset/
    template/
    generation/
    ui/
  lib/
    prisma.ts
    image-api-client.ts
    storage-service.ts
    prompt-renderer.ts
    validators.ts
    job-runner.ts
  prisma/
    schema.prisma
    seed.ts
  storage/
    uploads/
    outputs/
    thumbnails/
  styles/
  .env.example
  package.json
  README.md
```

---

## 21. Seed 初始模板数据

系统初始化时内置一个“物料延展生成”大功能。

```ts
export const seedFeatureGroups = [
  {
    name: '物料延展生成',
    key: 'material_extension',
    description: '基于主视觉 KV 自动延展生成活动执行物料',
    sortOrder: 1,
    templates: [
      '签到板生成',
      '讲台贴生成',
      '门型展架生成',
      '手举牌生成',
      '工作证生成',
      '朋友圈海报生成'
    ]
  },
  {
    name: '海报智能生成',
    key: 'poster_generation',
    description: '根据活动信息和参考风格生成传播海报',
    sortOrder: 2
  },
  {
    name: '产品视觉生成',
    key: 'product_visual',
    description: '根据产品图和品牌调性生成商业产品海报',
    sortOrder: 3
  },
  {
    name: '人像形象照生成',
    key: 'portrait_generation',
    description: '根据人物照片生成商务形象照和不同风格头像',
    sortOrder: 4
  }
];
```

---

## 22. AI IDE 开发指令

下面这段可以直接复制给 AI IDE，让它按这个方向生成项目。

```txt
请帮我开发一个 Next.js + TypeScript 的 AI 图片生成工作台 Web 项目。

项目名称：AI视觉生成工作台。

核心功能：
1. 用户可以创建项目，上传主视觉 KV、Logo、样机图、参考图等素材。
2. 系统有可配置的功能模板中心，分为 FeatureGroup 大功能和 ActionTemplate 小功能。
3. 大功能例如“物料延展生成”，小功能例如“签到板生成”“讲台贴生成”“门型展架生成”。
4. 每个小功能模板可以配置：模式 generation/edit、Prompt 模板、默认 size、默认 quality、图片输入槽位、变量字段。
5. 用户在项目里选择模板，填写变量，系统自动组合最终 prompt，并调用 gpt-image-2 API。
6. 支持单张生成和批量生成。
7. 支持任务状态：pending、running、success、failed、partial_failed。
8. 支持结果图预览、单张下载、批量 ZIP 下载。
9. API Key 必须只在服务端环境变量中使用，不能暴露到前端。
10. 数据库使用 SQLite + Prisma，图片文件存在本地 storage 目录，数据库只存文件元数据和路径。
11. 预留 StorageService，后续可切换 OSS/COS/MinIO。
12. 前端 UI 使用 Tailwind CSS + shadcn/ui + Framer Motion，视觉风格参考 MiMo 类科技产品站：极简、高级、数据卡片、大留白、圆角、柔和渐变、清晰层级。
13. 所有 gpt-image-2 的 size 必须经过校验：最大边长 <= 3840，宽高都是 16 的倍数，长短边比例 <= 3:1，总像素在 655360 到 8294400 之间。
14. quality 支持 low、medium、high、auto。
15. 默认 response_format 使用 b64_json，服务端收到后保存为图片文件。

请先搭建完整项目结构、Prisma schema、核心 API 路由、ImageApiClient、StorageService、PromptRenderer、SizeValidator、模板中心页面、项目生成页面和任务结果页面。
代码要可运行，注意错误处理和类型定义。
```

---

## 23. MVP 开发优先级

### 第一阶段：能跑通

```txt
1. 初始化 Next.js + TypeScript 项目
2. 配置 Tailwind、shadcn/ui、Prisma、SQLite
3. 建立 Project、Asset、FeatureGroup、ActionTemplate、GenerationJob 表
4. 实现素材上传到本地 storage
5. 实现模板管理基础 CRUD
6. 实现 gpt-image-2 ImageApiClient
7. 实现单模板生成
8. 实现结果落盘和预览
```

### 第二阶段：能批量

```txt
1. 多模板勾选
2. 批量创建 JobItem
3. 后端串行或低并发执行
4. 任务进度展示
5. 失败重试
6. 批量下载 ZIP
```

### 第三阶段：能管理

```txt
1. 模板复制
2. 模板测试
3. Prompt 版本记录
4. 项目复制
5. 生成历史检索
6. 成本和用量统计
```

### 第四阶段：能生产化

```txt
1. 接入钉钉登录
2. 接入对象存储
3. 接入 Redis 队列
4. 接入部门权限
5. 接入水印和版权标记
6. 接入生成内容审核与敏感词规则
```

---

## 24. 验收标准

### 24.1 功能验收

```txt
1. 可以新建项目。
2. 可以上传主视觉 KV 和样机图。
3. 可以新增一个大功能。
4. 可以新增一个小功能模板。
5. 可以配置模板需要哪些图片。
6. 可以配置模板变量。
7. 可以预览最终 Prompt。
8. 可以调用 gpt-image-2 生成图片。
9. 可以保存生成结果。
10. 可以批量生成多个模板结果。
11. 可以查看失败原因。
12. 可以重试失败任务。
13. 可以下载结果图。
```

### 24.2 技术验收

```txt
1. 前端不出现 API Key。
2. size 校验完整。
3. 图片不存数据库。
4. 数据库记录完整保留请求参数。
5. 失败任务不会导致整个批量任务中断。
6. 模板可以前端新增，不需要改代码。
7. 代码结构清晰，便于后续接入钉钉和对象存储。
```

---

## 25. 需要特别注意的坑

```txt
1. 不要把模板写死，否则后期每新增一个物料都要改代码。
2. 不要把 API Key 放前端。
3. 不要把图片二进制塞进 SQLite。
4. 不要允许用户随便填非法尺寸。
5. 不要默认 high 质量批量生成，成本容易失控。
6. 不要让批量任务一次性并发太高。
7. 不要只保存结果图，不保存 prompt 和参数，否则无法复盘。
8. 不要忽略样机图的作用，讲台贴、展架、手举牌这类任务必须能传多图。
9. 不要把 prompt 编辑入口藏太深，业务人员需要看到最终发给模型的指令。
10. 不要一开始就做太复杂的权限体系，MVP 先跑通生产闭环。
```

---

## 26. 最终结论

这个项目建议按照“模板驱动的 AIGC 图片生产平台”来做，而不是按照“单一图片生成工具”来做。

最小可行版本的技术路线是：

```txt
Next.js + TypeScript + Tailwind + shadcn/ui
SQLite + Prisma
本地文件存储
服务端封装 gpt-image-2
模板中心驱动生成流程
项目素材库承载 KV、Logo、样机图
任务中心管理单图与批量生成
```

等 MVP 跑通后，再逐步升级为：

```txt
钉钉登录 + 对象存储 + Redis 队列 + 部门权限 + 成本统计 + 企业素材库
```

这样既能满足你现在用 VibeCoding 快速开发落地的需求，也不会把系统做死，后续可以自然演化成公司内部的 AIGC 创作平台。
