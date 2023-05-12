import { readFileSync } from 'node:fs';
// We use undici instead of native fetch to be able to accept self-signed certificates
import { Agent, fetch } from 'undici';
import { LND_MACAROON_PATH, LND_MACAROON_VALUE, LND_REST_URL } from '$env/static/private';
import { z } from 'zod';
import { error } from '@sveltejs/kit';

if (LND_MACAROON_PATH && LND_MACAROON_VALUE) {
	throw new Error('Cannot specify both LND_MACAROON_PATH and LND_MACAROON_VALUE');
}

const macaroon = LND_MACAROON_PATH
	? readFileSync(LND_MACAROON_PATH).toString('hex')
	: LND_MACAROON_VALUE;

const url = new URL(LND_REST_URL);

// For https://localhost or https://127.0.0.1, we need to disable TLS verification
const dispatcher =
	url.protocol === 'https:' &&
	(url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
		? new Agent({
				connect: {
					rejectUnauthorized: false
				}
		  })
		: undefined;

function lndRpc(
	path: string,
	options: { method?: string; headers?: Record<string, string>; body?: string } = {}
) {
	return fetch(`${LND_REST_URL}${path}`, {
		headers: {
			...options.headers,
			...(macaroon && { 'Grpc-Metadata-macaroon': macaroon })
		},
		method: options.method || 'GET',
		...(dispatcher && { dispatcher }),
		...(options?.body && { body: options.body })
	});
}

export async function lndListChannels() {
	const response = await lndRpc('/v1/channels');

	if (!response.ok) {
		throw error(500, 'Could not list channels');
	}

	const json = await response.json();
	return z
		.object({
			channels: z.array(
				z.object({
					capacity: z.number({ coerce: true }).int(),
					chan_id: z.number({ coerce: true }).int(),
					local_balance: z.number({ coerce: true }).int(),
					remote_balance: z.number({ coerce: true }).int()
				})
			)
		})
		.parse(json).channels;
}

export async function lndWalletBalance() {
	const response = await lndRpc('/v1/balance/blockchain');

	if (!response.ok) {
		throw error(500, 'Could not get lnd wallet balance');
	}

	const json = await response.json();
	return z
		.object({
			total_balance: z.number({ coerce: true }).int(),
			confirmed_balance: z.number({ coerce: true }).int()
		})
		.parse(json).total_balance;
}
export async function lndGetInfo() {
	const response = await lndRpc('/v1/getinfo');

	if (!response.ok) {
		throw error(500, 'Could not get lnd info');
	}

	const json = await response.json();

	return z
		.object({
			alias: z.string(),
			testnet: z.boolean(),
			num_peers: z.number().int(),
			num_pending_channels: z.number().int(),
			num_active_channels: z.number().int(),
			num_inactive_channels: z.number().int(),
			synced_to_chain: z.boolean(),
			synced_to_graph: z.boolean()
		})
		.parse(json);
}

export async function lndChannelsBalance() {
	const response = await lndRpc('/v1/balance/channels');

	if (!response.ok) {
		throw error(500, 'Could not get lnd channels balance');
	}

	const json = await response.json();
	return z.object({ balance: z.number({ coerce: true }).int() }).parse(json).balance;
}

export async function lndAutopilotActive() {
	const response = await lndRpc('/v2/autopilot/status');

	if (!response.ok) {
		throw error(500, 'Could not get lnd autopilot status');
	}

	const json = await response.json();
	return z.object({ active: z.boolean() }).parse(json).active;
}

export async function lndActivateAutopilot() {
	const response = await lndRpc('/v2/autopilot/modify', {
		method: 'POST',
		body: JSON.stringify({ enable: true })
	});

	if (!response.ok) {
		throw error(500, 'Could not activate lnd autopilot');
	}
}
