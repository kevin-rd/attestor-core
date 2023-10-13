import type { TLSConnectionOptions } from '@reclaimprotocol/tls'
import type { ProviderClaimData, TLSReceipt } from '../proto/api'
import type { ArraySlice } from './general'

type CreateRequestResult = {
	/**
	 * Raw request to be sent
	 * If a string, it is assumed to be an
	 * ASCII encoded string. If it contains
	 * non-ASCII characters, the redactions
	 * may not work as expected
	 */
	data: Uint8Array | string
	redactions: ArraySlice[]
}

/**
 * Generic interface for a provider that can be used to verify
 * claims on a TLS receipt
 *
 * @notice "Params" are the parameters you want to claim against.
 * These would typically be found in the response body
 *
 * @notice "SecretParams" are the parameters that are used to make the API request.
 * These must be redacted in the request construction in "createRequest" & cannot be viewed by anyone
 */
export interface Provider<Params extends { [_: string]: unknown }, SecretParams> {
	/**
	 * host:port to connect to for this provider;
	 * the protocol establishes a connection to the first one
	 * when a request is received from a user.
	 *
	 * Run on witness side when creating a new session
	 *
	 * Eg. "www.google.com:443", (p) => p.url.host
	 * */
	hostPort: string | ((params: Params) => string)

	/** extra options to pass to the client like root CA certificates */
	additionalClientOptions?: TLSConnectionOptions
	/**
	 * check the parameters are valid
	 * Run client & witness side, to verify the parameters
	 * are valid
	 * */
	areValidParams(params: { [_: string]: unknown }): params is Params
	/** generate the raw request to be sent to through the TLS receipt */
	createRequest(secretParams: SecretParams, params: Params): CreateRequestResult
	/**
	 * Return the slices of the response to redact
	 * Eg. if the response is "hello my secret is xyz",
	 * and you want to redact "xyz", you would return
	 * [{start: 17, end: 20}]
	 *
	 * This is run on the client side, to selct which portions of
	 * the server response to send to the witness
	 * */
	getResponseRedactions?(response: Uint8Array, params: Params): ArraySlice[]
	/**
	 * verify a generated TLS receipt against given parameters
	 * to ensure the receipt does contain the claims the
	 * user is claiming to have
	 *
	 * This is run on the witness side.
	 * @param receipt the TLS receipt to verify
	 * @param params the parameters to verify the receipt against. Eg. `{"email": "abcd@gmail.com"}`
	 * */
	assertValidProviderReceipt(receipt: TLSReceipt, params: Params): void | Promise<void>
}

export type CreateStepSmartContract =
	| {
		name: 'creating'
		chainId: number
		claimId: number
		witnessHosts: string[]
	}
	| {
		name: 'witness-done'
		chainId: number
		claimData: ProviderClaimData
		signaturesDone: string[]
	}

export type CreateStep =
	| {
		name: 'creating'
		timestampS: number
		epoch: number
		witnessHosts: string[]
	}
	| {
		name: 'creating'
		timestampS: number
		epoch: number
		witnessHosts: string[]
	}
	| {
		name: 'witness-done'
		timestampS: number
		epoch: number
		witnessHostsLeft: string[]
		claimData: ProviderClaimData
		signaturesDone: string[]
	}