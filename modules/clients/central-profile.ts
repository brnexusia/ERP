import { assertPermission } from "@/lib/auth/permissions";
import {
  ClientNotFoundError,
  getClient,
  type ClientAccessContext,
} from "@/modules/clients/service";
import {
  getClientCredit,
  getClientVale,
} from "@/modules/client-management/service";
import { getClientCommercialProfile } from "@/modules/reports/service";
import { getClientPaymentHistory } from "@/modules/reports/payment-history";
import { listClientSupportRecords } from "@/modules/customer-service/service";

export async function getClientCentralProfile(
  context: ClientAccessContext,
  clientId: string,
) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const client = await getClient(context, clientId);
  if (!client) throw new ClientNotFoundError();

  const [credit, vale, commercialProfile, paymentHistory, support] = await Promise.all([
    getClientCredit(context, clientId),
    getClientVale(context, clientId),
    getClientCommercialProfile(context, clientId),
    getClientPaymentHistory(context, clientId),
    listClientSupportRecords(context, clientId),
  ]);

  return {
    client,
    commercial: commercialProfile.commercial,
    purchases: commercialProfile.purchases,
    financial: {
      credit,
      vale,
      paymentHistory,
    },
    relationship: commercialProfile.relationship,
    support,
  };
}
