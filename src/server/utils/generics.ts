import { strToUint8Array } from '@reclaimprotocol/tls'
import { IncomingMessage } from 'http'
import { RPCMessages, ServiceSignatureType } from '../../proto/api'
import { SIGNATURES } from '../../signatures'
import { WitnessError } from '../../utils'

const PRIVATE_KEY = process.env.PRIVATE_KEY!

/**
 * Sign using the witness's private key.
 */
export function signAsWitness(
	data: Uint8Array | string,
	scheme: ServiceSignatureType
) {
	const { sign } = SIGNATURES[scheme]
	return sign(
		typeof data === 'string' ? strToUint8Array(data) : data,
		PRIVATE_KEY
	)
}

/**
 * Nice parse JSON with a key.
 * If the data is empty, returns an empty object.
 * And if the JSON is invalid, throws a bad request error,
 * with the key in the error message.
 */
export function niceParseJsonObject(data: string, key: string) {
	if(!data) {
		return {}
	}

	try {
		return JSON.parse(data)
	} catch(e) {
		throw WitnessError.badRequest(
			`Invalid JSON in ${key}: ${e.message}`,
		)
	}
}

/**
 * Extract any initial messages sent to the witness
 * via the query string.
 */
export function getInitialMessagesFromQuery(req: IncomingMessage) {
	const url = new URL(req.url!, 'http://localhost')
	const messagesB64 = url.searchParams.get('messages')
	if(!messagesB64?.length) {
		return []
	}

	const msgsBytes = Buffer.from(messagesB64, 'base64')
	const msgs = RPCMessages.decode(msgsBytes)
	return msgs.messages
}