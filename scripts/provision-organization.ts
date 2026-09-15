import { organizationProvisioningSchema } from "../modules/provisioning/schema";
import { provisionOrganization } from "../modules/provisioning/service";
import { db } from "../lib/db";

async function main() {
  const parsed = organizationProvisioningSchema.safeParse({
    organizationName: process.env.PROVISION_ORG_NAME,
    organizationSlug: process.env.PROVISION_ORG_SLUG,
    ownerName: process.env.PROVISION_OWNER_NAME,
    ownerEmail: process.env.PROVISION_OWNER_EMAIL,
    ownerPassword: process.env.PROVISION_OWNER_PASSWORD,
  });

  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error(
      "Defina PROVISION_ORG_NAME, PROVISION_ORG_SLUG, PROVISION_OWNER_NAME, PROVISION_OWNER_EMAIL e PROVISION_OWNER_PASSWORD.",
    );
  }

  const result = await provisionOrganization(parsed.data);
  console.log(
    JSON.stringify(
      {
        organization: result.organization,
        owner: result.owner,
        membership: result.membership,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
