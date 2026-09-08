import {
  CITY,
  localClock,
  decide,
  actions,
  regions,
  inCity,
  fresh,
  weatherFresh,
} from "./engine.mjs";
import { labels, money, rewardRatio } from "./income.mjs";
import { recognizeIncome } from "./ocr.mjs";
import {
  allSnapshots,
  saveSnapshot,
  removeSnapshot,
  setting,
  setSetting,
  clearPrivate,
  consumeShared,
} from "./store.mjs";
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const app = document.querySelector("#app");
let records = [],
  position = null,
  geoError = "",
  weather = null,
  weatherError = "",
  weatherLoading = false,
  restStarted = null,
  sessionStarted = null,
  driving = false,
  preview = null,
  reading = false,
  progress = "",
  region = "center",
  storageError = "",
  installPrompt = null,
  watch = null;
let geoEnabled = false,
  online = navigator.onLine;
let route = location.hash.slice(1) || "home";
const routes = [
  "home",
  "map",
  "plan",
  "income",
  "status",
  "events",
  "settings",
];
const names = {
  home: "副驾",
  map: "地图",
  plan: "策略",
  income: "收入",
  status: "状态",
};
const paths = {
  home: "M4 12l8-8 8 8M6 10v10h12V10M10 20v-6h4v6",
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5zM9 3v16M15 5v16",
  plan: "M5 5h14v16H5zM9 3h6v4H9zM8 11h8M8 15h8",
  income: "M4 6h16v14H4zM4 6l12-3v3M15 11h5v5h-5z",
  status: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v6l4 2",
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[k]}"/></svg>`;
const elapsed = (t) =>
  t ? `${Math.max(0, Math.floor((Date.now() - t) / 60000))} 分钟` : "未开始";
function toast(t) {
  const n = document.querySelector("#notice");
  n.textContent = t;
  setTimeout(() => {
    if (n.textContent === t) n.textContent = "";
  }, 6000);
}
const head = (title, sub) =>
  `<div class="pagehead"><div><h1>${title}</h1><p>${sub}</p></div></div>`;
function sourceBadge() {
  return `<span class="badge">${online ? "时段参考" : "离线 · 时段参考"}</span>`;
}
function actionView() {
  const d = decide({ position, restStarted });
  return `<div class="action-panel"><div class="action-letter">${actions[d.action] || "—"}</div><div>${d.basis === "unavailable" ? '<span class="badge">城市未覆盖</span>' : sourceBadge()}<h2 class="action-reason">${esc(d.title)}</h2><p>${esc(d.reason)}</p></div></div>`;
}
function home() {
  const c = localClock();
  return (
    head(
      "今天，少一点空等",
      `西安参考 · ${c.month}月${c.day}日 ${c.hour}:${c.minute}`,
    ) +
    actionView() +
    `<p class="meta-line">按本机时间每分钟更新。停车后查看；当前订单和安全驾驶优先。</p><div class="columns"><section><h2>下一段时间</h2><p>${+c.hour < 12 ? "午间可以留出吃饭和休息时间。" : +c.hour < 15 ? "休息结束后，再按平台实际情况安排。" : "把休息排进今天，不为数字延长驾驶。"}</p><div class="toolbar"><a href="#plan">查看今日策略</a></div></section><section><h2>收入不用手算</h2><p class="muted">${records.length ? `本机已保存 ${records.length} 个独立快照。` : "没有截图也可以使用副驾。"}停车后可选一张截图，自动查看组成。</p><div class="toolbar"><a href="#income">查看收入结构</a></div></section></div><div class="callout">区域收益与实时路况尚未接入，所以暂不建议为所谓“热点”额外空驶。</div>`
  );
}
function mapView() {
  const r = regions.find((x) => x.id === region);
  return (
    head("收益地图", "先看证据，再决定是否移动") +
    `<div class="map"><svg viewBox="0 0 700 400" preserveAspectRatio="none" aria-hidden="true"><path d="M60 280Q320 210 660 280M350 20V390M40 130Q320 190 690 130" fill="none" stroke="#fff" stroke-width="16"/><rect x="230" y="135" width="250" height="170" rx="55" fill="none" stroke="#c7d3c8" stroke-width="14"/></svg>${regions.map((r) => `<button data-region="${r.id}" style="left:${r.x}%;top:${r.y}%" aria-pressed="${r.id === region}">${r.name}</button>`).join("")}<span class="map-label">区域关系示意 · 非导航底图</span></div><section class="panel"><div class="region-title"><h2>${r.name}</h2><span class="badge">收益待验证</span></div><p>${r.detail}</p><p class="small">区域位置用于辨认，不代表精确距离、顺序或可行路线。</p></section><div class="callout">${position && fresh(position.at, Date.now(), 300000) ? (inCity(position) ? "已在西安参考范围内；定位不能识别你是否空车或已完单。" : "当前位置不在西安参考范围内。") : "尚无有效定位；不会猜测你所在的区域。"}</div><a href="#status">查看定位与数据状态</a>`
  );
}
function plan() {
  const h = +localClock().hour;
  const windows = [
    [
      6,
      10,
      "06:00–10:00",
      "早间出车参考",
      "按平台实际情况接单，避免跨区追热点。",
    ],
    [
      10,
      12,
      "10:00–12:00",
      "留意空等",
      "平台未同步完单；这里不会自动声称你已经空等多久。",
    ],
    [
      12,
      15,
      "12:00–15:00",
      "给休息留时间",
      "可安排吃饭或充电，收入高低尚无实测结论。",
    ],
    [
      15,
      21,
      "15:00–21:00",
      "按实际需求安排",
      "不要因时段标签放弃眼前合理服务。",
    ],
    [
      21,
      23,
      "21:00–23:00",
      "准备收工",
      "停车后查看顺路功能；不代替你操作平台。",
    ],
  ];
  return (
    head("今日策略", "先安排时间，再看平台实际情况") +
    sourceBadge() +
    `<h2 class="section">时段安排</h2><div class="section">${windows.map(([a, b, t, title, body]) => `<div class="time-item ${h >= a && h < b ? "current" : ""}"><div>${t}${h >= a && h < b ? '<div class="small">当前窗口</div>' : ""}</div><div><h3>${title}</h3><p class="small">${body}</p></div></div>`).join("")}</div><section class="section"><h2>听单设置，停车后再看</h2><div class="row"><span>实时单、特惠优选、特惠订单</span><span class="badge">保持现有设置</span></div><p class="small">单量增加不等于收入增加。尚无你的时段收益与成本证据，不推荐统一开启或关闭特惠。</p><div class="row"><span>预约、跨城、包车</span><span class="badge">先看完整占用时间</span></div><p class="small">接驾、等待与返程都会占时间；没有可靠数据时不承诺哪个更赚。</p></section><div class="toolbar"><a href="#events">查看城市事件</a><a href="#status">安排休息计时</a></div>`
  );
}
const pageNames = {
  "today-data": "今日数据",
  "day-income": "日收入汇总",
  "month-turnover": "月流水",
  "mixed-detail": "单页全部明细",
  "trip-detail": "单页行程明细",
  "reward-detail": "单页奖励明细",
};
function fieldsView(r) {
  return Object.entries(labels)
    .filter(
      ([k]) =>
        r.fields[k] != null ||
        ["trip", "reward", "addition", "deduction", "valueAdded"].includes(k),
    )
    .map(
      ([k, l]) =>
        `<div class="row"><span>${l}</span><span class="value">${money(r.fields[k])}</span></div>`,
    )
    .join("");
}
function snapshot(r, i) {
  const f = r.fields,
    ratio = rewardRatio(r),
    total = f.displayedIncome ?? f.platformTurnover;
  return `<section class="panel snapshot"><h3>${esc(r.period?.replace("????-", "年份未确认 · "))} · ${pageNames[r.page] || "截图"}</h3><p class="small">${esc(r.source)} · ${esc(new Date(r.recognizedAt).toLocaleString("zh-CN"))}</p>${total != null ? `<p class="money-large">${money(total)}</p><p class="small">${f.displayedIncome != null ? "平台显示收入" : "平台原名：流水"}，不是净收入</p>` : ""}${ratio && +ratio.replace("%", "") <= 100 ? `<div class="income-bar" aria-label="奖励占比${ratio}"><span style="width:${100 - parseFloat(ratio)}%"></span><span style="width:${parseFloat(ratio)}%"></span></div><p>奖励占本页总额 ${ratio}</p>` : ""}${fieldsView(r)}${f.displayedIncome != null && f.platformTurnover != null ? `<div class="callout warning">同页收入与流水差额 ${money(f.displayedIncome - f.platformTurnover)}，原因未确认；不是抽佣或成本。</div>` : ""}<p class="small">${r.reconciliation.status === "matched" ? "总分核对通过；不代表平台结算已审计。" : "按页面原口径保存；缺失字段保持未知。"}${r.page.includes("detail") ? " 单页小计，不等于当天全部收入。" : ""}</p>${i != null ? `<div class="toolbar"><button data-delete="${i}" class="danger">删除此快照</button></div>` : ""}</section>`;
}
function income() {
  return (
    head("收入结构", "停车后选图，副驾帮你分清每一项") +
    `<p class="small">截图只在你的设备识别。无需填写金额或分析数据，也不用上传到我们的服务器。</p><div class="toolbar">${reading ? '<button disabled>正在本机识别</button><button id="cancelOCR">取消识别</button>' : '<label class="file-button">选择享道截图<input id="file" type="file" accept="image/png,image/jpeg,image/webp"></label>'}</div><p class="small">首次识别会下载约20MB本机识别资源；支持JPEG、PNG、WebP，单张不超过12MB。</p>${reading ? `<div class="panel" role="status"><p>${esc(progress || "准备识别资源…")}</p><progress class="progress" aria-label="识别进度"></progress></div>` : ""}${preview ? `<div class="section"><h2>识别结果，确认后保存</h2>${snapshot(preview)}${preview.problems.length ? `<div class="callout warning">${preview.problems.map(esc).join("；")}。不需要手动修数字。</div>` : '<p class="small">请看一眼金额是否与截图相符；年份未出现时会保持未知。</p>'}<div class="toolbar"><button id="save" class="primary" ${preview.canSave ? "" : "disabled"}>确认保存到本机</button><button id="discard">放弃本次识别</button></div></div>` : ""}${!records.length ? '<div class="empty"><h2>还没有收入快照</h2><p>日收入、今日流水和月流水分开保存。无成本和工时记录时，不会把它们叫作净收入或真实时薪。</p><a href="#home">不导入，直接看副驾</a></div>' : `<div class="callout">以下是不同页面或时间的快照，不会彼此累加。旧截图始终按原周期展示。</div><h2 class="section">已保存快照</h2>${records.map(snapshot).join("")}`}`
  );
}
function weatherText() {
  return weatherFresh(weather)
    ? `${weather.temperature}°C · ${weather.rain > 0 ? "有降水" : "模型未报降水"}`
    : weatherLoading
      ? "正在获取城市天气…"
      : weatherError || "暂无新鲜天气数据";
}
function events() {
  return (
    head("城市事件", "看清来源，不凭消息去追热点") +
    `<section class="panel"><h2>西安天气</h2><p>${esc(weatherText())}</p><p class="small">${weatherFresh(weather) ? `模型时间 ${esc(weather.time)}（北京时间）。` : "未获得新鲜模型数据时不产生天气收益判断。"}</p><p class="small">来源：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>，天气模型不是现场观测。仅查询固定西安城市坐标。</p><div class="toolbar"><button id="refreshWeather" ${weatherLoading ? "disabled" : ""}>刷新天气</button></div></section><h2>其他城市信号</h2>${[
      ["航班与机场蓄车", "未接入实时航班和候客队列"],
      ["高铁到发", "未接入实时到站与排队数据"],
      ["演出、展会与活动", "没有已核验且在有效期内的活动源"],
      ["实时路况", "未接入拥堵与管制数据"],
    ]
      .map(
        ([a, b]) =>
          `<div class="row"><div><h3>${a}</h3><p class="small">${b}</p></div><span class="badge">未接入</span></div>`,
      )
      .join(
        "",
      )}<div class="callout">“未接入”不代表“没有事件”。本页不会把过去的活动当作今天的需求。</div>`
  );
}
function status() {
  return (
    head("今日状态", "设备能知道什么，这里说清楚") +
    `<section class="panel"><h2>当前连接</h2><div class="row"><span>网络</span><span>${online ? "在线" : "离线"}</span></div><div class="row"><span>天气</span><span>${esc(weatherText())}</span></div><div class="row"><span>定位</span><span>${position && fresh(position.at, Date.now(), 300000) ? (inCity(position) ? "西安参考范围内" : "西安范围外") : "未取得有效定位"}</span></div><p class="small">${geoError ? esc(geoError) : position ? `定位精度约${Math.round(position.accuracy)}米；坐标仅留在内存，不上传。` : "可选择允许前台定位，拒绝也能看西安时段参考。"}</p><div class="toolbar"><button id="locate">允许前台定位</button><a href="#events">查看数据来源</a></div></section><section class="panel"><h2>给自己留点时间</h2><div class="row"><span>本次使用会话</span><span>${elapsed(sessionStarted)}</span></div><div class="row"><span>休息计时</span><span>${elapsed(restStarted)}</span></div><p class="small">会话计时不是平台在线工时；没有订单同步，不自动推断完单、空等或疲劳。</p><div class="toolbar"><button id="rest" class="primary">${restStarted ? "结束休息计时" : "开始休息计时"}</button></div></section><a href="#settings">自动设置与安装</a>`
  );
}
function settings() {
  return (
    head("自动设置", "少一点操作，把注意力留给驾驶") +
    `<section class="panel"><h2>驾驶时只读</h2><p>开启后只保留大字行动。前台定位检测到移动时也会切换；不能代替你判断是否安全停车。</p><div class="toolbar"><button id="drive2" class="primary">进入驾驶模式</button></div></section><section class="panel"><h2>添加到手机桌面</h2><p>Android：用支持安装的浏览器打开，选择“安装应用”或“添加到主屏幕”。</p><p>iPhone：用 Safari 打开，在分享菜单中选择“添加到主屏幕”。系统分享截图入口取决于浏览器支持。</p>${installPrompt ? '<div class="toolbar"><button id="install" class="primary">安装收益副驾</button></div>' : ""}<p class="small">在线打开一次后可离线看时段参考。OCR资源首次需要联网加载。</p></section><section class="panel"><h2>本机隐私</h2><p>不登录，不上传截图，不保存GPS轨迹。收入只保存在当前浏览器。删除浏览器数据或换手机后不会自动恢复。</p><div class="toolbar"><button id="clear" class="danger">清除本机数据</button><button id="stopLocate">停止定位</button></div></section><p class="small">版本0.1 · 个人试用。真实增收效果、真机安装和司机可用性仍待验证。</p>`
  );
}
function render() {
  if (driving)
    document.querySelectorAll("dialog").forEach((d) => {
      d.close();
      d.remove();
    });
  if (!routes.includes(route)) route = "home";
  if (driving) {
    app.innerHTML = `<main class="driverscreen"><h1>驾驶模式</h1>${actionView()}<p class="small">专心驾驶。当前服务完成后，再考虑建议。</p><button id="park">我已安全停车</button></main>`;
    bind();
    return;
  }
  app.innerHTML = `<header><a class="brand" href="#home">司机收益副驾<small>少一点空等，多一点自己的时间</small></a><div class="header-tools"><span class="device-line">${online ? "在线" : "离线"}</span><button id="drive">驾驶模式</button></div></header><div class="layout"><nav class="nav" aria-label="主导航">${Object.entries(
    names,
  )
    .map(
      ([k, v]) =>
        `<a href="#${k}" ${route === k ? 'aria-current="page"' : ""}>${icon(k)}${v}</a>`,
    )
    .join(
      "",
    )}</nav><main id="content" tabindex="-1">${storageError ? `<div class="callout warning" role="alert">${esc(storageError)}</div>` : ""}${{ home, map: mapView, plan, income, status, events, settings }[route]()}<footer>参考建议不保证收益。安全停车后查看和操作。</footer></main></div>`;
  bind();
}
const on = (id, fn) =>
  document.getElementById(id)?.addEventListener("click", () =>
    Promise.resolve()
      .then(fn)
      .catch((e) => toast(e.message || "操作失败，请重试")),
  );
function bind() {
  on("drive", () => {
    driving = true;
    cancelOCR();
    render();
  });
  on("drive2", () => {
    driving = true;
    cancelOCR();
    render();
  });
  on("park", () => {
    if (
      position &&
      fresh(position.at, Date.now(), 30000) &&
      position.speed > 2.8
    ) {
      toast("仍检测到移动，请停车后再操作");
      return;
    }
    driving = false;
    render();
  });
  on("locate", locate);
  on("refreshWeather", loadWeather);
  on("rest", async () => {
    const next = restStarted ? null : Date.now();
    await setSetting("rest", next);
    restStarted = next;
    render();
  });
  on("stopLocate", () => {
    if (watch != null) navigator.geolocation.clearWatch(watch);
    watch = null;
    geoEnabled = false;
    position = null;
    geoError = "定位已停止";
    toast("已停止前台定位");
    render();
  });
  on("install", async () => {
    await installPrompt.prompt();
    installPrompt = null;
    render();
  });
  on("discard", () => {
    preview = null;
    render();
  });
  on("save", async () => {
    try {
      await saveSnapshot(preview);
      records = await allSnapshots();
      preview = null;
      toast("已保存到本机");
      render();
    } catch (e) {
      toast(
        e.name === "ConstraintError"
          ? "这张快照已经保存，不会重复累计"
          : "保存失败，请检查浏览器存储权限",
      );
    }
  });
  on("clear", () =>
    confirmDelete(
      "清除本机数据？",
      "收入快照、临时分享图片和计时设置会被删除。",
      async () => {
        await cancelOCR();
        await clearPrivate();
        records = [];
        preview = null;
        restStarted = null;
        sessionStarted = Date.now();
        weather = null;
        if (watch != null) navigator.geolocation.clearWatch(watch);
        watch = null;
        geoEnabled = false;
        position = null;
        toast("本机数据已清除");
        render();
      },
    ),
  );
  on("cancelOCR", cancelOCR);
  document.querySelector("#file")?.addEventListener("change", (e) => {
    if (e.target.files[0]) readImage(e.target.files[0]);
  });
  document.querySelectorAll("[data-region]").forEach(
    (b) =>
      (b.onclick = () => {
        region = b.dataset.region;
        render();
      }),
  );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmDelete("删除这个快照？", "其他快照会保留。", async () => {
          await removeSnapshot(records[+b.dataset.delete].contentKey);
          records = await allSnapshots();
          render();
          toast("快照已删除");
        })),
  );
}
function confirmDelete(title, text, fn) {
  const d = document.createElement("dialog");
  d.innerHTML = `<h2>${title}</h2><p>${text}</p><div class="toolbar"><button class="cancel">取消</button><button class="danger confirm">确认删除</button></div>`;
  document.body.append(d);
  d.querySelector(".cancel").onclick = () => {
    d.close();
    d.remove();
  };
  d.querySelector(".confirm").onclick = async () => {
    try {
      await fn();
      d.close();
      d.remove();
    } catch {
      toast("删除失败，请检查存储权限");
    }
  };
  d.addEventListener("cancel", () => d.remove());
  d.showModal();
}
function locate() {
  geoEnabled = true;
  if (!navigator.geolocation) {
    geoError = "此浏览器不支持定位";
    render();
    return;
  }
  if (watch != null) navigator.geolocation.clearWatch(watch);
  geoError = "等待定位授权…";
  render();
  watch = navigator.geolocation.watchPosition(
    (p) => {
      position = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        speed: p.coords.speed,
        at: p.timestamp,
      };
      geoError = "";
      if (p.coords.speed > 2.8) {
        driving = true;
        cancelOCR();
      }
      render();
    },
    (e) => {
      geoError =
        e.code === 1
          ? "定位未获授权；仍可使用西安时段参考。"
          : "暂时无法取得位置，请稍后重试。";
      position = null;
      render();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}
async function loadWeather() {
  if (weatherLoading) return;
  weatherLoading = true;
  weatherError = "";
  render();
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lon}&current=temperature_2m,precipitation&timezone=Asia%2FShanghai`;
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw Error();
    const j = await r.json(),
      c = j.current;
    if (
      !Number.isFinite(c?.temperature_2m) ||
      !Number.isFinite(c?.precipitation)
    )
      throw Error();
    weather = {
      at: Date.now(),
      modelAt: Date.parse(c.time + "+08:00"),
      time: c.time.replace("T", " "),
      temperature: c.temperature_2m,
      rain: c.precipitation,
    };
    if (!weatherFresh(weather)) throw Error();
    await setSetting("weather", weather);
  } catch {
    weatherError = "天气暂不可用，继续显示时段参考";
  } finally {
    weatherLoading = false;
    render();
  }
}
let worker = null,
  ocrGeneration = 0;
async function cancelOCR() {
  ocrGeneration++;
  if (worker) {
    await worker.terminate();
    worker = null;
  }
  reading = false;
  progress = "";
  render();
}
async function readImage(file) {
  if (driving) return;
  preview = null;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  ) {
    toast("请选择不超过12MB的JPEG、PNG或WebP截图");
    return;
  }
  reading = true;
  progress = "加载本机识别资源…";
  route = "income";
  render();
  const generation = ++ocrGeneration;
  let timer;
  try {
    if (!window.Tesseract)
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = new URL("./vendor/tesseract.min.js", import.meta.url);
        s.onload = resolve;
        s.onerror = () => reject(Error("识别资源未加载，请联网后重试"));
        document.head.append(s);
      });
    if (generation !== ocrGeneration) return;
    const operation = (async () => {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width,
        height = bitmap.height;
      bitmap.close();
      if (width * height > 24000000)
        throw Error("图片像素过大，请选择原始手机截图");
      return recognizeIncome(file, window.Tesseract.createWorker, {
        width,
        height,
        paths: {
          workerPath: new URL("./vendor/worker.min.js", import.meta.url).href,
          corePath: new URL("./vendor/core/", import.meta.url).href,
          langPath: new URL("./vendor/lang", import.meta.url).href,
        },
        register: (w) => {
          if (generation === ocrGeneration) worker = w;
          else if (w) w.terminate().catch(() => {});
        },
        cancelled: () => generation !== ocrGeneration,
        logger: (m) => {
          if (generation !== ocrGeneration) return;
          progress =
            m.status === "recognizing text"
              ? `正在识别 ${Math.round((m.progress || 0) * 100)}%`
              : "准备本机识别资源…";
          const p = document.querySelector(".panel[role=status] p");
          if (p) p.textContent = progress;
        },
      });
    })();
    const data = await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("识别超时，请重试或更换清晰截图")),
          90000,
        );
      }),
    ]);
    if (data && generation === ocrGeneration) {
      preview = data;
      if (!preview.canSave) toast("识别结果需要核对，请重选完整清晰截图");
    }
  } catch (e) {
    if (generation === ocrGeneration)
      toast(e.message || "无法识别，请重选清晰截图");
  } finally {
    clearTimeout(timer);
    if (generation === ocrGeneration) {
      ocrGeneration++;
      if (worker) await worker.terminate();
      worker = null;
      reading = false;
      render();
    }
  }
}
window.addEventListener("hashchange", () => {
  route = location.hash.slice(1) || "home";
  render();
  document.getElementById("content")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
async function probeConnection() {
  try {
    const r = await fetch(new URL("./release.json", import.meta.url), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    online = r.ok;
  } catch {
    online = false;
  }
  if (!reading && !document.querySelector("dialog")) render();
}
window.addEventListener("online", () => {
  probeConnection();
  loadWeather();
});
window.addEventListener("offline", () => {
  online = false;
  render();
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
setInterval(() => {
  if (!reading && !document.querySelector("dialog")) render();
  if (!document.hidden) probeConnection();
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && watch != null) {
    navigator.geolocation.clearWatch(watch);
    watch = null;
  } else if (!document.hidden && geoEnabled && watch == null) {
    locate();
  }
});
async function init() {
  try {
    records = await allSnapshots();
    restStarted = await setting("rest");
    sessionStarted = (await setting("session")) || Date.now();
    weather = await setting("weather");
    await setSetting("session", sessionStarted);
  } catch {
    storageError = "本机存储不可用；仍可查看参考，收入保存暂不可用。";
  }
  render();
  probeConnection();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => toast("离线资源未准备好，请联网刷新后再试"));
  loadWeather();
  try {
    const f = await consumeShared();
    if (f) {
      route = "income";
      location.hash = "income";
      await readImage(f);
    }
  } catch {}
}
init();
