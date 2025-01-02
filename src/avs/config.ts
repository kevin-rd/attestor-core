import type { ChainConfig } from 'src/avs/types'
import { getEnvVariable } from 'src/utils/env'

export const CHAIN_CONFIGS: { [key: string]: ChainConfig } = {
	'31337': {
		rpcUrl: 'http://localhost:8545',
		contractAddress: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
		delegationManagerAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
		stakeRegistryAddress: '0x9E545E3C0baAB3E08CdfD552C960A1050f373042',
		avsDirectoryAddress: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
	},
	'17000': {
		rpcUrl: getEnvVariable('RPC_URL') || 'https://rpc.holesky.ethpandaops.io',
		contractAddress: '0x0861afc305999bfD3028dB66145395BdD7299366',
		delegationManagerAddress: '0xA44151489861Fe9e3055d95adC98FbD462B948e7',
		stakeRegistryAddress: '0xDa11C9Da04Ab02C4AF9374B27A5E727944D3E1dD',
		avsDirectoryAddress: '0x055733000064333CaDDbC92763c58BF0192fFeBf'
	},
	'5151': {
		rpcUrl: getEnvVariable('RPC_URL') || 'https://devint-rpc.mechain.tech:443',
		contractAddress: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
		delegationManagerAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
		stakeRegistryAddress: '0x9E545E3C0baAB3E08CdfD552C960A1050f373042',
		avsDirectoryAddress: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
	},
	'5141': {
		rpcUrl: getEnvVariable('RPC_URL') || 'https://testint-rpc.mechain.tech:443',
		contractAddress: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
		delegationManagerAddress: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
		stakeRegistryAddress: '0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8',
		avsDirectoryAddress: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853'
	},
}

export const PRIVATE_KEY = getEnvVariable('PRIVATE_KEY')!

export const SELECTED_CHAIN_ID = getEnvVariable('CHAIN_ID')

export const RECLAIM_PUBLIC_URL = getEnvVariable('RECLAIM_PUBLIC_URL')!