import Link from "next/link";

const tabs = [
  { key: "beds", href: "/admin/beds", label: "เตียง & QR Code" },
  { key: "checklist", href: "/admin/checklist", label: "แบบประเมิน" },
  { key: "nurses", href: "/admin/nurses", label: "บัญชีผู้ใช้งาน" },
];

export default function AdminTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-t-lg px-3 py-2 text-sm ${
            active === t.key ? "border-b-2 border-brand-500 font-medium text-brand-700" : "text-slate-500"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
