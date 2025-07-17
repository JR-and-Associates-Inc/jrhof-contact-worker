# JRHOF Contact Form Worker

This Cloudflare Worker handles **contact form submissions** for the JRHOF website and sends emails using [Resend](https://resend.com/).

---

## 🚀 Features
- Secure, serverless email handler for JRHOF's contact form
- Uses **Resend API** for reliable email delivery
- Built with **TypeScript** and deployed on **Cloudflare Workers**
- Environment variables for sensitive data (no secrets in code)
- Designed for GitHub → Cloudflare automatic CI/CD

---

## 📂 Project Structure
```

jrhof-contact-worker/
├── src/
│   └── index.ts         # Main Worker code
├── wrangler.toml        # Cloudflare configuration
├── package.json
├── tsconfig.json
└── README.md

````

---

## ⚙️ Setup

### 1. Clone the Repo
```bash
git clone https://github.com/JR-and-Associates-Inc/jrhof-contact-worker.git
cd jrhof-contact-worker
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Wrangler

Update `wrangler.toml` with your Cloudflare account details.
Set environment variables in Cloudflare Dashboard:

* `RESEND_API_KEY` – Your Resend API key
* `PRIMARY_RECIPIENT` – Main contact email (e.g., `contact@jrhof.org`)
* `BCC_RECIPIENTS` – Comma-separated list of BCC emails
* `FROM_ADDRESS` – The email address shown as the sender

### 4. Local Development

```bash
npx wrangler dev
```

Test with:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"name":"TJ","email":"tj@example.com","message":"Hello from local!"}'
```

### 5. Deployment

Push to `main` → Cloudflare automatically builds and deploys.

---

## ✅ Environment Variables

Set these in Cloudflare **Workers** → **Settings → Variables**:

```
RESEND_API_KEY
PRIMARY_RECIPIENT
BCC_RECIPIENTS
FROM_ADDRESS
```

---

## 🛡 License

This project is licensed under the **MIT License** – see [LICENSE](./LICENSE) for details.

