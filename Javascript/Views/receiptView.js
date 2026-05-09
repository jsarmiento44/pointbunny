import View from "./view.js";

class ReceiptView extends View {
  _generateReceiptHTML(sale) {
    const date = new Date(sale.date);
    const dateStr = date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const activeAdj = (sale.adjustments ?? []).filter(
      (a) => !a.removed && a.computedAmount !== undefined,
    );
    const removedAdj = sale.showRemovedAdjustments
      ? (sale.removedAdjustments ?? [])
      : [];

    const storeName = sale.storeName?.includes("@")
      ? "POINTY POS"
      : (sale.storeName ?? "POINTY POS");

    const itemsHtml = sale.items
      .map((item) => {
        const variants =
          item.selectedVariants?.map((v) => v.variantName).join(", ") ?? "";
        return `
        <tr>
          <td style="padding:2px 4px 2px 0;vertical-align:top;">${item.itemName} x${item.quantity}</td>
          <td style="padding:2px 0;text-align:right;vertical-align:top;white-space:nowrap;">$${Number(item.totalPrice).toFixed(2)}</td>
        </tr>
        ${variants ? `<tr><td colspan="2" style="font-size:10px;color:#555;padding:0 0 4px 0;">${variants}</td></tr>` : ""}
      `;
      })
      .join("");

    const hasAdj = activeAdj.length > 0 || removedAdj.length > 0;
    const adjSection = hasAdj
      ? `
      <hr class="divider">
      <table>
        <tr>
          <td style="padding:2px 4px 2px 0;font-size:11px;">Subtotal</td>
          <td style="text-align:right;font-size:11px;">$${Number(sale.subtotal ?? sale.totalPrice).toFixed(2)}</td>
        </tr>
        ${activeAdj
          .map(
            (adj) => `
          <tr>
            <td style="padding:1px 4px 1px 0;font-size:11px;">${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""}</td>
            <td style="text-align:right;font-size:11px;">${adj.computedAmount >= 0 ? "+" : ""}$${Number(adj.computedAmount).toFixed(2)}</td>
          </tr>
        `,
          )
          .join("")}
        ${removedAdj
          .map(
            (adj) => `
          <tr style="text-decoration:line-through;opacity:0.5;">
            <td style="padding:1px 4px 1px 0;font-size:11px;">${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""} (removed)</td>
            <td style="text-align:right;font-size:11px;">--</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:12px; width:80mm; padding:6mm 4mm; color:#000; }
  table { width:100%; border-collapse:collapse; }
  .center { text-align:center; }
  .divider { border:none; border-top:1px dashed #000; margin:6px 0; }
  .brand { font-size:15px; font-weight:bold; letter-spacing:1px; }
  @media print { body { width:80mm; } @page { size:80mm auto; margin:0; } }
</style>
<script>
  window.addEventListener('afterprint', function() {
    if (window.opener) window.opener.postMessage('pointy-afterprint', '*');
    setTimeout(function() { window.close(); }, 150);
  });
</script>
</head>
<body>
  <div class="center brand">${storeName}</div>
  <div class="center" style="margin:2px 0 2px;font-size:11px;">${dateStr} &nbsp; ${timeStr}</div>
  ${sale.cashierName ? `<div class="center" style="font-size:10px;color:#555;margin:0 0 4px;">Cashier: ${sale.cashierName}</div>` : ''}
  <hr class="divider">

  <table>${itemsHtml}</table>

  ${adjSection}

  <hr class="divider">
  <table>
    <tr>
      <td style="font-weight:bold;font-size:13px;padding:3px 4px 3px 0;">TOTAL</td>
      <td style="font-weight:bold;font-size:13px;text-align:right;">$${Number(sale.totalPrice).toFixed(2)}</td>
    </tr>
    <tr>
      <td style="font-size:11px;padding:3px 4px 2px 0;">Cash Tendered</td>
      <td style="font-size:11px;text-align:right;">$${Number(sale.customerPayment).toFixed(2)}</td>
    </tr>
    <tr>
      <td style="font-size:11px;font-weight:bold;padding:2px 4px 2px 0;">Change</td>
      <td style="font-size:11px;font-weight:bold;text-align:right;">$${Number(sale.customerChange).toFixed(2)}</td>
    </tr>
  </table>
  <hr class="divider">
  <div class="center" style="font-size:10px;color:#555;margin-top:4px;">
    <p>Thank you for your purchase!</p>
    <p style="margin-top:2px;">Powered by Pointy POS</p>
  </div>
</body>
</html>`;
  }

  print(sale) {
    const html = this._generateReceiptHTML(sale);
    const win = window.open(
      "",
      "_blank",
      "width=380,height=600,scrollbars=no,toolbar=no,menubar=no,location=no",
    );
    if (!win) return null;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);

    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data === "pointy-afterprint") {
          window.removeEventListener("message", handler);
          resolve();
        }
      };
      window.addEventListener("message", handler);
    });
  }

}

export default new ReceiptView();
