import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// Config Mercado Pago
// =========================
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const paymentClient = new Payment(client);

// =========================
// Pastas pedidos
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ordersDir = path.join(__dirname, "orders");
if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir);

const csvFile = path.join(ordersDir, "orders.csv");
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, `"Data/Hora","Produto","Quantidade","Valor Total","Nome Cliente","Status"\n`);
}

// =========================
// Função para salvar no CSV
// =========================
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
// Checkout Pix
// =========================
app.post("/process_pix", async (req, res) => {
  try {
    const { transaction_amount, payer, items } = req.body;
    const payerData = { email: payer.email || "", first_name: payer.first_name, last_name: payer.last_name || "" };
    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(transaction_amount),
        description: "Compra na Adega Douglas França",
        payment_method_id: "pix",
        payer: payerData
      }
    });
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
// Consultar status pagamento
// =========================
app.get("/payment_status/:id", async (req, res) => {
  try {
    const payment = await paymentClient.get({ id: req.params.id });
    res.json({ status: payment.status });
  } catch (err) {
    console.error("Erro status:", err);
    res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// =========================
// Relatório CSV
// =========================
app.get("/admin/orders/csv", (req, res) => res.sendFile(csvFile));

// =========================
// Frontend
// =========================
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

// =========================
// Iniciar servidor
// =========================
app.listen(3000, () => console.log("✅ Backend Pix rodando em http://localhost:3000"));
