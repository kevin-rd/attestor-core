import { strToUint8Array } from '@reclaimprotocol/tls'
import { DEFAULT_PORT, RECLAIM_USER_AGENT } from '../../config'
import { TranscriptMessageSenderType } from '../../proto/api'
import { ArraySlice, Provider } from '../../types'
import { getHttpRequestHeadersFromTranscript, uint8ArrayToBinaryStr } from '../../utils'
import {
	buildHeaders, convertResponsePosToAbsolutePos,
	extractHTMLElement,
	extractJSONValueIndex, parseHttpResponse,
} from './utils'


export type HTTPProviderParams = {
	/**
	 * Any additional headers to be sent with the request
	 * Note: these will be revealed to the witness & won't be
	 * redacted from the transcript
	 */
	headers?: Record<string, string>
	/**
	 * which URL does the request have to be made to
	 * for eg. https://amazon.in/orders?q=abcd
	 */
	url: string
	/** HTTP method */
	method: 'GET' | 'POST'
	/** which portions to select from a response. If both are set, then JSON path is taken after xPath is found */
	responseSelections: {
		/**
		 * expect an HTML response, and to contain a certain xpath
		 * for eg. "/html/body/div.a1/div.a2/span.a5"
		 */
		xPath?: string
		/**
		 * expect a JSON response, retrieve the item at this path
		 * using dot notation
		 * for e.g. 'email.addresses.0'
		 */
		jsonPath?: string
		/** A regexp to match the "responseSelection" to */
		responseMatch: string
	}[]
}

export type HTTPProviderSecretParams = {
	/** cookie string for authorisation. Will be redacted from witness */
	cookieStr?: string
	/** authorisation header value. Will be redacted from witness */
	authorisationHeader?: string
}

const OK_HTTP_HEADER = 'HTTP/1.1 200 OK'

const HTTP_PROVIDER: Provider<HTTPProviderParams, HTTPProviderSecretParams> = {
	hostPort(params) {
		const { host } = new URL(params.url)
		if(!host) {
			throw new Error('url is incorrect')
		}

		return host
	},
	areValidParams(params): params is HTTPProviderParams {
		return (
			typeof params.url === 'string' &&
			(params.method === 'GET' || params.method === 'POST') &&
			Array.isArray(params.responseSelections) &&
			params.responseSelections.length > 0
		)
	},
	createRequest(secretParams, params) {
		if(!secretParams.cookieStr && !secretParams.authorisationHeader) {
			throw new Error('auth parameters are not set')
		}

		let headers: string[] = []

		if(params.headers) {
			headers = buildHeaders(params.headers)
		}

		const authStr: string[] = []
		if(secretParams.cookieStr) {
			authStr.push(`Cookie: ${secretParams.cookieStr}`)
		}

		if(secretParams.authorisationHeader) {
			authStr.push(`Authorization: ${secretParams.authorisationHeader}`)
		}

		let authLen = authStr.reduce((sum, current) => sum + current.length, 0)
		if(authStr.length > 1) {
			authLen += 2 //add \r\n
		}

		const hostPort =
			this.hostPort instanceof Function ? this.hostPort(params) : this.hostPort
		const { pathname } = new URL(params.url)
		const strRequest = [
			`${params.method} ${pathname} HTTP/1.1`,
			`Host: ${hostPort}`,
			...headers,
			...authStr,
			'Content-Length: 0',
			'Connection: close',
			'User-Agent: ' + RECLAIM_USER_AGENT,
			//no compression
			'accept-encoding: identity',
			'\r\n',
		].join('\r\n')

		const data = strToUint8Array(strRequest)
		// the string index will work here as long as
		// the string is ascii
		const tokenStartIndex = strRequest.indexOf(authStr[0])

		return {
			data,
			redactions: [
				{
					fromIndex: tokenStartIndex,
					toIndex: tokenStartIndex + authLen,
				},
			],
		}
	},
	assertValidProviderReceipt(receipt, params) {
		const req = getHttpRequestHeadersFromTranscript(receipt.transcript)
		if(req.method !== params.method.toLowerCase()) {
			throw new Error(`Invalid method: ${req.method}`)
		}

		const { hostname, pathname, port } = new URL(params.url)
		if(!hostname || !pathname) {
			throw new Error('url is incorrect')
		}

		if(req.url !== pathname) {
			throw new Error(`Invalid URL: ${req.url}`)
		}

		const expHostPort = `${hostname}:${port || DEFAULT_PORT}`
		if(receipt.hostPort !== expHostPort) {
			throw new Error(`Expected hostPort: ${expHostPort}, found: ${receipt.hostPort}`)
		}

		const res = Buffer.concat(
			receipt.transcript
				.filter(
					(r) => r.senderType ===
							TranscriptMessageSenderType.TRANSCRIPT_MESSAGE_SENDER_TYPE_SERVER &&
						!r.redacted
				)
				.map((r) => r.message)
		).toString()

		if(!res.includes(OK_HTTP_HEADER)) {
			throw new Error('Invalid response')
		}

		if(req.headers['connection'] !== 'close') {
			throw new Error('Invalid connection header')
		}

		for(const rs of params.responseSelections) {
			if(!new RegExp(rs.responseMatch, 'sgi').test(res)) {
				throw new Error(
					`Invalid receipt. Regex ${rs.responseMatch} failed to match`
				)
			}
		}
	},
	getResponseRedactions(response, params) {
		if(!params.responseSelections?.length) {
			return []
		}

		const res = parseHttpResponse(response)

		const headerEndIndex = res.statusLineEndIndex!
		const bodyStartIdx = res.bodyStartIndex!
		if(bodyStartIdx < 4) {
			throw new Error('Failed to find body')
		}

		const body = uint8ArrayToBinaryStr(res.body)


		const reveals: ArraySlice[] = [{ fromIndex: 0, toIndex: headerEndIndex }]
		for(const rs of params.responseSelections) {
			let element = body
			let elementIdx = -1
			let elementLength = -1

			if(rs.xPath) {
				element = extractHTMLElement(body, rs.xPath, !!rs.jsonPath)
				elementIdx = body.indexOf(element)
				if(elementIdx < 0) {
					throw new Error(`Failed to find element: "${rs.xPath}"`)
				}

				elementLength = element.length
			}

			if(rs.jsonPath) {
				const { start, end } = extractJSONValueIndex(element, rs.jsonPath)
				// if there's only json path used
				if(elementIdx < 0) {
					elementIdx = 0
				}

				if(start < 0) {
					throw new Error('Failed to find element')
				}

				element = body.slice(elementIdx + start, elementIdx + end)
				elementIdx += start
				elementLength = end - start
			}

			const regexp = new RegExp(rs.responseMatch, 'gim')
			if(!regexp.test(element)) {
				throw new Error('regexp does not match found element')
			}

			if(elementIdx > 0 && elementLength > 0) {
				const from = convertResponsePosToAbsolutePos(elementIdx, bodyStartIdx, res.chunks)
				const to = convertResponsePosToAbsolutePos(elementIdx + elementLength, bodyStartIdx, res.chunks)
				reveals.push({ fromIndex: from, toIndex: to })
			}
		}

		reveals.sort((a, b) => {
			return a.toIndex - b.toIndex
		})

		const redactions: ArraySlice[] = []
		if(reveals.length > 1) {
			let currentIndex = 0
			for(const r of reveals) {
				if(currentIndex < r.fromIndex) {
					redactions.push({ fromIndex: currentIndex, toIndex: r.fromIndex })
				}

				currentIndex = r.toIndex
			}

			redactions.push({ fromIndex: currentIndex, toIndex: response.length })
		}

		return redactions
	},
}

export default HTTP_PROVIDER
