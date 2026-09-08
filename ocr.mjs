import { parseIncome, cents } from "./income.mjs";
// 仅支持已核验的享道手机截图版式。坐标是相对1260×2800的布局，不含任何预设金额。
export async function recognizeIncome(
  image,
  createWorker,
  {
    width,
    height,
    paths,
    register = () => {},
    cancelled = () => false,
    logger = () => {},
  },
) {
  const w = await createWorker(["chi_sim", "eng"], 1, { ...paths, logger });
  register(w);
  let initial, layout;
  try {
    initial = (await w.recognize(image)).data;
    if (/今日\s*流水|月\s*总\s*流水/.test(initial.text)) {
      await w.setParameters({ tessedit_pageseg_mode: "11" });
      layout = (await w.recognize(image, {}, { text: true, blocks: true }))
        .data;
    }
  } finally {
    await w.terminate();
    register(null);
  }
  if (cancelled()) return null;
  const record = parseIncome(initial.text, { confidence: initial.confidence });
  if (!["today-data", "month-turnover"].includes(record.page)) return record;
  if (Math.abs(width / height - 1260 / 2800) > 0.015) {
    record.problems.push("截图布局不在已验证范围，请选择日收入汇总页");
    record.canSave = false;
    return record;
  }
  const lines = (layout?.blocks || []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines),
  );
  const anchors =
    record.page === "today-data"
      ? [
          ["今日流水", 0.08, 0.22],
          ["今日收入", 0.08, 0.43],
        ]
      : [
          ["行程", 0.66, 0.48],
          ["奖励", 0.63, 0.54],
          ["增项", 0.63, 0.6],
          ["增值", 0.63, 0.66],
        ];
  const aligned = anchors.every(([label, x, y]) =>
    lines.some(
      (l) =>
        l.text.replace(/\s/g, "").includes(label) &&
        Math.abs(l.bbox.x0 / width - x) < 0.045 &&
        Math.abs(l.bbox.y0 / height - y) < 0.035,
    ),
  );
  if (!aligned) {
    record.problems.push("截图标签位置与已验证版式不符，请选择日收入汇总页");
    record.canSave = false;
    return record;
  }
  const profile =
    record.page === "today-data"
      ? {
          platformTurnover: [107, 710, 320, 125],
          displayedIncome: [108, 1310, 320, 130],
        }
      : {
          platformTurnover: [65, 445, 345, 105],
          trip: [840, 1410, 185, 80],
          reward: [840, 1582, 185, 80],
          addition: [840, 1754, 140, 80],
          valueAdded: [840, 1926, 140, 80],
        };
  const n = await createWorker("eng", 1, { ...paths, logger });
  register(n);
  let failed = false;
  try {
    await n.setParameters({
      tessedit_pageseg_mode: "7",
      tessedit_char_whitelist: "0123456789.-",
    });
    for (const [k, rect] of Object.entries(profile)) {
      if (cancelled()) return null;
      const [left, top, rw, rh] = rect;
      const { data } = await n.recognize(image, {
        rectangle: {
          left: Math.round((left * width) / 1260),
          top: Math.round((top * height) / 2800),
          width: Math.round((rw * width) / 1260),
          height: Math.round((rh * height) / 2800),
        },
      });
      const text = data.text.trim();
      const value = cents(text);
      if (value == null || data.confidence < 85) {
        failed = true;
        break;
      }
      record.fields[k] = value;
    }
  } finally {
    await n.terminate();
    register(null);
  }
  record.problems = record.problems.filter((x) => x !== "需要局部金额二次识别");
  if (failed)
    record.problems.push("局部金额识别不可靠，请选择完整日收入汇总页");
  if (record.page === "month-turnover") {
    const f = record.fields;
    if (f.trip + f.reward + f.addition + f.valueAdded !== f.platformTurnover)
      record.problems.push("月流水与可见组成不符，请重选截图");
  }
  record.numericMethod = "享道版式v1／英文单行局部识别／置信门禁";
  record.contentKey = JSON.stringify([
    record.page,
    record.period,
    record.fields,
  ]);
  record.canSave = record.problems.length === 0;
  return record;
}
