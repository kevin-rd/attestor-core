import { createClaimOnAvs } from 'src/avs/client/create-claim-on-avs'


function handleStep(step: { type: string, data: any }) {
	switch (step.type) {
	case 'taskCreated':
		console.log('task created')
		break
	case 'attestorStep':
		console.log('attestor step')
		break
	case 'attestorDone':
		console.log('attestor done', step.data.responsesDone)
		break
	}
}


async function main() {
	const { claimData: claimData, object: result } = await createClaimOnAvs({
		onStep: handleStep,
		chainId: '5151',
		ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
		name: 'http',
		params: {
			url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
			method: 'GET',
			responseRedactions: [],
			responseMatches: [
				{
					type: 'contains',
					value: 'ethereum'
				}
			]
		},
		secretParams: {
			'headers': {
				'accept': 'application/json, text/plain, */*'
			}
		},
	})

	console.log(claimData)
	console.log(result)
}


main().then()