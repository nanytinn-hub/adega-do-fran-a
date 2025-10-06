import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mercadopagoPkg from "mercadopago";

dotenv.config();

const mercadopago = mercadopagoPkg.default || mercadopagoPkg;

const app = express();
app.use(cors());
app.use(bodyParser.json());

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
// Checkout Pix
// =========================
app.post("/process_pix", async (req, res) => {
  try {
    const { transaction_amount, payer } = req.body;

    // Cria pagamento diretamente passando access_token no body
    const payment = await mercadopago.payment.create({
      transaction_amount: Number(transaction_amount),
      description: "Compra na Adega Douglas França",
      payment_method_id: "pix",
      payer: {
        email: payer.email || "",
        first_name: payer.first_name,
        last_name: payer.last_name || ""
      },
      access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
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
