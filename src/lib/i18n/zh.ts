import { formatRM } from "@/lib/money";
import type { Messages } from "./en";

export const zh: Messages = {
  locale: "zh-CN",
  warning: {
    half: (budgetSen, daysLeft) => `本月预算 ${formatRM(budgetSen)} 已用掉一半，还剩 ${daysLeft} 天。`,
    eighty: (budgetSen, daysLeft) => `本月预算 ${formatRM(budgetSen)} 已用掉 80%，还剩 ${daysLeft} 天。`,
    usedUp: (budgetSen) => `本月预算 ${formatRM(budgetSen)} 已经全部用完。`,
    exceeded: (overSen) => `预算已超出 ${formatRM(overSen)}。不如安排一个零消费周末吧。`,
    pace: (fasterPct, outOfCashDay) =>
      `你的花费比计划快了 ${fasterPct}%。照这个速度，你会在 ${outOfCashDay} 号用完预算。`,
    spike: (amountSen, where, pct) =>
      `${where ? `在 ${where} 花的 ` : ""}${formatRM(amountSen)} 占本月预算的 ${pct}%。这是一次性消费吗？`,
  },
  push: {
    warningTitle: "SkyFin 预算提醒",
    weeklyTitle: "你的每周审计已生成",
    monthlyTitle: "你的月度总结已生成",
    budgetAppliedTitle: "新的每月预算",
    budgetApplied: (month, budgetSen) => `${month}的预算是 ${formatRM(budgetSen)}，点这里修改`,
  },
  audit: {
    headline: (totalSen, wantsPct) => `这段时间你花了 ${formatRM(totalSen)}，其中 ${wantsPct}% 花在想要的东西上。`,
    tipMicro: (label) => ({
      title: `${label} 减半`,
      detail: `小额的 ${label} 很快就会累积起来。隔一次再买，或者自己从家里带。`,
    }),
    tipCategory: (name) => ({
      title: `控制${name}`,
      detail: `给${name}定一个每周上限，付钱前先看看还剩多少。`,
    }),
    tipOverall: () => ({
      title: "每周安排一天零消费",
      detail: "去嘛嘛档或宿舍食堂吃饭，不去咖啡馆，出门坐校巴。",
    }),
    tipCheck: () => ({
      title: "付款前先停一下",
      detail: "每次用电子钱包或卡付款前，先问自己：这是需要还是想要？",
    }),
  },
};
