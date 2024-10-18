import { collections } from '$lib/server/database.js';
import { runtimeConfig } from '$lib/server/runtime-config';
import { CURRENCIES, type Currency } from '$lib/types/Currency.js';
import { z } from 'zod';

export async function load() {
	return {
		sumUp: runtimeConfig.sumUp
	};
}

export const actions = {
	save: async function ({ request }) {
		const flexpay = z
			.object({
				apiKey: z.string(),
				currency: z.enum(
					CURRENCIES.filter((c) => c !== 'BTC' && c !== 'SAT') as [Currency, ...Currency[]]
				),
				merchantCode: z.string().min(1)
			})
			.parse(Object.fromEntries(await request.formData()));

		await collections.runtimeConfig.updateOne(
			{
				_id: 'flexpay'
			},
			{
				$set: {
					data: flexpay,
					updatedAt: new Date()
				}
			},
			{
				upsert: true
			}
		);

		runtimeConfig.flexpay = flexpay;
	},
	delete: async function () {
		await collections.runtimeConfig.deleteOne({
			_id: 'flexpay'
		});

		runtimeConfig.sumUp = {
			apiKey: '',
			merchantCode: '',
			currency: 'EUR'
		};
	}
};
