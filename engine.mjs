export const CITY = { name: "西安", lat: 34.2658, lon: 108.9541 };
export function localClock(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((x) => [x.type, x.value]));
}
export function dateKey(now = Date.now()) {
  const p = localClock(now);
  return `${p.year}-${p.month}-${p.day}`;
}
export function inCity(p) {
  return (
    p &&
    p.latitude >= 33.9 &&
    p.latitude <= 34.65 &&
    p.longitude >= 108.6 &&
    p.longitude <= 109.3
  );
}
export function fresh(time, now, ttl) {
  const t = Number(time);
  return Number.isFinite(t) && t <= now + 60000 && now - t <= ttl;
}
export function decide({
  now = Date.now(),
  position = null,
  restStarted = null,
  evidence = null,
  region = null,
} = {}) {
  const clock = localClock(now),
    h = +clock.hour;
  const result = (action, title, reason, basis = "reference") => ({
    action,
    title,
    reason,
    basis,
    updatedAt: now,
    expiresAt: now + 60000,
  });
  if (
    position &&
    fresh(position.at, now, 300000) &&
    position.accuracy <= 1000 &&
    !inCity(position)
  )
    return result(
      null,
      "这里还没有城市策略",
      "目前只提供西安参考；不会把西安的建议用在你所在的城市。",
      "unavailable",
    );
  if (restStarted && now >= restStarted)
    return result(
      "rest",
      "安心休息，不赶这一会儿",
      "休息计时已开始；准备好后，在停车状态结束计时。",
    );
  // 生产没有合格区域证据；未来适配器必须满足来源、区域、时效和复审门禁。
  if (
    evidence &&
    position &&
    fresh(position.at, now, 300000) &&
    position.accuracy <= 1000 &&
    inCity(position) &&
    region &&
    evidence.region === region &&
    evidence.city === "西安" &&
    evidence.verified === true &&
    evidence.source &&
    evidence.confidence >= 0.8 &&
    fresh(evidence.at, now, 300000) &&
    evidence.expiresAt > now &&
    evidence.expiresAt <= now + 3600000
  ) {
    if (evidence.risk === true)
      return result(
        "withdraw",
        "完成服务后，安全离开当前区域",
        evidence.reason,
        "verified",
      );
    if (
      evidence.target &&
      evidence.expectedGain > evidence.moveCost &&
      evidence.expectedGain > 0
    )
      return result(
        "change",
        `完成服务后，考虑前往${evidence.target}`,
        evidence.reason,
        "verified",
      );
  }
  if (h < 6 || h >= 23)
    return result(
      "rest",
      "时间不早了，先休息",
      "深夜休息参考；不为完成流水目标延长驾驶。",
    );
  if (h >= 12 && h < 15)
    return result(
      "rest",
      "把午间留给自己",
      "午间可安排吃饭、充电或休息。仅按时段参考，尚无实时收益依据。",
    );
  if (h >= 21)
    return result(
      "adjust",
      "准备收工时，检查顺路设置",
      "若准备回家，停车后查看平台顺路功能；副驾不会替你修改。",
    );
  return result(
    "run",
    "先保持当前服务安排",
    "城市时段参考；没有可靠区域收益证据，不建议为了热点额外空驶。",
  );
}
export const actions = {
  run: "跑",
  change: "换",
  rest: "休",
  adjust: "调",
  withdraw: "撤",
};
export const regions = [
  {
    id: "north",
    name: "西安北站",
    x: 51,
    y: 18,
    detail: "候客排队与到站需求均未接入；不要只凭到站时间空驶前往。",
  },
  {
    id: "center",
    name: "钟楼商圈",
    x: 52,
    y: 50,
    detail: "拥堵与可停靠位置未知；以现场道路与平台要求为准。",
  },
  {
    id: "hightech",
    name: "高新",
    x: 25,
    y: 67,
    detail: "没有经过验证的分时收益样本，暂不评级。",
  },
  {
    id: "qujiang",
    name: "曲江",
    x: 69,
    y: 79,
    detail: "活动散场与需求未验证，不推测订单或收益。",
  },
  {
    id: "airport",
    name: "咸阳机场",
    x: 17,
    y: 12,
    detail: "航班、蓄车量和返程情况未接入；不建议仅凭热点主动空驶。",
  },
];
export function weatherFresh(w, now = Date.now()) {
  return !!w && fresh(w.at, now, 1800000) && fresh(w.modelAt, now, 1800000);
}
