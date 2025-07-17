interface Env {
	RESEND_API_KEY: string;
	PRIMARY_RECIPIENT: string;
	FROM_ADDRESS: string;
	BCC_RECIPIENTS?: string;
}

const ALLOWED_ORIGINS = [
	'https://jrhof-webapp.pages.dev',
	'https://www.jrhof.org',
	'https://jrhof.org',
];

function buildCorsHeaders(req: Request, origin: string | null): Headers {
	const hdrs = new Headers();
	const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://jrhof.org';
	hdrs.set('Access-Control-Allow-Origin', allowed);
	hdrs.set('Vary', 'Origin');
	hdrs.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

	// Reflect what the browser asked for, default to Content-Type
	const reqHeaders = req.headers.get('Access-Control-Request-Headers');
	hdrs.set('Access-Control-Allow-Headers', reqHeaders || 'Content-Type');

	// Cache preflight for a day
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
		.map(s => s.trim())
		.filter(Boolean);
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

		let body: any;
		try {
			body = await request.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
				status: 400,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		const name = (body?.name ?? '').trim();
		const email = (body?.email ?? '').trim();
		const message = (body?.message ?? '').trim();

		if (!name || !email || !message) {
			return new Response(JSON.stringify({ error: 'Missing name, email, or message' }), {
				status: 400,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}

		if (message.length > 5000) {
			return new Response(JSON.stringify({ error: 'Message too long' }), {
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
			from: env.FROM_ADDRESS,
			to: env.PRIMARY_RECIPIENT,
			bcc: parseBCC(env.BCC_RECIPIENTS),
			reply_to: email,
			subject: `📬 New JRHOF Contact Form Submission from ${name}`,
			html,
		};

		try {
			const resp = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.RESEND_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!resp.ok) {
				const txt = await resp.text();
				console.error('Resend API error:', resp.status, txt);
				return new Response(JSON.stringify({ error: 'Failed to send message' }), {
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
			return new Response(JSON.stringify({ error: 'Internal Error' }), {
				status: 500,
				headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
			});
		}
	},
};
