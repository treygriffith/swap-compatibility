import compat from './compatibility.json'
import { readFileSync, writeFileSync } from 'fs'
import Handlebars from 'handlebars'
const template = Handlebars.compile(readFileSync('./templates/index.hbs', 'utf8'))

let atomicSwapCompat = {}
let paymentChannelNetworkSwapCompat = {}

let devOrder = ["develop", "testnet", "mainnet"]

function lowerStatus(statusA, statusB) {
	return devOrder[Math.min(devOrder.indexOf(statusA), devOrder.indexOf(statusB))]
}

function addProgress(prereqs, compat) {
	compat.progress = Object.keys(compat).reduce( (acc, key) => {
		let add = compat[key] === true || (compat[key] && compat[key].length) ? 1 : 0
		return acc + add
	}, 0)
	compat.total = Object.keys(compat).length - 1
	compat.hasPrerequisites = Object.keys(prereqs).every( key => {
		return compat[key] === true || (compat[key] && compat[key].length)
	})
	compat.isComplete = !!compat.implementationsOnMainnet.length
	return compat
}

function addClassNames(compat) {
	let classNames = []

	if(compat.isComplete) {
		classNames.push('bg-success')
	} else if(compat.hasPrerequisites) {
		classNames.push('bg-warning')
	} else {
		classNames.push('bg-danger')
	}

	compat.classNames = classNames.join(' ')
	return compat
}

function getImplementations(imps, baseSymbol, targetSymbol) {
	const implementations = imps.filter(({ support }) => {
		const supportsBase = support.map( sup => sup.currency || sup.specification ).includes(baseSymbol)
		const supportsTarget = support.map( sup => sup.currency || sup.specification ).includes(targetSymbol)
		return supportsBase && supportsTarget
	}).map(({ name, url, support }) => {
		const baseStatus = support.find( sup => (sup.currency || sup.specification) === baseSymbol ).status
		const targetStatus = support.find( sup => (sup.currency || sup.specification) === targetSymbol ).status
		const status = lowerStatus(baseStatus, targetStatus)

		return {
			name,
			url,
			status
		}
	}).sort((a, b) => {
		return devOrder.indexOf(a.status) - devOrder.indexOf(b.status)
	})

	return {
		implementations,
		implementationsInDevelopment: implementations.filter(({ status }) => {
			return devOrder.indexOf(status) >= devOrder.indexOf("develop")
		}),	
		implementationsOnTestnet: implementations.filter( ({ status }) => {
			return devOrder.indexOf(status) >= devOrder.indexOf("testnet")
		}),	
		implementationsOnMainnet: implementations.filter( ({ status }) => {
			return devOrder.indexOf(status) >= devOrder.indexOf("mainnet")
		})
	}
}

let currenciesAndSpecifications = compat.currencies.concat(compat.specifications.map( spec => {
	return Object.assign(
		{},
		compat.currencies.find( cur => cur.symbol === spec.platform ),
		spec
	)
}))

currenciesAndSpecifications.forEach( baseCurrency => {

	atomicSwapCompat[baseCurrency.symbol] = {}
	paymentChannelNetworkSwapCompat[baseCurrency.symbol] = {}

	currenciesAndSpecifications.forEach( targetCurrency => {
		if(targetCurrency.symbol === baseCurrency.symbol && !baseCurrency.platform) {
			atomicSwapCompat[baseCurrency.symbol][targetCurrency.symbol] = paymentChannelNetworkSwapCompat[baseCurrency.symbol][targetCurrency.symbol] = {
				classNames: "bg-secondary",
				ignore: true
			}
			return
		}

		let prerequisites = {
			baseHashedTimeLockedContracts: baseCurrency["hashed-time-locked-contracts"],
			targetHashedTimeLockedContracts: targetCurrency["hashed-time-locked-contracts"],
			basePreimageAuditability: baseCurrency["preimage-auditability"],
			targetPreimageAuditability: targetCurrency["preimage-auditability"],
			hashFunctionCompatibility: baseCurrency["hash-functions"].filter( fn => targetCurrency["hash-functions"].includes(fn) )
		}

		atomicSwapCompat[baseCurrency.symbol][targetCurrency.symbol] = Object.assign(
			{},
			prerequisites,
			getImplementations(compat["on-chain-atomic-swap-implementations"], baseCurrency.symbol, targetCurrency.symbol)
		)
		addProgress(prerequisites, atomicSwapCompat[baseCurrency.symbol][targetCurrency.symbol])
		addClassNames(atomicSwapCompat[baseCurrency.symbol][targetCurrency.symbol])

		let paymentChannelNetworkPrerequisites = Object.assign(
			{},
			prerequisites,
			{
				baseMalleabilityFix: baseCurrency["transaction-malleability-fix"] === true || (baseCurrency["transaction-malleability-fix"] && baseCurrency["transaction-malleability-fix"].status === "mainnet"),
				targetMalleabilityFix: targetCurrency["transaction-malleability-fix"] === true || (targetCurrency["transaction-malleability-fix"] && targetCurrency["transaction-malleability-fix"].status === "mainnet")
			}
		)

		paymentChannelNetworkSwapCompat[baseCurrency.symbol][targetCurrency.symbol] = Object.assign(
			{},
			paymentChannelNetworkPrerequisites,
			getImplementations(compat["payment-channel-atomic-swap-implementations"], baseCurrency.symbol, targetCurrency.symbol)
		)
		addProgress(paymentChannelNetworkPrerequisites, paymentChannelNetworkSwapCompat[baseCurrency.symbol][targetCurrency.symbol])
		addClassNames(paymentChannelNetworkSwapCompat[baseCurrency.symbol][targetCurrency.symbol])
	})
})

writeFileSync('./index.html', template(Object.assign(
	{},
	compat,
	{ currenciesAndSpecifications, atomicSwapCompat, paymentChannelNetworkSwapCompat }
)))