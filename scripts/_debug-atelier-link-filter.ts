import { prisma } from "../lib/prisma";
import { filterCoursesForSecondaryClass } from "../lib/atelier-course-link-shared";
import { getAtelierLinkOptionsForOrganization } from "../lib/atelier-course-link";

async function main() {
  const atelier = await prisma.branch.findFirst({
    where: { typebranch: "ATELIER", isActive: true },
    select: { id: true, organizationId: true },
  });
  if (!atelier) return;

  const opts = await getAtelierLinkOptionsForOrganization({
    organizationId: atelier.organizationId,
    atelierBranchId: atelier.id,
  });

  console.log("courses", opts.courses.length, "classes", opts.classes.length);

  const withCurriculum = opts.classes.filter((c) => c.configuredCoursIds.length);
  const without = opts.classes.filter((c) => !c.configuredCoursIds.length);
  console.log("with curriculum", withCurriculum.length, "without", without.length);

  const sampleConfigured = withCurriculum[0];
  if (sampleConfigured) {
    const filtered = filterCoursesForSecondaryClass(opts.courses, sampleConfigured);
    console.log(
      "configured class",
      sampleConfigured.label,
      "→",
      filtered.length,
      "courses",
    );
  }

  const sampleFallback = without[0];
  if (sampleFallback) {
    const filtered = filterCoursesForSecondaryClass(opts.courses, sampleFallback);
    console.log(
      "fallback class",
      sampleFallback.label,
      "→",
      filtered.length,
      "courses",
    );
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
