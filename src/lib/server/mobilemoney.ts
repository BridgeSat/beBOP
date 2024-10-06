import { runtimeConfig } from './runtime-config';
export const isMobileMoneyEnabled = () =>
	!!runtimeConfig.flexpay.api_key && !!runtimeConfig.flexpay.merchand_code;