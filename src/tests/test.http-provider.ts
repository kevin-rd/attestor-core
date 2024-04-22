import { ethers } from 'ethers'
import { createClaim, generateProviderReceipt } from '../api-client'
import { getContract } from '../beacon/smart-contract/utils'
import { BeaconType } from '../proto/api'
import { providers } from '../providers'
import { HTTPProviderParamsV2 } from '../providers/http-provider'
import { getWitnessClient } from '../scripts/generate-receipt'
import { BeaconState } from '../types'
import { logger } from '../utils'

jest.setTimeout(60_000)


describe('HTTP Provider tests', () => {


	it('should create receipt', async() => {

		const resp = await createClaim({
			name: 'http',
			beacon: {
				identifier: {
					type: BeaconType.BEACON_TYPE_RECLAIM_TRUSTED,
					id: '0x244897572368eadf65bfbc5aec98d8e5443a9072'
				},
				async getState(epochId?: number): Promise<BeaconState> {
					const chainId = '0x12c'
					const contract = getContract(chainId)
					if(contract) {
						//@ts-ignore
						const epoch = await contract.fetchEpoch(epochId || 0)
						if(!epoch.id) {
							throw new Error(`Invalid epoch ID: ${epochId}`)
						}

						return {
							epoch: epoch.id,
							witnesses: epoch.witnesses.map((w: any) => ({
								id: w.addr.toLowerCase(),
								url: w.host,
							})),
							witnessesRequiredForClaim: epoch.minimumWitnessesForClaimCreation,
							nextEpochTimestampS: epoch.timestampEnd,
						}
					} else {
						throw new Error('contract not found')
					}
				}
			},
			params: {
				url: 'https://xargs.{{param1}}/',
				method: 'GET',
				responseMatches: [{
					type: 'regex',
					value: '<title.*?(?<name>Aiken &amp; {{param2}} &amp; Webb)<\\/title>',
				}],
				responseRedactions: [{
					xPath: './html/head/{{param3}}',
				}],
				paramValues: {
					param1: 'org',
					param2: 'Driscoll',
					param3: 'title'
				}
			},
			secretParams: {
				cookieStr: '<cookie-str>'
			},
			ownerPrivateKey: ethers.Wallet.createRandom().privateKey,
		})
		expect(resp.claimData.context).toContain('0x8d1a460a00b7f8596f380a34bc12b39aee4d8cbc90589c40133d3e96691e45d4')
	})

	it('should generate transcript', async() => {
		const DEFAULT_WITNESS_HOST_PORT = 'https://reclaim-node.questbook.app'
		const client = getWitnessClient(
			DEFAULT_WITNESS_HOST_PORT,
			logger
		)
		const params: HTTPProviderParamsV2 = {
			url: 'https://xargs.{{param1}}/',
			method: 'GET',
			body: 't{{h}}st',
			geoLocation: 'US',
			responseMatches: [{
				type: 'regex',
				value: '<title.*?(?<name>Aiken &amp; {{param2}} &amp; Webb)<\\/title>',
			},
			{
				type: 'contains',
				value: 'who use {{what}} to learn',
			}
			],
			responseRedactions: [{
				xPath: './html/head/{{param3}}',
			}, {
				xPath: '/html/body/div/div[2]/p[2]/text()'
			}],
			paramValues: {
				param1: 'org',
				param2: 'Driscoll',
				param3: 'title',
				what: 'these'
			}
		}
		const { receipt } = await generateProviderReceipt({
			name: 'http',
			secretParams: {
				cookieStr: '<cookie-str>',
				paramValues: {
					h: 'e',
				}
			},
			params: params,
			client,
			logger,
		})
		expect(receipt?.transcript).not.toBeNull()
		expect(() => {
			providers['http'].assertValidProviderReceipt(receipt!, params)
		}).not.toThrow()
	})

})