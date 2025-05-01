const { UpApi } = require("up-bank-api");
const { createHmac } = require("crypto");
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const api = require('@actual-app/api');

const app = new Koa();

require('dotenv').config();

const apiKey = process.env.UP_BANK_ACCESS_TOKEN;
if (!apiKey) {
  throw new Error("UP_BANK_ACCESS_TOKEN is not set or is empty.");
}
const up = new UpApi();
up.updateApiKey(apiKey);

app.use(bodyParser());

async function transactionCreated(t) {
  try {
    console.log("Creating transaction");
    const upTransaction = (await up.transactions.retrieve(t.data.id)).data;
    console.log(`Up Transaction: ${JSON.stringify(upTransaction)}`);
    // Initialize Actual Budget API
    await api.init({
      dataDir: '/tmp',
      serverURL: process.env.ACTUAL_BUDGET_SERVER_URL,
      password: process.env.ACTUAL_BUDGET_PASSWORD
    });

    const budgetId = process.env.ACTUAL_BUDGET_ID;
    const encryptionPass = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
    if (!encryptionPass) {
      await api.downloadBudget(budgetId);
    } else {
      await api.downloadBudget(budgetId, {
        password: encryptionPass,
      });
    }

    // Fetch Actual Budget accounts
    const actualAccounts = await api.getAccounts();

    // Parse account mapping from environment variable (if exists)
    const accountMapping = JSON.parse(process.env.UP_ACCOUNT_MAPPING || '{}');

    // Get the Up account ID and name
    const upAccountId = upTransaction.relationships.account.data.id;
    const upAccountName = upTransaction.relationships.account.data.id; // Replace with actual account name if available

    // Map to Actual Budget account
    let actualBudgetAccountId = accountMapping[upAccountId];
    if (!actualBudgetAccountId) {
      const matchedAccount = actualAccounts.find(a =>
        a.name.toLowerCase() === upAccountName.toLowerCase()
      );
      if (matchedAccount) {
        actualBudgetAccountId = matchedAccount.id;
      }
    }

    if (!actualBudgetAccountId) {
      console.warn(`No account mapping found for Up Account: ${upAccountName} (ID: ${upAccountId})`);
      console.log('Available Actual Budget Accounts:',
        actualAccounts.map(a => `${a.name} (ID: ${a.id})`).join(', '));
      return; // Skip if no mapping found
    }

    // Format the transaction
    const roundUpAmount = upTransaction.attributes.roundUp ? upTransaction.attributes.roundUp.amount.value : 0;
    const formattedTransaction = {
      account: actualBudgetAccountId,
      date: new Date(upTransaction.attributes.settledAt || upTransaction.attributes.createdAt).toISOString().split('T')[0],
      amount: Math.round(upTransaction.attributes.amount.value * 100),
      payee_name: upTransaction.attributes.description || 'Unknown',
      imported_id: upTransaction.id,
    };

    const transactionsToUpload = [formattedTransaction];

    if (roundUpAmount !== 0) {
      const roundUpTransaction = {
        account: actualBudgetAccountId, // Round-up destination account
        date: formattedTransaction.date,
        amount: -Math.round(Math.abs(roundUpAmount) * 100),
        payee_name: "Round Up Transfer",
      };
      transactionsToUpload.push(roundUpTransaction);
    }

    // Upload the transaction
    try {
      const result = await api.importTransactions(actualBudgetAccountId, transactionsToUpload);
      console.log(`Uploaded ${transactionsToUpload.length} transaction(s) for ${upAccountName}`);
    } catch (importError) {
      console.error(`Error importing transaction for ${upAccountName}:`, importError);
    }
  } catch (error) {
    console.error('Error in transactionCreated:', error);
  } finally {
    await api.shutdown();
  }
}

async function transactionUpdated(t) {
  try {
    console.log("Updating transaction");

    // Retrieve the transaction details from Up API
    const upTransaction = (await up.transactions.retrieve(t.data.id)).data;
    console.log(`Up Transaction: ${JSON.stringify(upTransaction)}`);

    // Initialize Actual Budget API
    await api.init({
      dataDir: '/tmp',
      serverURL: process.env.ACTUAL_BUDGET_SERVER_URL,
      password: process.env.ACTUAL_BUDGET_PASSWORD,
    });

    const budgetId = process.env.ACTUAL_BUDGET_ID;
    const encryptionPass = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
    if (!encryptionPass) {
      await api.downloadBudget(budgetId);
    } else {
      await api.downloadBudget(budgetId, {
        password: encryptionPass,
      });
    }

    // Fetch Actual Budget accounts
    const actualAccounts = await api.getAccounts();

    // Parse account mapping from environment variable (if exists)
    const accountMapping = JSON.parse(process.env.UP_ACCOUNT_MAPPING || '{}');

    // Get the Up account ID and name
    const upAccountId = upTransaction.relationships.account.data.id;
    const upAccountName = upTransaction.relationships.account.data.id; // Replace with actual account name if available

    // Map to Actual Budget account
    let actualBudgetAccountId = accountMapping[upAccountId];
    if (!actualBudgetAccountId) {
      const matchedAccount = actualAccounts.find(a =>
        a.name.toLowerCase() === upAccountName.toLowerCase()
      );
      if (matchedAccount) {
        actualBudgetAccountId = matchedAccount.id;
      }
    }

    if (!actualBudgetAccountId) {
      console.warn(`No account mapping found for Up Account: ${upAccountName} (ID: ${upAccountId})`);
      console.log('Available Actual Budget Accounts:',
        actualAccounts.map(a => `${a.name} (ID: ${a.id})`).join(', '));
      return; // Skip if no mapping found
    }

    // Format the transaction update fields
    const updateFields = {
      date: new Date(upTransaction.attributes.settledAt || upTransaction.attributes.createdAt).toISOString().split('T')[0],
      amount: Math.round(upTransaction.attributes.amount.value * 100),
      payee_name: upTransaction.attributes.description || 'Unknown',
      notes: upTransaction.attributes.note || '',
      cleared: upTransaction.attributes.status === "SETTLED",
    };

    // Update the transaction in Actual Budget
    try {
      await api.updateTransaction(upTransaction.id, updateFields);
      console.log(`Updated transaction ${upTransaction.id} for ${upAccountName}`);
    } catch (updateError) {
      console.error(`Error updating transaction for ${upAccountName}:`, updateError);
    }
  } catch (error) {
    console.error('Error in transactionUpdated:', error);
  } finally {
    await api.shutdown();
  }
}

app.use(async (ctx) => {
  const body = ctx.request.rawBody || "";
  const headers = Object.entries(ctx.header).reduce((acc, [key, val]) => ({ ...acc, [key.toLowerCase()]: val }), {});
  const buildSignature = (body) => createHmac("sha256", process.env.UP_BANK_ACCESS_TOKEN || "").update(body).digest("hex");

  console.log(`Webhook: ${body}`);

  const parsedBody = JSON.parse(body);

  if (!parsedBody.data || parsedBody.data.type !== "webhook-events") {
    ctx.status = 200;
  }

  const webhookEventData = parsedBody.data;

  if (webhookEventData.attributes.eventType === "TRANSACTION_CREATED") {
    await transactionCreated(webhookEventData.relationships.transaction);
  } else if (webhookEventData.attributes.eventType === "TRANSACTION_SETTLED") {
    await transactionUpdated(webhookEventData.relationships.transaction);
  } else if (webhookEventData.attributes.eventType === "TRANSACTION_DELETED") {
    console.log("Transaction deleted");
  } else {
    console.log("Skipping");
  }

  ctx.status = 200;
  
});

app.on("error", console.error);

module.exports = app;
