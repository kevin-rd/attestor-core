import { ethers } from 'ethers'
import { RECLAIM_PUBLIC_URL, SELECTED_CHAIN_ID } from 'src/avs/config'
import { getContracts } from 'src/avs/utils/contracts'
import { logger as LOGGER } from 'src/utils'

type RegisterOpts = {
	logger?: typeof LOGGER
	/**
	 * What chain to register the operator on
	 * @default -- env variable CHAIN_ID
	 */
	chainId?: string
	/**
	 * wallet of the operator.
	 * @default -- wallet specified in the contracts
	 *  fetched by the chainId
	 */
	wallet?: ethers.Wallet
	/**
	 * URL of the Reclaim RPC server.
	 * @default -- env variable RECLAIM_PUBLIC_URL
	 */
	reclaimRpcUrl?: string
}

/**
 * Registers the operator on the chain, if required.
 * If already registered -- will just pass through
 */
export async function registerOperator({
	logger = LOGGER,
	chainId = SELECTED_CHAIN_ID,
	wallet = getContracts(chainId).wallet!,
	reclaimRpcUrl = RECLAIM_PUBLIC_URL
}: RegisterOpts = {}) {
	const contracts = getContracts(chainId)
	const delegationManager = contracts.delegationManager.connect(wallet)
	const avsDirectory = contracts.avsDirectory.connect(wallet)
	const contract = contracts.contract.connect(wallet)
	const registryContract = contracts.registryContract.connect(wallet)

	const addr = await wallet.address
	console.log(
		'Register parameters:',
		`addr: ${addr}`,
		`chainId: ${chainId}`,
		`delegationManager: ${delegationManager.address}`,
		`registryContract: ${registryContract.address}`,
		`HelloWorldServiceManager: ${contract.address}`,
	)

	if(!(await delegationManager.isOperator(addr))) {
		try {
			const tx1 = await delegationManager.registerAsOperator({
				earningsReceiver: addr,
				delegationApprover: '0x0000000000000000000000000000000000000000',
				stakerOptOutWindowBlocks: 0
			}, '')
			await tx1.wait()
			logger.info('operator registered on DM successfully')
		} catch(err) {
			if(!err.message.includes('operator has already registered')) {
				throw err
			}

			logger.info('Operator already registered on EL')
		}
	}

	// Add Whitelist
	if(!await contract.isOperatorWhitelisted(addr)) {
		logger.info('add operator to whitelist')
		const tx2 = await contract.whitelistAddressAsOperator(addr, true)
		await tx2.wait()
	}

	// register Operator with Signature on stake Registry Contract
	if(!(await registryContract.operatorRegistered(addr))) {
		const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32))
		// Example expiry, 1 hour from now
		const expiry = Math.floor(Date.now() / 1000) + 3600 * 24
		// Define the output structure
		const operatorSignature = {
			expiry: expiry,
			salt: salt,
			signature: ''
		}

		// Calculate the digest hash using the avsDirectory's method
		const digestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
			addr,
			contract.address,
			salt,
			expiry
		)

		// Sign the digest hash with the operator's private key
		const signingKey = new ethers.utils.SigningKey(wallet.privateKey)
		const signature = signingKey.signDigest(digestHash)

		// Encode the signature in the required format
		operatorSignature.signature = ethers.utils.joinSignature(signature)

		logger.info('operator signature generated successfully')
		const tx2 = await registryContract.registerOperatorWithSignature(addr, operatorSignature)
		await tx2.wait()
		logger.info('operator registered on AVS successfully')
	} else {
		logger.info('Operator already registered on AVS, skip')
	}

	const existingMetadata = await contract.getMetadataForOperator(addr)
		.catch(err => {
			if(err.message.includes('Operator not found')) {
				return undefined
			}

			throw err
		})
	const metadata = { addr, url: reclaimRpcUrl }
	if(existingMetadata?.addr === metadata.addr && existingMetadata?.url === metadata.url) {
		logger.info('operator metadata already up to date')
		return
	}

	const tx4 = await contract.updateOperatorMetadata(metadata)
	await tx4.wait()
	logger.info({ metadata }, 'operator metadata updated successfully, txHash:', tx4.hash)
}