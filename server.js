import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mercadopago from "mercadopago";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// Configurar Mercado Pago
// =========================
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.error("❌ MERCADO_PAGO_ACCESS_TOKEN não definido no .env");
  process.exit(1);
}
mercadopago.configurations.setAccessToken(process.env.MERCADO_PAGO_ACCESS_TOKEN);

// =========================
// Pastas e CSV
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersDir = path.join(__dirname, "orders");
if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir);

const csvFile = path.join(ordersDir, "orders.csv");
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(
    csvFile,
    `"Data/Hora","Produto","Quantidade","Valor Total","Nome Cliente","Status"\n`
  );
}

// Função para salvar pedido no CSV
function saveOrderCSV(order) {
  const line = `"${order["Data/Hora"]}","${order["Produto"]}","${order["Quantidade"]}","${order["Valor Total"]}","${order["Nome Cliente"]}","${order["Status"]}"\n`;
  fs.appendFileSync(csvFile, line);
}

// =========================
// Rota para salvar pedido via frontend
// =========================
app.post("/save_order", (req, res) => {
  try {
    const order = req.body;
    if (!order || !order["Produto"] || !order["Nome Cliente"]) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    saveOrderCSV(order);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao salvar pedido:", err);
    res.status(500).json({ error: "Erro ao salvar pedido" });
  }
});

// =========================
// Gerar pagamento Pix
// =========================
app.post("/process_pix", async (req, res) => {
  try {
    const { transaction_amount, payer } = req.body;

    const paymentData = {
      transaction_amount: Number(transaction_amount),
      description: "Compra na Adega Douglas França",
      payment_method_id: "pix",
      payer: {
        email: payer.email || "",
        first_name: payer.first_name,
        last_name: payer.last_name || ""
      }
    };

    const payment = await mercadopago.payment.create(paymentData);

    const pixData = payment.point_of_interaction?.transaction_data;

    res.json({
      id: payment.id,
      status: payment.status,
      qr_code: pixData?.qr_code || null,
      qr_code_base64: pixData?.qr_code_base64 || null
    });
  } catch (err) {
    console.error("Erro Pix:", err);
    res.status(500).json({ error: "Erro ao criar Pix" });
  }
});

// =========================
// Consultar status do pagamento
// =========================
app.get("/payment_status/:id", async (req, res) => {
  try {
    const payment = await mercadopago.payment.get(req.params.id);
    res.json({ status: payment.response.status });
  } catch (err) {
    console.error("Erro status:", err);
    res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// =========================
// CSV do relatório de vendas
// =========================
app.get("/admin/orders/csv", (req, res) => res.sendFile(csvFile));

// =========================
// Servir frontend
// =========================
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
);

// =========================
// Iniciar servidor
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Backend Pix rodando em http://localhost:${PORT}`)
);
