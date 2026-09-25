import { formatRM } from "@/lib/money";
import type { Messages } from "./en";

export const ms: Messages = {
  locale: "ms-MY",
  warning: {
    half: (budgetSen, daysLeft) =>
      `Separuh daripada bajet ${formatRM(budgetSen)} anda sudah digunakan, tinggal ${daysLeft} hari lagi.`,
    eighty: (budgetSen, daysLeft) =>
      `80% daripada bajet ${formatRM(budgetSen)} anda sudah digunakan, tinggal ${daysLeft} hari lagi.`,
    usedUp: (budgetSen) => `Seluruh bajet ${formatRM(budgetSen)} anda untuk bulan ini sudah digunakan.`,
    exceeded: (overSen) => `Bajet dilampaui sebanyak ${formatRM(overSen)}. Cuba hujung minggu tanpa belanja.`,
    pace: (fasterPct, outOfCashDay) =>
      `Anda berbelanja ${fasterPct}% lebih laju daripada rancangan. Pada kadar ini, duit anda habis pada ${outOfCashDay}hb.`,
    spike: (amountSen, where, pct) =>
      `${formatRM(amountSen)}${where ? ` di ${where}` : ""} ialah ${pct}% daripada bajet bulan ini. Adakah ini pembelian sekali sahaja?`,
  },
  push: {
    warningTitle: "Amaran bajet SkyFin",
    weeklyTitle: "Audit mingguan anda sudah siap",
    monthlyTitle: "Ulasan bulanan anda sudah siap",
    budgetAppliedTitle: "Bajet bulanan baharu",
    budgetApplied: (month, budgetSen) => `Bajet anda untuk ${month} ialah ${formatRM(budgetSen)} — ketik untuk ubah`,
  },
  audit: {
    headline: (totalSen, wantsPct) =>
      `Anda berbelanja ${formatRM(totalSen)}, dan ${wantsPct}% daripadanya untuk kehendak.`,
    tipMicro: (label) => ({
      title: `Kurangkan ${label} separuh`,
      detail: `Belian kecil ${label} cepat bertambah. Langkau sekali setiap dua kali, atau bawa sendiri dari rumah.`,
    }),
    tipCategory: (name) => ({
      title: `Kawal ${name}`,
      detail: `Tetapkan had mingguan untuk ${name} dan semak bakinya sebelum bayar.`,
    }),
    tipOverall: () => ({
      title: "Satu hari tanpa belanja setiap minggu",
      detail: "Makan di mamak atau kafe kolej, bukan kafe mahal, dan naik bas kampus.",
    }),
    tipCheck: () => ({
      title: "Berhenti sekejap sebelum bayar",
      detail: "Sebelum setiap bayaran eWallet atau kad, tanya diri: keperluan atau kehendak?",
    }),
  },
};
