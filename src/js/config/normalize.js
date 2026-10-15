import { setGameNormalizer, mergeConfig, toNumber, clampInt } from '@js/config/config.js'
import { DEFAULT_CONFIG as CORE_DEFAULTS } from '@js/config/defaults.js'
import { DEFAULT_CONFIG } from './game.defaults.js'

// Game-specific validation, registered with the core config module. Call
// registerGameConfig() once from index.js, before loadConfig() runs.

const SPIN_TYPES = ['loss', 'smallwin', 'bigwin']
// Icon files available in src/assets/img/icon (icon-1.png … icon-8.png).
const ICON_COUNT = 8
const ROWS = 3

// Core paths whose default this game overrides. The core normalizer has already
// filled them with the core value when config.json omits them, so swap that
// back for this game's own default.
const OVERRIDDEN_CORE_PATHS = ['cta.url', 'texts.ctaButton', 'assets.background']

const getPath = (object, path) => path.split('.').reduce((acc, key) => acc?.[key], object)
const setPath = (object, path, value) => {
	const keys = path.split('.')
	const last = keys.pop()
	keys.reduce((acc, key) => acc[key], object)[last] = value
}

const toMoney = (value, fallback, min = 0) => Math.max(min, Math.round(toNumber(value, fallback) * 100) / 100)

function normalizeGrid(result, columns, fallback) {
	if (!Array.isArray(result) || result.length !== columns) return structuredClone(fallback)
	return result.map((column, i) => {
		if (!Array.isArray(column) || column.length !== ROWS) return structuredClone(fallback[i])
		return column.map(icon => clampInt(icon, 1, 1, ICON_COUNT))
	})
}

function normalizeWinLine(winLine, columns) {
	if (!Array.isArray(winLine)) return null
	return Array.from({ length: columns }, (_, i) => {
		const row = winLine[i]
		return row === null || row === undefined || row === '' ? null : clampInt(row, 0, 0, ROWS - 1)
	})
}

// Pads with defaults, never trims (see "Non-destructive normalization" in
// docs/config.md): an entry with a broken grid falls back to the default grid at
// the same index instead of being dropped.
function normalizeSpins(spins, defaults, columns) {
	const list = Array.isArray(spins) && spins.length ? spins : defaults
	return list.map((spin, i) => {
		const fallback = defaults[Math.min(i, defaults.length - 1)]
		const type = SPIN_TYPES.includes(spin?.type) ? spin.type : 'loss'
		return {
			type,
			winAmount: toMoney(spin?.winAmount, 0),
			winLine: type === 'loss' ? null : normalizeWinLine(spin?.winLine, columns),
			result: normalizeGrid(spin?.result, columns, fallback.result)
		}
	})
}

function normalizeGameConfig(input) {
	const config = mergeConfig(DEFAULT_CONFIG, input)
	OVERRIDDEN_CORE_PATHS.forEach((path) => {
		if (getPath(config, path) === getPath(CORE_DEFAULTS, path)) setPath(config, path, getPath(DEFAULT_CONFIG, path))
	})

	const game = config.game
	const defaults = DEFAULT_CONFIG.game

	game.currency = typeof game.currency === 'string' ? game.currency : defaults.currency
	game.balance = toMoney(game.balance, defaults.balance)
	game.betStep = toMoney(game.betStep, defaults.betStep, 0.01)
	game.minBet = toMoney(game.minBet, defaults.minBet, 0.01)
	game.maxBet = Math.max(game.minBet, toMoney(game.maxBet, defaults.maxBet))
	game.bet = Math.min(game.maxBet, Math.max(game.minBet, toMoney(game.bet, defaults.bet)))

	const timing = game.timing
	const td = defaults.timing
	for (const key of ['spinDuration', 'stopDelay', 'spinDistance']) {
		if (!timing[key] || typeof timing[key] !== 'object') timing[key] = {}
		for (const device of ['desktop', 'mobile']) {
			const max = key === 'spinDistance' ? 200 : 20000
			timing[key][device] = clampInt(timing[key]?.[device], td[key][device], key === 'spinDistance' ? 3 : 0, max)
		}
	}
	timing.stopDuration = clampInt(timing.stopDuration, td.stopDuration, 0, 5000)
	timing.startDelay = clampInt(timing.startDelay, td.startDelay, 0, 2000)
	timing.smallWinTime = clampInt(timing.smallWinTime, td.smallWinTime, 0, 20000)
	timing.bigWinTime = clampInt(timing.bigWinTime, td.bigWinTime, 0, 20000)
	timing.ctaDelay = clampInt(timing.ctaDelay, td.ctaDelay, 0, 20000)

	if (!game.spins || typeof game.spins !== 'object') game.spins = {}
	game.spins.desktop = normalizeSpins(game.spins.desktop, defaults.spins.desktop, 5)
	game.spins.mobile = normalizeSpins(game.spins.mobile, defaults.spins.mobile, 3)

	return config
}

export function registerGameConfig() {
	setGameNormalizer(normalizeGameConfig)
}
