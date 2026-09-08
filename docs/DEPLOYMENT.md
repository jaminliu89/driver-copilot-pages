# 发布入口与回滚
2026年09月08日：GitHub API对私有Mobility-Lab启用Pages返回422：Your current plan does not support GitHub Pages for this repository。
因此不改私有仓库可见性、不升级付费套餐。采用独立静态发布仓库driver-copilot-pages，内容仅为driver/dist白名单产物。
规范源码：jaminliu89/Mobility-Lab，driver/。研究、测试、个人输入不在部署产物。
生产URL：https://jaminliu89.github.io/driver-copilot-pages/。
Mobility-Lab CI只测试和构建并保留artifact；发布由本机将同一dist写入公开仓库main，再由GitHub Pages branch构建。没有配置跨仓库自动推送token。
首次上线不能回滚到旧driver站点；后续以正常revert发布仓库上一提交回滚，不force push。内容hash决定Service Worker版本；清理只针对driver-copilot-shell-前缀，不涉及同源其他应用。
没有为Gitee建立额外仓库：本轮用户指定GitHub Pages且要求最轻方案。
