# 发布入口与回滚
2026年09月08日：GitHub API对私有Mobility-Lab启用Pages返回422：Your current plan does not support GitHub Pages for this repository。
因此不改私有仓库可见性、不升级付费套餐。采用独立静态发布仓库driver-copilot-pages，内容仅为driver/dist白名单产物。
规范源码：jaminliu89/Mobility-Lab，driver/。研究、测试、个人输入不在部署产物。
生产URL：https://jaminliu89.github.io/driver-copilot-pages/。
Mobility-Lab CI只测试和构建并保留artifact；发布由本机将同一dist写入公开仓库main，再由GitHub Pages branch构建。没有配置跨仓库自动推送token。
首次上线不能回滚到旧driver站点；后续以正常revert发布仓库上一提交回滚，不force push。内容hash决定Service Worker版本；清理只针对driver-copilot-shell-前缀，不涉及同源其他应用。
没有为Gitee建立额外仓库：本轮用户指定GitHub Pages且要求最轻方案。

## 已完成的线上核验
运行版本：0.1.0，artifact `6637e15e551e`。源码修复版本 `ac473bddfed05f4d984cd803f1e8c0706d314fc1`；静态运行产物提交 `f50406a`。后续交付文档更新不改变运行指纹。

- [源码CI](https://github.com/jaminliu89/Mobility-Lab/actions/runs/34189130412)：success，原项目8项测试与构建。
- [司机模块CI](https://github.com/jaminliu89/Mobility-Lab/actions/runs/34189130408)：success，17项单元测试、生产依赖审计与构建。
- [Pages部署](https://github.com/jaminliu89/driver-copilot-pages/actions/runs/34189010926)：success。
- 在线release.json实际读回上述指纹，首页和Mermaid页面HTTP 200。
- 在真实Pages URL执行14项浏览器E2E全部通过：真实截图OCR→保存→刷新读回→重复导入→断网刷新→删除刷新；无页面异常。原始结构化结果保存在私有源码driver/docs/test-evidence/online-browser.json。

此处的浏览器验证使用自动化Chrome，不替代真实手机安装、系统分享面板和真实司机试用。
