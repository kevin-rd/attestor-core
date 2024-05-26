import type { WebSocket, WebSocketServer } from 'ws'
import { WitnessClient } from '../client'
import { makeWsServer } from '../server'
import { IWitnessServerSocket } from '../types'
import { logger } from '../utils'
import { createMockServer } from './mock-provider-server'
import { getRandomPort, randomPrivateKey } from './utils'

type ServerOpts = {
	/**
	 * Get the client's connection on the server.
	 */
	getClientOnServer(): IWitnessServerSocket | undefined
	client: WitnessClient
	privateKeyHex: string
	mockHttpsServer: ReturnType<typeof createMockServer>
	serverUrl: string
}

/**
 * Boots up a witness server, a mock https server,
 * and a client that is renewed for each test.
 */
export const describeWithServer = (
	name: string,
	fn: (opts: ServerOpts) => void
) => describe(name, () => {
	let wsServer: WebSocketServer
	let wsServerUrl: string

	let privateKeyHex: string
	let client: WitnessClient

	const mockHttpsServer = createMockServer(1234)

	beforeAll(async() => {
		const wsServerPort = getRandomPort()
		wsServer = await makeWsServer(wsServerPort)
		wsServerUrl = `ws://localhost:${wsServerPort}`
	})

	afterAll(() => {
		wsServer.close()
		mockHttpsServer.server.close()
	})

	beforeEach(async() => {
		privateKeyHex = randomPrivateKey()
		client = new WitnessClient({
			logger: logger.child({ client: 1 }),
			url: wsServerUrl
		})
		await client.waitForInit()
	})

	afterEach(async() => {
		await client.terminateConnection()
	})

	fn({
		getClientOnServer,
		get client() {
			return client
		},
		get privateKeyHex() {
			return privateKeyHex
		},
		get serverUrl() {
			return wsServerUrl
		},
		mockHttpsServer,
	})

	function getClientOnServer() {
		const serverSockets = [...wsServer.clients.values()] as WebSocket[]
		return serverSockets.at(-1)?.serverSocket
	}
})