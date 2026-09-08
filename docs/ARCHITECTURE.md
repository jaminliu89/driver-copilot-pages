# 司机收益副驾：产品全链路
版本 0.1，2026年09月08日。图中虚线表示待接入能力，不表示已经运行。

## 用户旅程与决策链
```mermaid
flowchart TD
 A[打开 PWA：无需登录或录入] --> B[加载本机状态与西安时段参考]
 B --> C{网络和数据时效}
 C -->|新鲜| D[时间／可选定位／天气模型]
 C -->|断网或失效| E[标记离线和证据缺口]
 D --> F[证据质量和安全门禁]
 E --> F
 F --> G{可支持什么行动}
 G --> H[跑：保持当前服务安排]
 G --> I[换：有合格区域证据才移动]
 G --> J[休：休息或低需求窗口参考]
 G --> K[调：停车后检查听单设置]
 G --> L[撤：有明确区域风险才退出]
 F -->|证据不足| M[不发位置或收益断言／显示时段参考]
 H & I & J & K & L & M --> N[首页一个动作＋一句理由＋时效]
 N --> O[停车后查看地图／策略／收入／事件／状态]
 O --> P[自动时钟刷新；重新评估]
 P --> C
 Q[可选：停车后选截图或系统分享] --> R[本机 OCR／去重／口径核对]
 R --> S{识别可信且口径可核对}
 S -->|是| T[预览识别结果／一键保存]
 S -->|否| U[保留待核对／重选清晰截图]
 T --> V[(IndexedDB：个人收入快照)]
 V --> O
```

## 行动状态机与驾驶保护
```mermaid
stateDiagram-v2
 [*] --> Loading
 Loading --> Reference: 城市时段参考就绪
 Loading --> Unavailable: 加载失败
 Reference --> Rest: 午间参考／休息计时
 Reference --> Run: 普通窗口参考
 Reference --> Adjust: 仅有设置检查参考
 Run --> Change: 已验证的目的区域且净收益改善超过转移成本
 Run --> Withdraw: 已验证区域风险
 Run --> Rest: 用户已开始休息或安全信号
 Change --> Reference: 区域证据到期
 Withdraw --> Reference: 风险到期
 Adjust --> Reference: 条件变更
 Rest --> Reference: 休息结束
 Reference --> Unavailable: 数据格式异常
 Unavailable --> Reference: 重试成功
 state Display {
  [*] --> Parked
  Parked --> Driving: 前台速度大于阈值或一键驾驶模式
  Driving --> Parked: 用户停车后退出
 }
 note right of Driving
 只读大字行动，不弹上传和表单
 GPS 不是完单或疲劳识别
 end note
```

## 收入导入状态机
```mermaid
stateDiagram-v2
 [*] --> Empty
 Empty --> Reading: 选图／分享
 Reading --> Rejected: 非图片／过大／超时
 Reading --> Review: OCR 返回
 Review --> Unresolved: 日期或金额缺失／总分不符
 Review --> Saved: 一键保存已识别快照
 Saved --> Duplicate: 相同语义快照再次导入
 Duplicate --> Saved: 不重复累计
 Saved --> Review: 新快照
 Saved --> Empty: 删除本机记录
 Rejected --> Reading: 重选
 Unresolved --> Reading: 重选清晰截图
```

## 数据流与隐私边界
```mermaid
flowchart LR
 subgraph Device[司机设备]
 GPS[浏览器定位：仅经授权] --> Context[城市范围与前台移动状态]
 Clock[上海时区时钟] --> Engine[确定性参考决策]
 Context --> Engine
 Photo[私人截图] --> OCR[本机 WASM OCR]
 OCR --> Parser[标签/周期/金额解析]
 Parser --> Reconcile[整数分核对与语义去重]
 Reconcile --> DB[(IndexedDB)]
 DB --> Income[收入结构]
 Engine --> Pages[司机五类页面]
 end
 Public[公开天气模型] -->|固定西安城市坐标，不上传精确 GPS| Engine
 Pack[版本化静态城市参考包] --> Engine
 Official[平台官方授权接口：未接入] -.-> Parser
 Traffic[路况/航班/高铁/活动：未接入] -.-> Engine
 Team[内部研究：实验与 benchmark] --> Evidence[匿名样本/策略评估/复审]
 Evidence -.人工验证后发布.-> Pack
```

## 页面信息架构
```mermaid
flowchart TD
 Root[司机 PWA] --> Home[副驾首页：一个动作/原因/参考标记]
 Root --> Map[收益地图：区域/证据状态/安全查看位置]
 Root --> Plan[今日策略：当前窗口/后续窗口/听单参考]
 Root --> Income[收入结构：可选截图/快照/来源/周期/差异]
 Root --> Status[今日状态：时钟/天气/定位/会话计时/离线]
 Plan --> Events[城市事件：来源/时间/可信度/失效]
 Status --> Settings[自动设置：定位/安装/驾驶/清除本机数据]
 Team[内部研究入口：不在司机导航] --> Bench[benchmark 与五行动回放]
 Team --> Experiments[实验方案/版本/验收条件]
```

## 部署图与分享时序
```mermaid
sequenceDiagram
 participant OS as 系统分享（支持的已安装 PWA）
 participant SW as Service Worker
 participant DB as IndexedDB
 participant UI as 收入页
 OS->>SW: POST 图片到相对 share-target
 SW->>DB: 暂存图片（本机）
 SW-->>OS: 303 跳转收入页
 UI->>DB: 取出并删除临时图片
 UI->>UI: 本机 OCR 与核对
 UI->>DB: 用户确认后保存结构化快照
 Note over OS,UI: 不支持系统分享时使用文件选择；私人截图不进入 GitHub
```
```mermaid
flowchart LR
 Repo[Mobility-Lab / driver 源码] --> CI[测试＋构建独立静态产物]
 CI --> Pages[GitHub Pages / Mobility-Lab]
 Pages --> Shell[PWA App Shell 离线缓存]
 Shell --> Local[每个浏览器独立 IndexedDB]
 Repo --> Internal[research：源码内研究工具，公开部署时排除]
```

## 关键不变量
金额单位为整数分；缺失不是0；原标签不被统一覆盖。日收入、日流水、月流水为不同快照，不相加。总分核对通过不等于平台结算正确。没有成本和时长不能计算净收入或净时薪。个人原图与识别全文不进入公开产物。示例／历史／实时证据不能混用。离线不复用过期行动。
