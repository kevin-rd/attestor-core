import { createClaimOnAvs } from 'src/avs/client/create-claim-on-avs'
import { CreateClaimOnAvsStep } from 'src/avs/types'
import { providers } from 'src/providers'
import { getInputParameters } from 'src/scripts/generate-receipt'
import { getCliArgument } from 'src/scripts/utils'
import { assertValidateProviderParams, logger } from 'src/utils'
import { getEnvVariable } from 'src/utils/env'


async function main() {
	const paramsJson = await getInputParameters()
	if(!(paramsJson.name in providers)) {
		throw new Error(`Unknown provider "${paramsJson.name}"`)
	}

	console.debug('params', paramsJson)
	assertValidateProviderParams<'http'>(paramsJson.name, paramsJson.params)

	const privateKey = getEnvVariable('PRIVATE_KEY_HEX') ||
		// demo private key
		'0x0123788edad59d7c013cdc85e4372f350f828e2cec62d9a2de4560e69aec7f89'
	const zkEngine = getCliArgument('zk') === 'gnark' ? 'gnark' : 'snarkjs'
	const { claimData: claimData } = await createClaimOnAvs({
		onStep,
		chainId: '5151',
		payer: { attestor: 'wss://devint-reclaim.mechain.tech/ws' },
		name: paramsJson.name,
		secretParams: paramsJson.secretParams,
		params: paramsJson.params,
		ownerPrivateKey: privateKey,
		context: {
			extractedParameters: { price: '3443.84' },
			providerHash: '0xf44817617d1dfa5219f6aaa0d4901f9b9b7a6845bbf7b639d9bffeacc934ff9a'
		},
		logger,
		zkEngine
	})

	const ctx = claimData.context ? JSON.parse(claimData.context) : {}
	if(ctx.extractedParameters) {
		console.log('extracted params:', ctx.extractedParameters)
	} else {
		console.log('claimData:', claimData)
	}
}

function onStep(step: CreateClaimOnAvsStep) {
	switch (step.type) {
	case 'taskCreated':
		console.debug('taskCreated', step.data.task)
		break
	case 'attestorStep':
		console.debug('attestorStep', step.data.step)
		break
	case 'attestorDone':
		console.debug('attestorDone', step.data.responsesDone)
		break
	}
}

main().then()
