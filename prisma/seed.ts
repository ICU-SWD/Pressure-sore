import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/lib/pin";
import { DEFAULT_ITEMS, DEFAULT_RULES, DEFAULT_TEMPLATE_NAME } from "../src/lib/checklist";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { id: "seed-admin" },
    update: {},
    create: {
      id: "seed-admin",
      name: "หัวหน้าพยาบาล (Admin)",
      role: "ADMIN",
      pinHash: hashPin("0000"),
    },
  });

  const nurseNames = ["พยาบาลสมศรี", "พยาบาลอรทัย", "พยาบาลวิภา"];
  const nurses = [];
  for (let i = 0; i < nurseNames.length; i++) {
    const nurse = await prisma.user.upsert({
      where: { id: `seed-nurse-${i + 1}` },
      update: {},
      create: {
        id: `seed-nurse-${i + 1}`,
        name: nurseNames[i],
        role: "NURSE",
        pinHash: hashPin("1234"),
      },
    });
    nurses.push(nurse);
  }

  const template = await prisma.checklistTemplate.upsert({
    where: { id: "seed-template-1" },
    update: {},
    create: {
      id: "seed-template-1",
      name: DEFAULT_TEMPLATE_NAME,
      itemsJson: JSON.stringify(DEFAULT_ITEMS),
      rulesJson: JSON.stringify(DEFAULT_RULES),
      isActive: true,
    },
  });

  const bedDefs = [
    { code: "ICU-01", label: "เตียง 1", ward: "ICU", patientName: "นายทดสอบ หนึ่ง", patientHn: "HN00001" },
    { code: "ICU-02", label: "เตียง 2", ward: "ICU", patientName: "นางทดสอบ สอง", patientHn: "HN00002" },
    { code: "ICU-03", label: "เตียง 3", ward: "ICU", patientName: "นายทดสอบ สาม", patientHn: "HN00003" },
    { code: "ICU-04", label: "เตียง 4", ward: "ICU", patientName: null, patientHn: null },
    { code: "ICU-05", label: "เตียง 5", ward: "ICU", patientName: null, patientHn: null },
    { code: "ICU-06", label: "เตียง 6", ward: "ICU", patientName: null, patientHn: null },
  ];

  for (const bed of bedDefs) {
    await prisma.bed.upsert({
      where: { code: bed.code },
      update: {},
      create: bed,
    });
  }

  console.log("Seeded:", { admin: admin.name, nurses: nurses.map((n) => n.name), template: template.name });
  console.log("Login PINs -> admin: 0000, nurses: 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
