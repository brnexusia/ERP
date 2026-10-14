import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { SaleNotFoundError, SaleRuleError } from "@/modules/sales/service";
import { buildPackingSlipPdf } from "@/modules/sales/packing-slip-pdf";

function formatAddress(address: {
  street: string; number: string; complement: string | null;
  district: string; city: string; state: string; postalCode: string;
} | null) {
  if (!address) return "Endereço não informado";
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(" - "),
    "CEP " + address.postalCode,
  ].filter(Boolean).join(" | ");
}

export async function createSalePackingSlip(
  context: ClientAccessContext,
  saleId: string,
) {
  assertPermission(context.role, "sales:read");
  const sale = await db.sale.findFirst({
    where: { id: saleId, organizationId: context.organizationId },
    select: {
      id: true, stage: true, orderedAt: true, createdAt: true,
      organization: { select: { name: true } },
      client: {
        select: { name: true, address: {
          select: {
            street: true, number: true, complement: true,
            district: true, city: true, state: true, postalCode: true,
          },
        } },
      },
      seller: { select: { user: { select: { name: true } } } },
      fulfillment: {
        select: {
          status: true,
          separatedBy: { select: { name: true } },
          verifiedBy: { select: { name: true } },
        },
      },
      items: {
        select: { sku: true, productName: true, quantity: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!sale) throw new SaleNotFoundError();
  if (sale.stage === "QUOTE") {
    throw new SaleRuleError("Romaneio disponível somente após confirmação do pedido.");
  }
  const status = sale.fulfillment?.status === "VERIFIED" ? "VERIFIED"
    : sale.fulfillment ? "SEPARATED" : "NOT_SEPARATED";
  return buildPackingSlipPdf({
    organization: sale.organization.name,
    saleId: sale.id,
    orderedAt: sale.orderedAt,
    createdAt: sale.createdAt,
    client: sale.client.name,
    seller: sale.seller.user.name,
    address: formatAddress(sale.client.address),
    status,
    separatedBy: sale.fulfillment?.separatedBy.name,
    verifiedBy: sale.fulfillment?.verifiedBy?.name,
    items: sale.items.map((item) => ({
      sku: item.sku,
      description: item.productName,
      quantity: item.quantity.toString(),
    })),
  });
}
