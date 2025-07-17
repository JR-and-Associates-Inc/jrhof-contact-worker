interface Env {
	RESEND_API_KEY: string;
	PRIMARY_RECIPIENT: string;
	FROM_ADDRESS: string;
	BCC_RECIPIENTS?: string;
}

const ALLOWED_ORIGINS = [
	'https://jrhof.org',
	'https://www.jrhof.org',
	'https://jrhof-webapp.pages.dev'
];

// Basic email sanity (not RFC exhaustive)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildCorsHeaders(req: Request, origin: string | null): Headers {
	const hdrs = new Headers();
	const allowed = origin && ALLOWED_ORIGINS.includes(origin)
		? origin
		: 'https://jrhof.org'; // fallback to prod; change to pages.dev if you prefer
	hdrs.set('Access-Control-Allow-Origin', allowed);
	hdrs.set('Vary', 'Origin');
	hdrs.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

	const reqHeaders = req.headers.get('Access-Control-Request-Headers');
	hdrs.set('Access-Control-Allow-Headers', reqHeaders || 'Content-Type');
	hdrs.set('Access-Control-Max-Age', '86400');
	return hdrs;
}

function esc(str: unknown): string {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function parseBCC(csv?: string): string[] {
	return (csv || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function missingEnv(name: string): never {
	throw new Error(`Missing required env var: ${name}`);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get('Origin');
		const corsHeaders = buildCorsHeaders(request, origin);

		// --- Preflight ---
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
		}

		// --- Required env vars ---
		const FROM_ADDRESS = env.FROM_ADDRESS?.trim() || missingEnv('FROM_ADDRESS');
		const PRIMARY_RECIPIENT = env.PRIMARY_RECIPIENT?.trim() || missingEnv('PRIMARY_RECIPIENT');
		const RESEND_KEY = env.RESEND_API_KEY?.trim() || missingEnv('RESEND_API_KEY');
		const BCC_LIST = parseBCC(env.BCC_RECIPIENTS);

		// --- Parse JSON ---
		let body: any;
		try {
			body = await request.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'invalid_json' }), {
				status: 400,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		const name = (body?.name ?? '').toString().trim();
		const email = (body?.email ?? '').toString().trim();
		const message = (body?.message ?? '').toString().trim();

		if (!name || !email || !message) {
			return new Response(JSON.stringify({ error: 'Missing name, email, or message', code: 'missing_fields' }), {
				status: 400,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		if (!EMAIL_RE.test(email)) {
			return new Response(JSON.stringify({ error: 'Invalid email address', code: 'invalid_email' }), {
				status: 400,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		if (message.length > 5000) {
			return new Response(JSON.stringify({ error: 'Message too long', code: 'too_long' }), {
				status: 413,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		const html = `
      <h2>New JRHOF Contact Form Submission</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${encodeURIComponent(email)}">${esc(email)}</a></p>
      <p><strong>Message:</strong></p>
      <div style="padding:10px;border-left:4px solid #0078D7;background:#f4f4f4;white-space:pre-wrap;">${esc(message)}</div>
    `;

		const payload = {
			from: FROM_ADDRESS,           // must be verified by Resend
			to: PRIMARY_RECIPIENT,
			bcc: BCC_LIST,
			reply_to: email,
			subject: `⚾️ New JRHOF Contact Form Submission from ${name}`,
			html,
		};

		try {
			const resp = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${RESEND_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!resp.ok) {
				const txt = await resp.text();
				console.error('Resend API error:', resp.status, txt);
				return new Response(JSON.stringify({ error: 'Failed to send message', code: 'resend_error' }), {
					status: 500,
					headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		} catch (err) {
			console.error('Resend fetch error:', err);
			return new Response(JSON.stringify({ error: 'Internal Error', code: 'internal_error' }), {
				status: 500,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}
	},
};
