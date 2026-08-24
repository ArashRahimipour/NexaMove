import { prisma } from "@/lib/prisma";

// Get-or-create the singleton settings row so callers never have to null-check.
export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}
