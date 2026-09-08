export const labels = {
  trip: "行程收入",
  reward: "奖励",
  addition: "增项",
  deduction: "扣减",
  valueAdded: "增值",
  displayedIncome: "平台显示收入",
  platformTurnover: "平台流水",
};
export const money = (v) => (v == null ? "未知" : `¥${(v / 100).toFixed(2)}`);
export function cents(s) {
  if (!/^\d{1,8}\.\d{2}$/.test(String(s))) return null;
  const [a, b] = s.split(".");
  return Number(a) * 100 + Number(b);
}
export function reconcile(f) {
  const keys = ["trip", "reward", "addition", "deduction", "valueAdded"];
  if (
    keys.some((k) => !Number.isSafeInteger(f[k])) ||
    !Number.isSafeInteger(f.displayedIncome)
  )
    return { status: "incomplete", difference: null };
  const sum = f.trip + f.reward + f.addition - f.deduction + f.valueAdded;
  return {
    status: sum === f.displayedIncome ? "matched" : "mismatch",
    difference: f.displayedIncome - sum,
  };
}
export function parseIncome(raw, { confidence = 100, now = Date.now() } = {}) {
  const t = raw
    .normalize("NFKC")
    .replace(/[ \t\u3000]/g, "")
    .replace(/[,，](?=\d{3})/g, "")
    .replace(/[。．]/g, ".");
  const f = Object.fromEntries(Object.keys(labels).map((k) => [k, null]));
  const get = (label) => {
    const re = new RegExp(
      label + "[^\\d\\n]*\\n?[^\\d\\n]*(\\d{1,8}\\.\\d{2})(?!\\d)",
    );
    return cents(t.match(re)?.[1] || "");
  };
  // 先识别页面身份，不把明细金额当汇总。
  let page =
    t.includes("今日流水") && t.includes("今日收入")
      ? "today-data"
      : t.includes("月总流水")
        ? "month-turnover"
        : /今日收入/.test(t)
          ? "day-income"
          : /行程费用/.test(t)
            ? /免佣卡奖励|接驾补偿奖/.test(t)
              ? "mixed-detail"
              : "trip-detail"
            : /奖励/.test(t)
              ? "reward-detail"
              : "unknown";
  let year = t.match(/(20\d{2})[年\-/]/)?.[1] || null;
  let md = t.match(/(\d{1,2})月(\d{1,2})日/);
  let selected = t.match(/(?:^|\n)今日\n?(\d{1,2})[.\-/](\d{1,2})/);
  let date = md || selected || t.match(/(\d{1,2})-(\d{1,2})(?=\d{2}:\d{2})/);
  let month = t.match(/(\d{1,2})月总流水/)?.[1];
  if (page === "month-turnover" && month) {
    const ym = t.match(/(20\d{2})-(\d{2})/);
    if (ym) year = ym[1];
  }
  let period =
    page === "month-turnover" && month
      ? `${year || "????"}-${String(month).padStart(2, "0")}`
      : date
        ? `${year || "????"}-${date[1].padStart(2, "0")}-${date[2].padStart(2, "0")}`
        : null;
  if (period) {
    const parts = period.split("-");
    const maxDay = new Date(
      Date.UTC(year ? +year : 2000, +parts[1], 0),
    ).getUTCDate();
    if (
      +parts[1] < 1 ||
      +parts[1] > 12 ||
      (parts[2] && (+parts[2] < 1 || +parts[2] > maxDay))
    )
      period = null;
  }
  if (page === "today-data") {
    f.displayedIncome = get("今日收入");
    f.platformTurnover = get("今日流水");
  }
  if (page === "day-income" || page === "month-turnover") {
    f.displayedIncome =
      page === "day-income" ? get("今日收入(?:[^\\n]*日[)）]?)?") : null;
    if (page === "day-income" && f.displayedIncome == null) {
      const after = t.split("今日收入").at(-1);
      f.displayedIncome = cents(
        after.match(/(?:\n|[)）])(\d{1,8}\.\d{2})/)?.[1] || "",
      );
    }
    f.platformTurnover = page === "month-turnover" ? get("月总流水") : null;
    for (const [key, label] of Object.entries({
      trip: "行程",
      reward: "奖励",
      addition: "增项",
      deduction: "扣减",
      valueAdded: "增值",
    }))
      f[key] = get(label);
  }
  if (page === "trip-detail" || page === "mixed-detail") {
    const amounts = [
      ...t.matchAll(/行程费用[^\d\n]*\n?[^\d\n]*(\d+\.\d{2})/g),
    ].map((m) => cents(m[1]));
    // 仅显示单页明细小计，不冒充当天完整收入。
    if (amounts.length) f.trip = amounts.reduce((a, b) => a + b, 0);
  }
  if (page === "reward-detail" || page === "mixed-detail") {
    const amounts = [
      ...t.matchAll(
        /(?:免佣卡奖励|接驾补偿奖)[^\d\n]*\n?[^\d\n]*(\d+\.\d{2})/g,
      ),
    ].map((m) => cents(m[1]));
    if (amounts.length) f.reward = amounts.reduce((a, b) => a + b, 0);
  }
  const rec = reconcile(f);
  const problems = [];
  if (page === "unknown") problems.push("没有识别到支持的享道页面");
  if (!period) problems.push("没有识别到明确周期，请重选含日期的截图");
  if (confidence < 60) problems.push("识别置信度不足，请重选清晰截图");
  if (/[-−]\s*\d+\.\d{2}/.test(t)) {
    problems.push("发现负金额，本版不支持冲正快照，请保留平台原账目");
    for (const k of Object.keys(f)) f[k] = null;
  }
  if (page.includes("detail")) {
    const dates = new Set(
      [...t.matchAll(/(\d{1,2})-(\d{1,2})(?=\d{2}:\d{2})/g)].map(
        (m) => `${+m[1]}-${+m[2]}`,
      ),
    );
    if (dates.size > 1) problems.push("明细包含多个日期，不能归入单日快照");
  }
  if (page === "today-data" || page === "month-turnover")
    problems.push("需要局部金额二次识别");
  if (Object.values(f).every((v) => v == null))
    problems.push("没有识别到有效金额");
  if (page === "day-income" && rec.status !== "matched")
    problems.push("日收入总分未核对通过，请重选完整截图");
  if (
    page === "today-data" &&
    (f.displayedIncome == null || f.platformTurnover == null)
  )
    problems.push("今日数据汇总不完整");
  return {
    page,
    period,
    periodPrecision: year ? "year" : "month-day",
    fields: f,
    confidence: Math.round(confidence),
    reconciliation: rec,
    problems,
    canSave: problems.length === 0,
    recognizedAt: new Date(now).toISOString(),
    source: "享道截图／本机OCR",
    contentKey: JSON.stringify([page, period, f]),
  };
}
export function rewardRatio(record) {
  const f = record.fields,
    base = f.displayedIncome ?? f.platformTurnover;
  return base > 0 && f.reward != null
    ? `${((f.reward / base) * 100).toFixed(1)}%`
    : null;
}
