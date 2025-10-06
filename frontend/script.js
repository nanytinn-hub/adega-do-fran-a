const productInput = document.getElementById("product_name");
const quantityInput = document.getElementById("quantity");
const priceInput = document.getElementById("price");
const clientInput = document.getElementById("client_name");
const pixBtn = document.getElementById("pixBtn");
const pixContainer = document.getElementById("pixContainer");
const loadReportBtn = document.getElementById("loadReportBtn");
const salesTableBody = document.querySelector("#salesTable tbody");

const BACKEND_URL = window.location.hostname.includes("ngrok") ? window.location.origin : "http://localhost:3000";

// =========================
// Gerar Pix e salvar pedido aprovado
// =========================
pixBtn.onclick = async () => {
  const product_name = productInput.value.trim();
  const quantity = Number(quantityInput.value);
  const price = Number(priceInput.value);
  const client_name = clientInput.value.trim();

  if (!product_name || !quantity || !price || !client_name) {
    return alert("Todos os campos são obrigatórios!");
  }

  const transaction_amount = quantity * price;
  const payer = {
    email: client_name.replace(/\s+/g,'').toLowerCase()+'@example.com',
    first_name: client_name,
    last_name: ""
  };

  try {
    const r = await fetch(`${BACKEND_URL}/process_pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_amount, payer })
    });
    const data = await r.json();
    if (!data.qr_code_base64) return alert("Erro ao gerar Pix.");

    pixContainer.innerHTML = `
      <h3>📱 Pague com Pix</h3>
      <img src="data:image/png;base64,${data.qr_code_base64}" />
      <p><strong>Código copia e cola:</strong></p>
      <textarea readonly>${data.qr_code}</textarea>
    `;

    const checkStatus = async () => {
      const resp = await fetch(`${BACKEND_URL}/payment_status/${data.id}`);
      const status = await resp.json();

      if (status.status === "approved") {
        await fetch(`${BACKEND_URL}/save_order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "Data/Hora": new Date().toLocaleString(),
            "Produto": product_name,
            "Quantidade": quantity,
            "Valor Total": transaction_amount.toFixed(2),
            "Nome Cliente": client_name,
            "Status": "approved"
          })
        });
        alert("✅ Venda concluída! Pedido salvo.");
        productInput.value = quantityInput.value = priceInput.value = clientInput.value = "";
        pixContainer.innerHTML = "";
      } else if (status.status === "rejected") {
        alert("❌ Pagamento rejeitado.");
      } else {
        setTimeout(checkStatus, 3000);
      }
    };
    checkStatus();

  } catch (err) {
    console.error(err);
    alert("Erro ao gerar Pix.");
  }
};

// =========================
// Carregar relatório do CSV
// =========================
loadReportBtn.onclick = async () => {
  try {
    const resp = await fetch(`${BACKEND_URL}/admin/orders/csv`);
    const text = await resp.text();

    // Quebra linhas e remove o cabeçalho
    const lines = text.trim().split("\n").slice(1);
    salesTableBody.innerHTML = "";

    if (lines.length === 0) {
      salesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nenhuma venda registrada.</td></tr>`;
      return;
    }

    lines.forEach(line => {
      // Divide corretamente os campos entre aspas mesmo com espaços
      const values = line.split('","').map(v => v.replace(/^"|"$/g, ""));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${values[0]}</td>
        <td>${values[1]}</td>
        <td>${values[2]}</td>
        <td>R$ ${values[3]}</td>
        <td>${values[4]}</td>
        <td>${values[5]}</td>
      `;
      salesTableBody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    salesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Erro ao carregar vendas.</td></tr>`;
  }
};
