"use client";

import { Info } from "lucide-react";

const ZONES = [
  {
    label: "Zone 1 — 아시아",
    countries: "일본 · 중국 · 대만 · 홍콩",
    rows: [
      { w: "500g",  ems: "14,000", kpkt: "5,000" },
      { w: "1kg",   ems: "17,500", kpkt: "12,000" },
      { w: "2kg",   ems: "21,000", kpkt: "22,000" },
      { w: "5kg",   ems: "31,500", kpkt: "—" },
      { w: "10kg",  ems: "49,000", kpkt: "—" },
      { w: "20kg",  ems: "84,000", kpkt: "—" },
      { w: "30kg",  ems: "119,000",kpkt: "—" },
    ],
  },
  {
    label: "Zone 2 — 미주·유럽·오세아니아",
    countries: "미국 · 캐나다 · 호주 · 영국 · 독일",
    rows: [
      { w: "500g",  ems: "22,000", kpkt: "5,000" },
      { w: "1kg",   ems: "27,500", kpkt: "12,000" },
      { w: "2kg",   ems: "33,000", kpkt: "22,000" },
      { w: "5kg",   ems: "49,500", kpkt: "—" },
      { w: "10kg",  ems: "77,000", kpkt: "—" },
      { w: "20kg",  ems: "132,000",kpkt: "—" },
      { w: "30kg",  ems: "187,000",kpkt: "—" },
    ],
  },
];

export default function SidebarRateTable() {
  return (
    <div className="sticky top-4 w-72 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 flex items-center gap-2">
        <Info size={15} className="text-white" />
        <span className="text-white font-semibold text-sm">요금 참고표</span>
        <span className="ml-auto text-white/60 text-xs">EMS · K-Packet</span>
      </div>

      <div className="p-4 space-y-4">
        {ZONES.map((zone) => (
          <div key={zone.label}>
            <p className="text-[11px] font-bold text-gray-700 mb-0.5">{zone.label}</p>
            <p className="text-[10px] text-gray-400 mb-2">{zone.countries}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1 font-medium">중량</th>
                  <th className="text-right pb-1 font-medium">EMS</th>
                  <th className="text-right pb-1 font-medium">K-Packet</th>
                </tr>
              </thead>
              <tbody>
                {zone.rows.map((r) => (
                  <tr key={r.w} className="border-b border-gray-50 last:border-0">
                    <td className="py-1 text-gray-600">{r.w}</td>
                    <td className="py-1 text-right text-gray-900 font-medium">{r.ems}</td>
                    <td className="py-1 text-right text-blue-600 font-medium">{r.kpkt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
          <p className="text-[10px] text-amber-700 font-semibold mb-1">📌 참고사항</p>
          <ul className="text-[10px] text-amber-600 space-y-0.5 list-disc list-inside">
            <li>실제 요금은 우체국 계약 요금 기준</li>
            <li>부피중량 적용 시 달라질 수 있음</li>
            <li>EMS 프리미엄은 기본 EMS 대비 약 15% 할증</li>
            <li>K-Packet 최대 2kg</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
